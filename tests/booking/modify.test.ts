import "../../scripts/load-env";
import { describe, it, before, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { BookingStatus, RoomStatus } from "../../src/generated/prisma/enums";
import {
  BookingError,
  addBookingNote as rawAddBookingNote,
  cancelBooking,
  createBooking as rawCreateBooking,
  getBookingDetail,
  getBookingDetailByReference,
  modifyBooking as rawModifyBooking,
  transitionBooking as rawTransitionBooking,
  type StaffActor,
} from "../../src/server/booking/service";
import { AvailabilityConflictError } from "../../src/server/availability/service";
import { requireHotelContext, hotelToday } from "../../src/server/pricing/context";
import { addDays } from "../../src/server/availability/overlap";
import {
  BOOKING_TEST_SUFFIX,
  deleteTestBookingGuests,
  ensureTestStaffUser,
  loadInventory,
  prisma,
  testHotelId,
  testOrganizationId,
} from "../helpers";

/** P5 staff modification, operational notes and the shared read model. */

let inventory: Awaited<ReturnType<typeof loadInventory>>;
let guestId = "";
let hotelId = "";
let organizationId = "";
let staff: StaffActor;

const createBooking = (
  input: Omit<Parameters<typeof rawCreateBooking>[0], "hotelId">,
  actor: Parameters<typeof rawCreateBooking>[1],
) => rawCreateBooking({ ...input, hotelId }, actor);

const tenantStaff = (actor: StaffActor): StaffActor => ({
  ...actor,
  organizationId,
  organizationWide: true,
});

const modifyBooking = (
  input: Parameters<typeof rawModifyBooking>[0],
  actor: Parameters<typeof rawModifyBooking>[1],
) => rawModifyBooking(input, tenantStaff(actor));

const transitionBooking = (
  input: Parameters<typeof rawTransitionBooking>[0],
  actor: Parameters<typeof rawTransitionBooking>[1],
) => rawTransitionBooking(input, tenantStaff(actor));

const addBookingNote = (
  input: Parameters<typeof rawAddBookingNote>[0],
  actor: Parameters<typeof rawAddBookingNote>[1],
) => rawAddBookingNote(input, tenantStaff(actor));

function iso(date: Date): string {
  return date.toISOString().slice(0, 10);
}

async function createStay(roomId: string, checkIn: Date, checkOut: Date) {
  return createBooking(
    {
      checkIn: iso(checkIn),
      checkOut: iso(checkOut),
      adults: 2,
      children: 0,
      roomIds: [roomId],
      guest: { firstName: "P5", lastName: "Modify", email: `modify${BOOKING_TEST_SUFFIX}` },
    },
    { kind: "guest", guestId },
  );
}

describe("P5 modification, notes and read models", () => {
  before(async () => {
    hotelId = await testHotelId();
    organizationId = await testOrganizationId();
    inventory = await loadInventory();
    const staffId = await ensureTestStaffUser();
    staff = {
      kind: "staff",
      userId: staffId,
      email: `p5-staff${BOOKING_TEST_SUFFIX}`,
      organizationId,
      organizationWide: true,
    };

    await deleteTestBookingGuests();
    const guest = await prisma.guest.create({
      data: { firstName: "P5", lastName: "Modify", email: `modify${BOOKING_TEST_SUFFIX}` },
    });
    guestId = guest.id;
  });

  beforeEach(async () => {
    await prisma.booking.deleteMany({
      where: { guest: { email: { endsWith: BOOKING_TEST_SUFFIX } } },
    });
  });

  it("notes-only modification keeps the stay and rewrites the note field", async () => {
    const room = inventory.bySlug.get("deluxe-king")!.rooms[0];
    const booking = await createStay(room.id, addDays(new Date(), 12), addDays(new Date(), 14));

    const updated = await modifyBooking(
      { bookingId: booking.id, notes: "late arrival ~23:00" },
      staff,
    );
    assert.equal(updated.checkIn, booking.checkIn, "dates untouched");
    assert.equal(updated.breakdown.total, booking.breakdown.total, "price untouched");
    assert.equal(updated.notes, "late arrival ~23:00");
  });

  it("moves the stay to new dates and re-prices against the new window", async () => {
    const room = inventory.bySlug.get("deluxe-king")!.rooms[1];
    const booking = await createStay(room.id, addDays(new Date(), 12), addDays(new Date(), 14));

    const newIn = addDays(new Date(), 20);
    const newOut = addDays(new Date(), 24); // 4 nights instead of 2
    const updated = await modifyBooking(
      { bookingId: booking.id, checkIn: iso(newIn), checkOut: iso(newOut) },
      staff,
    );

    assert.equal(updated.checkIn, iso(newIn));
    assert.equal(updated.checkOut, iso(newOut));
    assert.equal(updated.nights, 4);
    assert.notEqual(updated.breakdown.total, booking.breakdown.total, "longer stay costs more");

    const nights = await prisma.roomNight.findMany({
      where: { bookingId: booking.id, roomId: room.id },
      orderBy: { night: "asc" },
    });
    assert.equal(nights.length, 4);
    assert.equal(nights[0].night.toISOString().slice(0, 10), iso(newIn));
  });

  it("swaps the allocation to a different free room", async () => {
    const rooms = inventory.bySlug.get("deluxe-king")!.rooms;
    const booking = await createStay(rooms[2].id, addDays(new Date(), 12), addDays(new Date(), 14));

    const updated = await modifyBooking(
      { bookingId: booking.id, roomIds: [rooms[3].id] },
      staff,
    );
    assert.deepEqual(
      updated.rooms.map((line) => line.roomId),
      [rooms[3].id],
    );

    const moved = await prisma.roomNight.findMany({ where: { bookingId: booking.id } });
    assert.ok(moved.every((night) => night.roomId === rooms[3].id));
  });

  it("refuses a modification that collides with another live booking", async () => {
    const rooms = inventory.bySlug.get("executive-suite")!.rooms;
    const holder = await createStay(rooms[0].id, addDays(new Date(), 30), addDays(new Date(), 32));
    const booking = await createStay(rooms[1].id, addDays(new Date(), 30), addDays(new Date(), 32));

    await assert.rejects(
      modifyBooking({ bookingId: booking.id, roomIds: [rooms[0].id] }, staff),
      (error: unknown) =>
        error instanceof AvailabilityConflictError && error.reason === "stay_overlap",
    );

    // The failed modification left the original allocation intact.
    const untouched = await getBookingDetail(booking.id, { kind: "staff" });
    assert.deepEqual(
      untouched.rooms.map((line) => line.roomId),
      [rooms[1].id],
    );
    assert.ok(holder.id);
  });

  it("refuses to modify a checked-in reservation", async () => {
    const room = inventory.bySlug.get("family-room")!.rooms[0];
    const today = hotelToday(new Date(), (await requireHotelContext(hotelId)).timezone);
    const booking = await createStay(room.id, today, addDays(today, 2));
    try {
      await transitionBooking({ bookingId: booking.id, to: BookingStatus.CONFIRMED }, staff);
      await transitionBooking({ bookingId: booking.id, to: BookingStatus.CHECKED_IN }, staff);

      await assert.rejects(
        modifyBooking({ bookingId: booking.id, notes: "nope" }, staff),
        (error: unknown) => error instanceof BookingError && error.code === "not_modifiable",
      );
    } finally {
      await prisma.booking.deleteMany({
        where: { guest: { email: { endsWith: BOOKING_TEST_SUFFIX } } },
      });
      await prisma.room.update({ where: { id: room.id }, data: { status: RoomStatus.AVAILABLE } });
    }
  });

  it("appends operational notes with an actor stamp instead of overwriting", async () => {
    const room = inventory.bySlug.get("deluxe-king")!.rooms[2];
    const booking = await createStay(room.id, addDays(new Date(), 12), addDays(new Date(), 14));
    await addBookingNote({ bookingId: booking.id, note: "VIP amenity requested" }, staff);
    const result = await addBookingNote({ bookingId: booking.id, note: "called guest back" }, staff);

    assert.ok(result.notes.includes("VIP amenity requested"));
    assert.ok(result.notes.includes("called guest back"));
    assert.ok(result.notes.includes("p5-staff" + BOOKING_TEST_SUFFIX), "stamped with the actor");

    const detail = await getBookingDetail(booking.id, { kind: "staff" });
    assert.ok(detail.activity.some((entry) => entry.action === "booking.note"));
  });

  it("a guest only ever sees their own reservation, by id or reference", async () => {
    const room = inventory.bySlug.get("deluxe-king")!.rooms[3];
    const booking = await createStay(room.id, addDays(new Date(), 12), addDays(new Date(), 14));

    const mine = await getBookingDetail(booking.id, { kind: "guest", guestId });
    assert.equal(mine.id, booking.id);

    const byReference = await getBookingDetailByReference(booking.bookingReference, {
      kind: "guest",
      guestId,
    });
    assert.equal(byReference.id, booking.id);

    await assert.rejects(
      getBookingDetail(booking.id, { kind: "guest", guestId: "00000000-0000-0000-0000-000000000000" }),
      (error: unknown) => error instanceof BookingError && error.code === "booking_not_found",
    );
    await assert.rejects(
      getBookingDetailByReference(booking.bookingReference, {
        kind: "guest",
        guestId: "00000000-0000-0000-0000-000000000000",
      }),
      (error: unknown) => error instanceof BookingError && error.code === "booking_not_found",
    );
  });

  it("cancelling through the service exposes the cancellation info the pages show", async () => {
    const room = inventory.bySlug.get("deluxe-king")!.rooms[0];
    const booking = await createStay(room.id, addDays(new Date(), 12), addDays(new Date(), 14));

    const detail = await getBookingDetail(booking.id, { kind: "staff" });
    assert.equal(detail.cancellation.guestAllowed, true);
    assert.ok(detail.cancellation.deadline, "a deadline is always computed");

    await cancelBooking({ bookingId: booking.id }, staff);
    const after = await getBookingDetail(booking.id, { kind: "staff" });
    assert.equal(after.bookingStatus, BookingStatus.CANCELLED);
    assert.equal(after.cancellation.guestAllowed, false, "cancelled is not cancellable");
  });
});
