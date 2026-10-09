import "../../scripts/load-env";
import { describe, it, before, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { BookingStatus, RoomStatus } from "../../src/generated/prisma/enums";
import {
  BookingError,
  cancelBooking,
  cancelBookingByClaim,
  createBooking,
  transitionBooking,
  updateRoomStatus,
  type StaffActor,
} from "../../src/server/booking/service";
import { TransitionError } from "../../src/server/booking/policy";
import { signBookingClaim } from "../../src/server/booking/claim";
import { loadHotelContext, hotelToday } from "../../src/server/pricing/context";
import { addDays } from "../../src/server/availability/overlap";
import {
  BOOKING_TEST_SUFFIX,
  deleteTestBookingGuests,
  ensureTestStaffUser,
  loadInventory,
  prisma,
} from "../helpers";

/**
 * P5 lifecycle: cancellation policy (config window, staff bypass) and the
 * guarded transition table, including the room-status side effects of
 * check-in / check-out and the CheckedOut → Cleaning → Available flow.
 */

let inventory: Awaited<ReturnType<typeof loadInventory>>;
let guestId = "";
let otherGuestId = "";
let staffId = "";
let staff: StaffActor;

function iso(date: Date): string {
  return date.toISOString().slice(0, 10);
}

async function createStay(roomId: string, checkIn: Date, checkOut: Date, guest = guestId) {
  return createBooking(
    {
      checkIn: iso(checkIn),
      checkOut: iso(checkOut),
      adults: 2,
      children: 0,
      roomIds: [roomId],
      guest: { firstName: "P5", lastName: "Lifecycle", email: `lifecycle${BOOKING_TEST_SUFFIX}` },
    },
    { kind: "guest", guestId: guest },
  );
}

describe("P5 cancellation and transitions", () => {
  before(async () => {
    inventory = await loadInventory();
    staffId = await ensureTestStaffUser();
    staff = { kind: "staff", userId: staffId, email: `p5-staff${BOOKING_TEST_SUFFIX}` };

    await deleteTestBookingGuests();
    const guest = await prisma.guest.create({
      data: { firstName: "P5", lastName: "Lifecycle", email: `lifecycle${BOOKING_TEST_SUFFIX}` },
    });
    guestId = guest.id;
    const other = await prisma.guest.create({
      data: {
        firstName: "Other",
        lastName: "Lifecycle",
        email: `lifecycle-other${BOOKING_TEST_SUFFIX}`,
      },
    });
    otherGuestId = other.id;
  });

  beforeEach(async () => {
    await prisma.booking.deleteMany({
      where: { guest: { email: { endsWith: BOOKING_TEST_SUFFIX } } },
    });
  });

  it("lets a guest cancel inside the free window and releases the nights", async () => {
    const room = inventory.bySlug.get("deluxe-king")!.rooms[0];
    // Arrival far enough out that the 48h window cannot have passed.
    const booking = await createStay(room.id, addDays(new Date(), 10), addDays(new Date(), 13));

    const cancelled = await cancelBooking(
      { bookingId: booking.id, note: "plans changed" },
      { kind: "guest", guestId },
    );
    assert.equal(cancelled.bookingStatus, BookingStatus.CANCELLED);

    const nights = await prisma.roomNight.count({ where: { bookingId: booking.id } });
    assert.equal(nights, 0, "the trigger must release the held nights");
  });

  it("blocks a guest once the config window has passed, but staff may still cancel", async () => {
    const room = inventory.bySlug.get("deluxe-king")!.rooms[1];
    // Arrival tomorrow: the 48h deadline (check-in time − 48h) is already past.
    const booking = await createStay(room.id, addDays(new Date(), 1), addDays(new Date(), 3));

    await assert.rejects(
      cancelBooking({ bookingId: booking.id }, { kind: "guest", guestId }),
      (error: unknown) => error instanceof BookingError && error.code === "too_late_to_cancel",
    );

    const cancelled = await cancelBooking({ bookingId: booking.id, note: "desk request" }, staff);
    assert.equal(cancelled.bookingStatus, BookingStatus.CANCELLED);
  });

  it("never confirms another guest's reservation to a guest caller (404 semantics)", async () => {
    const room = inventory.bySlug.get("deluxe-king")!.rooms[2];
    const booking = await createStay(room.id, addDays(new Date(), 10), addDays(new Date(), 12));

    await assert.rejects(
      cancelBooking({ bookingId: booking.id }, { kind: "guest", guestId: otherGuestId }),
      (error: unknown) => error instanceof BookingError && error.code === "booking_not_found",
    );
  });

  it("cancels through a claim only for the named reservation and guest", async () => {
    const room = inventory.bySlug.get("deluxe-king")!.rooms[3];
    const booking = await createStay(room.id, addDays(new Date(), 10), addDays(new Date(), 12));
    const claim = await signBookingClaim({
      reference: booking.bookingReference,
      guestId,
    });
    assert.ok(claim.length > 10, "claim token is a signed string");

    const cancelled = await cancelBookingByClaim({
      reference: booking.bookingReference,
      guestId,
    });
    assert.equal(cancelled.bookingStatus, BookingStatus.CANCELLED);

    const fresh = await createStay(room.id, addDays(new Date(), 14), addDays(new Date(), 16));
    await assert.rejects(
      cancelBookingByClaim({ reference: fresh.bookingReference, guestId: otherGuestId }),
      (error: unknown) => error instanceof BookingError && error.code === "booking_not_found",
    );
  });

  it("refuses to cancel a stay that already happened", async () => {
    const room = inventory.bySlug.get("executive-suite")!.rooms[0];
    const original = await prisma.room.findUniqueOrThrow({ where: { id: room.id } });
    const today = hotelToday(new Date(), (await loadHotelContext()).timezone);
    const booking = await createStay(room.id, today, addDays(today, 2));
    try {
      await transitionBooking({ bookingId: booking.id, to: BookingStatus.CONFIRMED }, staff);
      await transitionBooking({ bookingId: booking.id, to: BookingStatus.CHECKED_IN }, staff);

      await assert.rejects(
        cancelBooking({ bookingId: booking.id }, staff),
        (error: unknown) => error instanceof BookingError && error.code === "not_cancellable",
      );
    } finally {
      await prisma.booking.deleteMany({
        where: { guest: { email: { endsWith: BOOKING_TEST_SUFFIX } } },
      });
      await prisma.room.update({ where: { id: room.id }, data: { status: original.status } });
    }
  });

  it("walks PENDING → CONFIRMED → CHECKED_IN → CHECKED_OUT with room side effects", async () => {
    const room = inventory.bySlug.get("executive-suite")!.rooms[1];
    const today = hotelToday(new Date(), (await loadHotelContext()).timezone);
    const booking = await createStay(room.id, today, addDays(today, 3));

    const confirmed = await transitionBooking(
      { bookingId: booking.id, to: BookingStatus.CONFIRMED, note: "card taken" },
      staff,
    );
    assert.equal(confirmed.bookingStatus, BookingStatus.CONFIRMED);
    assert.ok(confirmed.notes?.includes("card taken"), "action note is appended");

    const checkedIn = await transitionBooking(
      { bookingId: booking.id, to: BookingStatus.CHECKED_IN },
      staff,
    );
    assert.equal(checkedIn.bookingStatus, BookingStatus.CHECKED_IN);
    const afterCheckIn = await prisma.room.findUnique({ where: { id: room.id } });
    assert.equal(afterCheckIn?.status, RoomStatus.OCCUPIED, "check-in occupies the room");

    const checkedOut = await transitionBooking(
      { bookingId: booking.id, to: BookingStatus.CHECKED_OUT },
      staff,
    );
    assert.equal(checkedOut.bookingStatus, BookingStatus.CHECKED_OUT);
    const afterCheckOut = await prisma.room.findUnique({ where: { id: room.id } });
    assert.equal(afterCheckOut?.status, RoomStatus.CLEANING, "check-out sends it to housekeeping");

    await prisma.room.update({ where: { id: room.id }, data: { status: RoomStatus.AVAILABLE } });
  });

  it("enforces the transition table and arrival-date timing", async () => {
    const room = inventory.bySlug.get("family-room")!.rooms[0];
    const booking = await createStay(room.id, addDays(new Date(), 7), addDays(new Date(), 9));

    // Illegal edge from the table.
    await assert.rejects(
      transitionBooking({ bookingId: booking.id, to: BookingStatus.CHECKED_OUT }, staff),
      (error: unknown) => error instanceof TransitionError && error.code === "invalid_transition",
    );

    // Legal edge, illegal timing (arrival is still a week away).
    await assert.rejects(
      transitionBooking({ bookingId: booking.id, to: BookingStatus.NO_SHOW }, staff),
      (error: unknown) => error instanceof TransitionError && error.code === "no_show_not_allowed",
    );
    await transitionBooking({ bookingId: booking.id, to: BookingStatus.CONFIRMED }, staff);
    await assert.rejects(
      transitionBooking({ bookingId: booking.id, to: BookingStatus.CHECKED_IN }, staff),
      (error: unknown) => error instanceof TransitionError && error.code === "check_in_not_allowed",
    );
  });

  it("room board: OCCUPIED must pass through CLEANING, never straight to AVAILABLE", async () => {
    const room = inventory.bySlug.get("family-room")!.rooms[1];
    const original = await prisma.room.findUniqueOrThrow({ where: { id: room.id } });
    try {
      await prisma.room.update({
        where: { id: room.id },
        data: { status: RoomStatus.OCCUPIED },
      });

      await assert.rejects(
        updateRoomStatus({ roomId: room.id, status: RoomStatus.AVAILABLE }, staff),
        (error: unknown) =>
          error instanceof TransitionError && error.code === "invalid_room_transition",
      );

      const cleaned = await updateRoomStatus({ roomId: room.id, status: RoomStatus.CLEANING }, staff);
      assert.equal(cleaned.status, RoomStatus.CLEANING);

      const ready = await updateRoomStatus({ roomId: room.id, status: RoomStatus.AVAILABLE }, staff);
      assert.equal(ready.status, RoomStatus.AVAILABLE);
    } finally {
      await prisma.room.update({
        where: { id: room.id },
        data: { status: original.status },
      });
    }
  });
});
