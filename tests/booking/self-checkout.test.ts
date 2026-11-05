import "../../scripts/load-env";
import { describe, it, before, beforeEach } from "node:test";
import assert from "node:assert/strict";
import {
  BookingStatus,
  PaymentStatus,
  PromotionType,
  RecordStatus,
  RoomStatus,
} from "../../src/generated/prisma/enums";
import {
  BookingError,
  createBooking as rawCreateBooking,
  guestSelfCheckOut,
  transitionBooking as rawTransitionBooking,
  type StaffActor,
} from "../../src/server/booking/service";
import { TransitionError } from "../../src/server/booking/policy";
import { inspectPromotion } from "../../src/server/pricing/service";
import { hotelToday, requireHotelContext } from "../../src/server/pricing/context";
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

/**
 * Guest express self check-out (the AI concierge's `check_out_stay`) and the
 * promotion inspection behind `check_discount` — both are thin guards over
 * services the console already uses, so the tests pin the *extra* rules:
 * ownership, in-house status, the balance guard, and promo validity.
 */

let inventory: Awaited<ReturnType<typeof loadInventory>>;
let guestId = "";
let otherGuestId = "";
let hotelId = "";
let organizationId = "";
let staff: StaffActor;

const createBooking = (
  input: Omit<Parameters<typeof rawCreateBooking>[0], "hotelId">,
  actor: Parameters<typeof rawCreateBooking>[1],
) => rawCreateBooking({ ...input, hotelId }, actor);

const transitionBooking = (
  input: Parameters<typeof rawTransitionBooking>[0],
  actor: Parameters<typeof rawTransitionBooking>[1],
) =>
  rawTransitionBooking(input, { ...actor, organizationId, organizationWide: true } as StaffActor);

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
      guest: { firstName: "P5", lastName: "SelfCheckout", email: `selfco${BOOKING_TEST_SUFFIX}` },
    },
    { kind: "guest", guestId: guest },
  );
}

/** PENDING → CONFIRMED → CHECKED_IN, i.e. a guest physically in house. */
async function checkInStay(roomId: string) {
  const context = await requireHotelContext(hotelId);
  const today = hotelToday(new Date(), context.timezone);
  const booking = await createStay(roomId, today, addDays(today, 2));
  await transitionBooking({ bookingId: booking.id, to: BookingStatus.CONFIRMED }, staff);
  await transitionBooking({ bookingId: booking.id, to: BookingStatus.CHECKED_IN }, staff);
  return booking;
}

describe("guest express self check-out", () => {
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
      data: { firstName: "P5", lastName: "SelfCheckout", email: `selfco${BOOKING_TEST_SUFFIX}` },
    });
    guestId = guest.id;
    const other = await prisma.guest.create({
      data: {
        firstName: "Other",
        lastName: "SelfCheckout",
        email: `selfco-other${BOOKING_TEST_SUFFIX}`,
      },
    });
    otherGuestId = other.id;
  });

  beforeEach(async () => {
    await prisma.booking.deleteMany({
      where: { guest: { email: { endsWith: BOOKING_TEST_SUFFIX } } },
    });
  });

  it("checks the guest out of their own in-house stay and releases the room", async () => {
    const room = inventory.bySlug.get("executive-suite")!.rooms[0];
    const original = await prisma.room.findUniqueOrThrow({ where: { id: room.id } });
    try {
      const booking = await checkInStay(room.id);
      await prisma.booking.update({
        where: { id: booking.id },
        data: { paymentStatus: PaymentStatus.PAID },
      });

      const summary = await guestSelfCheckOut({
        bookingId: booking.id,
        guestId,
        note: "late check-out approved",
      });

      assert.equal(summary.bookingStatus, BookingStatus.CHECKED_OUT);
      assert.ok(summary.notes?.includes("late check-out approved"), "note is appended");

      const roomRow = await prisma.room.findUnique({ where: { id: room.id } });
      assert.equal(roomRow?.status, RoomStatus.CLEANING, "the occupied room goes to housekeeping");

      const audit = await prisma.auditLog.findFirst({
        where: { entityId: booking.id, action: "booking.transition" },
        orderBy: { createdAt: "desc" },
      });
      assert.equal(audit?.actorType, "guest", "the action is attributed to the guest");
      assert.equal(audit?.actorGuestId, guestId);
    } finally {
      await prisma.booking.deleteMany({
        where: { guest: { email: { endsWith: BOOKING_TEST_SUFFIX } } },
      });
      await prisma.room.update({ where: { id: room.id }, data: { status: original.status } });
    }
  });

  it("never checks out another guest's reservation (404 semantics)", async () => {
    const room = inventory.bySlug.get("executive-suite")!.rooms[1];
    const booking = await checkInStay(room.id);
    await prisma.booking.update({
      where: { id: booking.id },
      data: { paymentStatus: PaymentStatus.PAID },
    });

    await assert.rejects(
      guestSelfCheckOut({ bookingId: booking.id, guestId: otherGuestId }),
      (error: unknown) => error instanceof BookingError && error.code === "booking_not_found",
    );

    const fresh = await prisma.booking.findUnique({ where: { id: booking.id } });
    assert.equal(fresh?.bookingStatus, BookingStatus.CHECKED_IN, "the stay is untouched");

    await prisma.room.update({ where: { id: room.id }, data: { status: RoomStatus.AVAILABLE } });
  });

  it("blocks check-out while a balance is due, then allows it once settled", async () => {
    const room = inventory.bySlug.get("executive-suite")!.rooms[2];
    const booking = await checkInStay(room.id);

    await assert.rejects(
      guestSelfCheckOut({ bookingId: booking.id, guestId }),
      (error: unknown) => error instanceof BookingError && error.code === "balance_due",
    );

    await prisma.booking.update({
      where: { id: booking.id },
      data: { paymentStatus: PaymentStatus.PAID },
    });
    const summary = await guestSelfCheckOut({ bookingId: booking.id, guestId });
    assert.equal(summary.bookingStatus, BookingStatus.CHECKED_OUT);

    await prisma.room.update({ where: { id: room.id }, data: { status: RoomStatus.AVAILABLE } });
  });

  it("refuses before the stay begins", async () => {
    const room = inventory.bySlug.get("family-room")!.rooms[0];
    const context = await requireHotelContext(hotelId);
    const today = hotelToday(new Date(), context.timezone);
    const booking = await createStay(room.id, addDays(today, 7), addDays(today, 9));
    await transitionBooking({ bookingId: booking.id, to: BookingStatus.CONFIRMED }, staff);

    await assert.rejects(
      guestSelfCheckOut({ bookingId: booking.id, guestId }),
      (error: unknown) => error instanceof TransitionError && error.code === "invalid_transition",
    );
  });
});

describe("promotion inspection (chat discount check)", () => {
  let hotelIdLocal = "";

  before(async () => {
    hotelIdLocal = await testHotelId();
  });

  it("accepts a live code, rejects an unknown one", async () => {
    const code = `CHAT${Date.now().toString(36).toUpperCase()}`;
    const promo = await prisma.promotion.create({
      data: {
        hotelId: hotelIdLocal,
        code,
        type: PromotionType.PERCENTAGE,
        value: 10,
        startAt: new Date(Date.now() - 86_400_000),
        endAt: new Date(Date.now() + 86_400_000),
        status: RecordStatus.ACTIVE,
      },
    });

    try {
      const valid = await inspectPromotion(hotelIdLocal, code.toLowerCase());
      assert.equal(valid.valid, true);
      if (valid.valid) {
        assert.equal(valid.code, code, "the stored code is echoed back");
        assert.equal(Number(valid.value), 10);
      }

      const missing = await inspectPromotion(hotelIdLocal, "NO-SUCH-CODE");
      assert.equal(missing.valid, false);
      if (!missing.valid) assert.equal(missing.reason, "promotion_not_found");

      const expired = await inspectPromotion(hotelIdLocal, code, new Date(Date.now() + 172_800_000));
      assert.equal(expired.valid, false);
      if (!expired.valid) assert.equal(expired.reason, "promotion_expired");
    } finally {
      await prisma.promotion.delete({ where: { id: promo.id } });
    }
  });
});
