import "../../scripts/load-env";
import { describe, it, before, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { BookingStatus, PaymentStatus } from "../../src/generated/prisma/enums";
import {
  BookingError,
  createBooking,
  type BookingActor,
} from "../../src/server/booking/service";
import { AvailabilityConflictError } from "../../src/server/availability/service";
import { computeQuote } from "../../src/server/pricing/service";
import { moneyString } from "../../src/server/pricing/model";
import {
  BOOKING_REFERENCE_REGEX,
  currentSequence,
  formatBookingReference,
  nextBookingReference,
  parseBookingReference,
} from "../../src/server/booking/reference";
import {
  BOOKING_TEST_SUFFIX,
  dateOnly,
  deleteTestBookingGuests,
  ensureTestStaffUser,
  loadInventory,
  prisma,
} from "../helpers";

/** P5 checkout gate: reference format, price re-validation, in-tx re-check. */

let inventory: Awaited<ReturnType<typeof loadInventory>>;
let staffId = "";
const guestEmail = `checkout${BOOKING_TEST_SUFFIX}`;

function guestActor(guestId: string): BookingActor {
  return { kind: "guest", guestId };
}

async function ensureGuest(email: string, firstName = "P5", lastName = "Checkout"): Promise<string> {
  const existing = await prisma.guest.findUnique({ where: { email } });
  if (existing) return existing.id;
  const created = await prisma.guest.create({ data: { firstName, lastName, email } });
  return created.id;
}

async function quotedTotal(roomIds: string[], checkIn: string, checkOut: string): Promise<string> {
  const quote = await computeQuote({
    checkIn: dateOnly(checkIn),
    checkOut: dateOnly(checkOut),
    adults: 2,
    children: 0,
    roomIds,
  });
  return moneyString(quote.snapshot.breakdown.total);
}

describe("P5 checkout", () => {
  before(async () => {
    inventory = await loadInventory();
    staffId = await ensureTestStaffUser();
  });

  beforeEach(async () => {
    await deleteTestBookingGuests();
  });

  it("creates a PENDING booking with an SH-YYYY-NNNNNN reference and exact price", async () => {
    const guestId = await ensureGuest(guestEmail);
    const room = inventory.bySlug.get("deluxe-king")!.rooms[0];
    const checkIn = "2027-07-01";
    const checkOut = "2027-07-04"; // 3 nights
    const expectedTotal = await quotedTotal([room.id], checkIn, checkOut);

    const booking = await createBooking(
      {
        checkIn,
        checkOut,
        adults: 2,
        children: 0,
        roomIds: [room.id],
        guest: { firstName: "P5", lastName: "Checkout", email: guestEmail },
        expectedTotal,
      },
      guestActor(guestId),
    );

    assert.match(booking.bookingReference, BOOKING_REFERENCE_REGEX);
    assert.equal(booking.bookingStatus, BookingStatus.PENDING);
    assert.equal(booking.paymentStatus, PaymentStatus.PENDING);
    assert.equal(booking.nights, 3);
    assert.equal(booking.breakdown.total, expectedTotal);
    assert.equal(booking.createdByUserId, null);
    assert.equal(booking.rooms.length, 1);
    assert.equal(booking.rooms[0].roomNumber, room.roomNumber);

    const nights = await prisma.roomNight.count({ where: { bookingId: booking.id } });
    assert.equal(nights, 3, "one row per charged night");
  });

  it("attaches the booking to an existing guest matched by email (no account access)", async () => {
    const guestId = await ensureGuest(guestEmail);
    const before = await prisma.guest.count({ where: { email: guestEmail } });
    const room = inventory.bySlug.get("deluxe-king")!.rooms[1];

    const booking = await createBooking(
      {
        checkIn: "2027-07-05",
        checkOut: "2027-07-07",
        adults: 2,
        children: 0,
        roomIds: [room.id],
        guest: { firstName: "Someone", lastName: "Else", email: guestEmail },
      },
      { kind: "anonymous" },
    );

    assert.equal(booking.guestId, guestId, "matched on email, not the payload name");
    const after = await prisma.guest.count({ where: { email: guestEmail } });
    assert.equal(after, before, "no duplicate guest row");
  });

  it("creates a fresh passwordless guest for an unknown email (anonymous checkout)", async () => {
    const email = `anon-${Date.now()}${BOOKING_TEST_SUFFIX}`;
    const room = inventory.bySlug.get("deluxe-king")!.rooms[2];

    const booking = await createBooking(
      {
        checkIn: "2027-07-08",
        checkOut: "2027-07-10",
        adults: 2,
        children: 0,
        roomIds: [room.id],
        guest: { firstName: "Walk", lastName: "In", email },
      },
      { kind: "anonymous" },
    );

    const guest = await prisma.guest.findUnique({ where: { email } });
    assert.ok(guest);
    assert.equal(booking.guestId, guest.id);
    assert.equal(guest.passwordHash, null, "bookings never create credentials");
  });

  it("refuses a checkout whose quoted total drifted (expectedTotal mismatch)", async () => {
    const guestId = await ensureGuest(guestEmail);
    const room = inventory.bySlug.get("deluxe-king")!.rooms[3];
    const total = await quotedTotal([room.id], "2027-07-11", "2027-07-13");
    const drifted = (Number(total) + 1).toFixed(2);
    const before = await prisma.booking.count({ where: { guestId } });

    await assert.rejects(
      createBooking(
        {
          checkIn: "2027-07-11",
          checkOut: "2027-07-13",
          adults: 2,
          children: 0,
          roomIds: [room.id],
          guest: { firstName: "P5", lastName: "Checkout", email: guestEmail },
          expectedTotal: drifted,
        },
        guestActor(guestId),
      ),
      (error: unknown) => error instanceof BookingError && error.code === "price_changed",
    );

    const after = await prisma.booking.count({ where: { guestId } });
    assert.equal(after, before, "nothing is stored when the price moved");
  });

  it("re-checks availability inside the transaction: the second checkout loses", async () => {
    const guestId = await ensureGuest(guestEmail);
    const otherEmail = `other-${Date.now()}${BOOKING_TEST_SUFFIX}`;
    const otherId = await ensureGuest(otherEmail, "Other", "Guest");
    const room = inventory.bySlug.get("executive-suite")!.rooms[0];

    await createBooking(
      {
        checkIn: "2027-07-14",
        checkOut: "2027-07-16",
        adults: 2,
        children: 0,
        roomIds: [room.id],
        guest: { firstName: "P5", lastName: "Checkout", email: guestEmail },
      },
      guestActor(guestId),
    );

    await assert.rejects(
      createBooking(
        {
          checkIn: "2027-07-14",
          checkOut: "2027-07-16",
          adults: 2,
          children: 0,
          roomIds: [room.id],
          guest: { firstName: "Other", lastName: "Guest", email: otherEmail },
        },
        guestActor(otherId),
      ),
      (error: unknown) =>
        error instanceof AvailabilityConflictError && error.reason === "stay_overlap",
    );
  });

  it("staff walk-ins may confirm at the desk and record who created them", async () => {
    await ensureGuest(guestEmail);
    const room = inventory.bySlug.get("family-room")!.rooms[0];

    const booking = await createBooking(
      {
        checkIn: "2027-07-17",
        checkOut: "2027-07-19",
        adults: 3,
        children: 1,
        roomIds: [room.id],
        guest: { firstName: "Desk", lastName: "Guest", email: guestEmail },
        confirm: true,
      },
      { kind: "staff", userId: staffId, email: "p5-staff" + BOOKING_TEST_SUFFIX },
    );

    assert.equal(booking.bookingStatus, BookingStatus.CONFIRMED);
    assert.equal(booking.createdByUserId, staffId);
  });

  it("refuses a stay that would start in the past", async () => {
    const guestId = await ensureGuest(guestEmail);
    const room = inventory.bySlug.get("deluxe-king")!.rooms[0];
    const yesterday = new Date(Date.now() - 86_400_000).toISOString().slice(0, 10);
    const today = new Date(Date.now()).toISOString().slice(0, 10);

    await assert.rejects(
      createBooking(
        {
          checkIn: yesterday,
          checkOut: today,
          adults: 2,
          children: 0,
          roomIds: [room.id],
          guest: { firstName: "P5", lastName: "Checkout", email: guestEmail },
        },
        guestActor(guestId),
      ),
      (error: unknown) => error instanceof BookingError && error.code === "check_in_past",
    );
  });

  it("generates SH-YYYY-NNNNNN references that advance and parse", async () => {
    assert.equal(formatBookingReference(2026, 1), "SH-2026-000001");
    assert.deepEqual(parseBookingReference("SH-2026-000042"), { year: 2026, sequence: 42 });
    assert.equal(parseBookingReference("P4AVAIL-x"), null);

    const year = new Date().getUTCFullYear();
    const before = await currentSequence(prisma, year);
    const next = await nextBookingReference(prisma);
    assert.match(next, BOOKING_REFERENCE_REGEX);
    assert.equal(next, formatBookingReference(year, before + 1));
  });
});
