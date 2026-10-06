import "../../scripts/load-env";
import { describe, it, before, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { AvailabilityConflictError, createPendingBooking } from "../../src/server/availability/service";
import {
  dateOnly,
  deleteTestBookings,
  ensureTestGuest,
  loadInventory,
  prisma,
  uniqRef,
} from "../helpers";

const PREFIX = "P4CONC-";
const CHECK_IN = "2027-04-01";
const CHECK_OUT = "2027-04-04";

let guestId = "";
let familyRoomId = "";

describe("double-booking is impossible under concurrency (P4 gate)", () => {
  before(async () => {
    guestId = await ensureTestGuest();
    const inventory = await loadInventory();
    const family = inventory.bySlug.get("family-room");
    assert.ok(family && family.rooms.length >= 1, "seed must provide a family room");
    const last = family.rooms[family.rooms.length - 1];
    familyRoomId = last.id;

    // Sell every family room except the contended one for the test window.
    const others = family.rooms.slice(0, -1);
    assert.ok(others.length >= 1, "need at least two family rooms for the sellout setup");
    await createPendingBooking({
      guestId,
      bookingReference: uniqRef(PREFIX),
      checkIn: dateOnly(CHECK_IN),
      checkOut: dateOnly(CHECK_OUT),
      adults: 4,
      children: 0,
      rooms: others.map((room) => ({ roomId: room.id, nightlyRate: 620 })),
    });
  });

  beforeEach(async () => {
    await deleteTestBookings(PREFIX);
  });

  it("exactly one of six parallel allocations wins; the rest get AvailabilityConflictError", async () => {
    const attempt = () =>
      createPendingBooking({
        guestId,
        bookingReference: uniqRef(PREFIX),
        checkIn: dateOnly(CHECK_IN),
        checkOut: dateOnly(CHECK_OUT),
        adults: 2,
        children: 2,
        rooms: [{ roomId: familyRoomId, nightlyRate: 620 }],
      });

    const settled = await Promise.allSettled(Array.from({ length: 6 }, attempt));
    const wins = settled.filter((entry) => entry.status === "fulfilled");
    const losses = settled.filter((entry) => entry.status === "rejected");

    assert.equal(wins.length, 1, "exactly one allocation may win");
    assert.equal(losses.length, 5);
    for (const loss of losses) {
      assert.ok(
        loss.status === "rejected" &&
          loss.reason instanceof AvailabilityConflictError &&
          (loss.reason as AvailabilityConflictError).reason === "stay_overlap",
        "every loser must be an AvailabilityConflictError",
      );
    }

    // The database agrees: one holder of the contended nights.
    const nights = await prisma.roomNight.findMany({
      where: {
        roomId: familyRoomId,
        night: { gte: dateOnly(CHECK_IN), lt: dateOnly(CHECK_OUT) },
      },
      include: { booking: { select: { bookingReference: true } } },
    });
    assert.equal(nights.length, 3, "winner holds all three nights");
    assert.equal(new Set(nights.map((row) => row.bookingId)).size, 1, "one booking owns them");

    const holdings = await prisma.bookingRoom.count({
      where: { roomId: familyRoomId, booking: { bookingReference: { startsWith: PREFIX } } },
    });
    assert.equal(holdings, 1, "only the winner persisted a booking_rooms row");
  });

  it("the room_nights primary key rejects a duplicate night even outside the service", async () => {
    const booking = await createPendingBooking({
      guestId,
      bookingReference: uniqRef(PREFIX),
      checkIn: dateOnly(CHECK_IN),
      checkOut: dateOnly(CHECK_OUT),
      adults: 2,
      children: 2,
      rooms: [{ roomId: familyRoomId, nightlyRate: 620 }],
    });

    await assert.rejects(
      prisma.roomNight.create({
        data: {
          roomId: familyRoomId,
          bookingId: booking.booking.id,
          night: dateOnly(CHECK_IN),
        },
      }),
      (error: unknown) =>
        typeof error === "object" &&
        error !== null &&
        "code" in error &&
        (error as { code?: string }).code === "P2002",
    );
  });

  it("a second allocation against the winner's window fails after the first commits", async () => {
    await createPendingBooking({
      guestId,
      bookingReference: uniqRef(PREFIX),
      checkIn: dateOnly(CHECK_IN),
      checkOut: dateOnly(CHECK_OUT),
      adults: 2,
      children: 2,
      rooms: [{ roomId: familyRoomId, nightlyRate: 620 }],
    });
    await assert.rejects(
      createPendingBooking({
        guestId,
        bookingReference: uniqRef(PREFIX),
        checkIn: dateOnly(CHECK_IN),
        checkOut: dateOnly(CHECK_OUT),
        adults: 2,
        children: 2,
        rooms: [{ roomId: familyRoomId, nightlyRate: 620 }],
      }),
      (error: unknown) =>
        error instanceof AvailabilityConflictError && error.reason === "stay_overlap",
    );
  });
});
