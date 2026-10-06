import "../../scripts/load-env";
import { describe, it, before, beforeEach } from "node:test";
import assert from "node:assert/strict";
import {
  BookingStatus,
  PaymentStatus,
  RecordStatus,
  RoomStatus,
} from "../../src/generated/prisma/enums";
import {
  ALLOW_SAME_DAY_TURNOVER,
  CHILDREN_COUNT_AS_ADULTS,
  PENDING_HOLD_MINUTES,
} from "../../src/config/availability";
import {
  AvailabilityConflictError,
  StayValidationError,
  assertRoomsAvailable,
  capacityFits,
  createPendingBooking,
  findAvailability,
} from "../../src/server/availability/service";
import {
  dateOnly,
  deleteTestBookings,
  ensureTestGuest,
  loadInventory,
  prisma,
  uniqRef,
} from "../helpers";

const PREFIX = "P4AVAIL-";

let guestId = "";
let inventory: Awaited<ReturnType<typeof loadInventory>>;

async function restoreRooms(rows: Array<{ id: string; status: RoomStatus }>) {
  for (const row of rows) {
    await prisma.room.update({ where: { id: row.id }, data: { status: row.status } });
  }
}

describe("availability engine (P4)", () => {
  before(async () => {
    assert.equal(
      ALLOW_SAME_DAY_TURNOVER,
      true,
      "these tests assume the default half-open rule (ALLOW_SAME_DAY_TURNOVER unset/false -> true)",
    );
    assert.equal(CHILDREN_COUNT_AS_ADULTS, false, "tests assume default children counting");
    guestId = await ensureTestGuest();
    inventory = await loadInventory();
  });

  beforeEach(async () => {
    await deleteTestBookings(PREFIX);
  });

  it("returns every active room type with its free rooms", async () => {
    const result = await findAvailability({
      checkIn: dateOnly("2027-03-01"),
      checkOut: dateOnly("2027-03-03"),
      adults: 2,
      children: 0,
    });

    assert.equal(result.hasAvailability, true);
    assert.equal(result.nights, 2);
    const slugs = result.roomTypes.map((type) => type.slug).sort();
    assert.deepEqual(slugs, ["deluxe-king", "executive-suite", "family-room"]);

    const deluxe = result.roomTypes.find((type) => type.slug === "deluxe-king")!;
    assert.equal(deluxe.totalRooms, 4);
    assert.equal(deluxe.availableCount, 4);
    assert.equal(deluxe.availableRooms.length, 4);
    assert.equal(typeof deluxe.basePrice, "string");
  });

  it("excludes room types that cannot fit the party", async () => {
    const threeAdults = await findAvailability({
      checkIn: dateOnly("2027-03-01"),
      checkOut: dateOnly("2027-03-03"),
      adults: 3,
      children: 0,
    });
    assert.deepEqual(threeAdults.roomTypes.map((type) => type.slug), ["family-room"]);

    const twoChildren = await findAvailability({
      checkIn: dateOnly("2027-03-01"),
      checkOut: dateOnly("2027-03-03"),
      adults: 2,
      children: 2,
    });
    assert.deepEqual(
      twoChildren.roomTypes.map((type) => type.slug).sort(),
      ["executive-suite", "family-room"],
    );

    // Occupancy counting itself (docs/OPEN_QUESTIONS.md #15, config-controlled).
    assert.equal(capacityFits({ maxAdults: 2, maxChildren: 2 }, 1, 2), true);
    assert.equal(capacityFits({ maxAdults: 2, maxChildren: 2 }, 1, 2, { childrenCountAsAdults: true }), false);
    assert.equal(capacityFits({ maxAdults: 2, maxChildren: 2 }, 2, 0, { childrenCountAsAdults: true }), true);
  });

  it("excludes inactive room types", async () => {
    const deluxe = inventory.bySlug.get("deluxe-king")!;
    await prisma.roomType.update({ where: { id: deluxe.id }, data: { status: RecordStatus.INACTIVE } });
    try {
      const result = await findAvailability({
        checkIn: dateOnly("2027-03-01"),
        checkOut: dateOnly("2027-03-03"),
        adults: 2,
        children: 0,
      });
      assert.ok(!result.roomTypes.some((type) => type.slug === "deluxe-king"));

      await assert.rejects(
        assertRoomsAvailable(prisma, { checkIn: dateOnly("2027-03-01"), checkOut: dateOnly("2027-03-03"), adults: 2, children: 0 }, [deluxe.rooms[0].id]),
        (error: unknown) =>
          error instanceof AvailabilityConflictError && error.reason === "room_type_inactive",
      );
    } finally {
      await prisma.roomType.update({ where: { id: deluxe.id }, data: { status: RecordStatus.ACTIVE } });
    }
  });

  it("excludes Maintenance and OutOfService rooms", async () => {
    const deluxe = inventory.bySlug.get("deluxe-king")!;
    const [first, second] = deluxe.rooms;
    const original = [first, second].map((room) => ({ id: room.id, status: room.status }));
    await prisma.room.update({ where: { id: first.id }, data: { status: RoomStatus.MAINTENANCE } });
    await prisma.room.update({ where: { id: second.id }, data: { status: RoomStatus.OUT_OF_SERVICE } });
    try {
      const result = await findAvailability({
        checkIn: dateOnly("2027-03-01"),
        checkOut: dateOnly("2027-03-03"),
        adults: 2,
        children: 0,
      });
      const deluxeResult = result.roomTypes.find((type) => type.slug === "deluxe-king")!;
      assert.equal(deluxeResult.totalRooms, 4);
      assert.equal(deluxeResult.availableCount, 2);
      assert.deepEqual(
        deluxeResult.availableRooms.map((room) => room.roomNumber),
        ["103", "104"],
      );

      await assert.rejects(
        assertRoomsAvailable(
          prisma,
          { checkIn: dateOnly("2027-03-01"), checkOut: dateOnly("2027-03-03"), adults: 2, children: 0 },
          [first.id],
        ),
        (error: unknown) =>
          error instanceof AvailabilityConflictError && error.reason === "room_unavailable",
      );
    } finally {
      await restoreRooms(original);
    }
  });

  it("hides a room allocated to an overlapping booking, keeps back-to-back dates free", async () => {
    const deluxe = inventory.bySlug.get("deluxe-king")!;
    const room = deluxe.rooms[0];
    await createPendingBooking({
      guestId,
      bookingReference: uniqRef(PREFIX),
      checkIn: dateOnly("2027-03-01"),
      checkOut: dateOnly("2027-03-05"),
      adults: 2,
      children: 0,
      rooms: [{ roomId: room.id, nightlyRate: 450 }],
    });

    const free = async (checkIn: string, checkOut: string) => {
      const result = await findAvailability({
        checkIn: dateOnly(checkIn),
        checkOut: dateOnly(checkOut),
        adults: 2,
        children: 0,
      });
      const deluxeResult = result.roomTypes.find((type) => type.slug === "deluxe-king")!;
      return deluxeResult.availableRooms.some((candidate) => candidate.id === room.id);
    };

    assert.equal(await free("2027-03-01", "2027-03-03"), false, "same window must be taken");
    assert.equal(await free("2027-02-27", "2027-03-02"), false, "overlapping arrival must be taken");
    assert.equal(await free("2027-03-04", "2027-03-07"), false, "overlapping departure must be taken");
    assert.equal(await free("2027-03-05", "2027-03-07"), true, "back-to-back arrival is legal");
    assert.equal(await free("2027-02-25", "2027-02-27"), true, "earlier stay is untouched");
  });

  it("allows a back-to-back allocation of the same room (half-open nights)", async () => {
    const deluxe = inventory.bySlug.get("deluxe-king")!;
    const room = deluxe.rooms[0];

    const first = await createPendingBooking({
      guestId,
      bookingReference: uniqRef(PREFIX),
      checkIn: dateOnly("2027-03-01"),
      checkOut: dateOnly("2027-03-05"),
      adults: 2,
      children: 0,
      rooms: [{ roomId: room.id, nightlyRate: 450 }],
    });
    const second = await createPendingBooking({
      guestId,
      bookingReference: uniqRef(PREFIX),
      checkIn: dateOnly("2027-03-05"),
      checkOut: dateOnly("2027-03-08"),
      adults: 2,
      children: 0,
      rooms: [{ roomId: room.id, nightlyRate: 450 }],
    });

    assert.notEqual(first.booking.id, second.booking.id);
    const nights = await prisma.roomNight.findMany({
      where: {
        roomId: room.id,
        night: { gte: dateOnly("2027-03-01"), lt: dateOnly("2027-03-08") },
      },
    });
    assert.equal(nights.length, 7, "4 + 3 nights, no shared night");
    assert.equal(new Set(nights.map((row) => row.night.getTime())).size, 7);
  });

  it("reports a sold-out type as eligible with zero rooms (the no-rooms edge case)", async () => {
    const suite = inventory.bySlug.get("executive-suite")!;
    await createPendingBooking({
      guestId,
      bookingReference: uniqRef(PREFIX),
      checkIn: dateOnly("2027-03-01"),
      checkOut: dateOnly("2027-03-03"),
      adults: 2,
      children: 0,
      rooms: suite.rooms.map((room) => ({ roomId: room.id, nightlyRate: 850 })),
    });

    const result = await findAvailability({
      checkIn: dateOnly("2027-03-01"),
      checkOut: dateOnly("2027-03-03"),
      adults: 2,
      children: 0,
    });
    const suiteResult = result.roomTypes.find((type) => type.slug === "executive-suite")!;
    assert.equal(suiteResult.availableCount, 0);
    assert.deepEqual(suiteResult.availableRooms, []);
    assert.equal(result.hasAvailability, true, "other types still have rooms");

    const exhausted = await findAvailability({
      checkIn: dateOnly("2027-03-15"),
      checkOut: dateOnly("2027-03-17"),
      adults: 4,
      children: 2,
    });
    void exhausted; // capacity filter only; the all-rooms-blocked case is next
  });

  it("every room in maintenance means no availability at all", async () => {
    const rooms = inventory.roomTypes.flatMap((type) => type.rooms);
    const original = rooms.map((room) => ({ id: room.id, status: room.status }));
    for (const room of rooms) {
      await prisma.room.update({ where: { id: room.id }, data: { status: RoomStatus.MAINTENANCE } });
    }
    try {
      const result = await findAvailability({
        checkIn: dateOnly("2027-03-15"),
        checkOut: dateOnly("2027-03-17"),
        adults: 2,
        children: 0,
      });
      assert.equal(result.hasAvailability, false);
      assert.equal(result.availableRoomCount, 0);
      for (const type of result.roomTypes) {
        assert.equal(type.availableCount, 0);
      }
    } finally {
      await restoreRooms(original);
    }
  });

  it("cancelling a booking releases its nights in the database (trigger)", async () => {
    const deluxe = inventory.bySlug.get("deluxe-king")!;
    const room = deluxe.rooms[0];
    const booking = await createPendingBooking({
      guestId,
      bookingReference: uniqRef(PREFIX),
      checkIn: dateOnly("2027-03-01"),
      checkOut: dateOnly("2027-03-05"),
      adults: 2,
      children: 0,
      rooms: [{ roomId: room.id, nightlyRate: 450 }],
    });

    const before = await prisma.roomNight.count({ where: { bookingId: booking.booking.id } });
    assert.equal(before, 4);

    await prisma.booking.update({
      where: { id: booking.booking.id },
      data: { bookingStatus: BookingStatus.CANCELLED },
    });

    const after = await prisma.roomNight.count({ where: { bookingId: booking.booking.id } });
    assert.equal(after, 0, "the bookings trigger must delete the night rows");

    const result = await findAvailability({
      checkIn: dateOnly("2027-03-01"),
      checkOut: dateOnly("2027-03-03"),
      adults: 2,
      children: 0,
    });
    const deluxeResult = result.roomTypes.find((type) => type.slug === "deluxe-king")!;
    assert.ok(deluxeResult.availableRooms.some((candidate) => candidate.id === room.id));
  });

  it("unpaid Pending holds block inside the window, free after expiry; PAID never expires", async () => {
    const deluxe = inventory.bySlug.get("deluxe-king")!;
    const [roomA, roomB] = deluxe.rooms;
    const expiredAt = new Date(Date.now() - (PENDING_HOLD_MINUTES + 5) * 60_000);

    const search = async (roomNumber: string, checkIn: string, checkOut: string) => {
      const result = await findAvailability({
        checkIn: dateOnly(checkIn),
        checkOut: dateOnly(checkOut),
        adults: 2,
        children: 0,
      });
      const deluxeResult = result.roomTypes.find((type) => type.slug === "deluxe-king")!;
      const room = deluxeResult.availableRooms.find((candidate) => candidate.roomNumber === roomNumber);
      return Boolean(room);
    };

    const bookingA = await createPendingBooking({
      guestId,
      bookingReference: uniqRef(PREFIX),
      checkIn: dateOnly("2027-03-08"),
      checkOut: dateOnly("2027-03-10"),
      adults: 2,
      children: 0,
      rooms: [{ roomId: roomA.id, nightlyRate: 450 }],
    });
    assert.equal(await search(roomA.roomNumber, "2027-03-08", "2027-03-10"), false, "fresh hold blocks");

    await prisma.booking.update({
      where: { id: bookingA.booking.id },
      data: { createdAt: expiredAt },
    });
    assert.equal(
      await search(roomA.roomNumber, "2027-03-08", "2027-03-10"),
      true,
      "expired hold no longer blocks",
    );

    // The next allocation sweeps the stale nights and reuses the room.
    const bookingB = await createPendingBooking({
      guestId,
      bookingReference: uniqRef(PREFIX),
      checkIn: dateOnly("2027-03-08"),
      checkOut: dateOnly("2027-03-10"),
      adults: 2,
      children: 0,
      rooms: [{ roomId: roomA.id, nightlyRate: 450 }],
    });
    assert.ok(bookingB.booking.id);

    // A Pending booking with money committed is never released, however old.
    const bookingC = await createPendingBooking({
      guestId,
      bookingReference: uniqRef(PREFIX),
      checkIn: dateOnly("2027-03-11"),
      checkOut: dateOnly("2027-03-13"),
      adults: 2,
      children: 0,
      rooms: [{ roomId: roomB.id, nightlyRate: 450 }],
    });
    await prisma.booking.update({
      where: { id: bookingC.booking.id },
      data: { createdAt: expiredAt, paymentStatus: PaymentStatus.PAID },
    });
    assert.equal(
      await search(roomB.roomNumber, "2027-03-11", "2027-03-13"),
      false,
      "paid pending never frees inventory",
    );
    await assert.rejects(
      createPendingBooking({
        guestId,
        bookingReference: uniqRef(PREFIX),
        checkIn: dateOnly("2027-03-11"),
        checkOut: dateOnly("2027-03-13"),
        adults: 2,
        children: 0,
        rooms: [{ roomId: roomB.id, nightlyRate: 450 }],
      }),
      (error: unknown) =>
        error instanceof AvailabilityConflictError && error.reason === "stay_overlap",
    );
  });

  it("assertRoomsAvailable reports overlap, missing rooms and capacity with the offending ids", async () => {
    const deluxe = inventory.bySlug.get("deluxe-king")!;
    const room = deluxe.rooms[0];
    const request = {
      checkIn: dateOnly("2027-03-01"),
      checkOut: dateOnly("2027-03-05"),
      adults: 2,
      children: 0,
    };

    await assert.rejects(
      assertRoomsAvailable(prisma, request, ["00000000-0000-0000-0000-000000000000"]),
      (error: unknown) =>
        error instanceof AvailabilityConflictError && error.reason === "room_not_found",
    );
    await assert.rejects(
      assertRoomsAvailable(prisma, { ...request, adults: 3 }, [room.id]),
      (error: unknown) =>
        error instanceof AvailabilityConflictError && error.reason === "capacity_exceeded",
    );
    await assert.rejects(
      assertRoomsAvailable(prisma, request, []),
      (error: unknown) =>
        error instanceof AvailabilityConflictError && error.reason === "room_not_found",
    );

    // Free rooms pass the check...
    await assertRoomsAvailable(prisma, request, [room.id]);

    const booking = await createPendingBooking({
      guestId,
      bookingReference: uniqRef(PREFIX),
      checkIn: dateOnly("2027-03-01"),
      checkOut: dateOnly("2027-03-05"),
      adults: 2,
      children: 0,
      rooms: [{ roomId: room.id, nightlyRate: 450 }],
    });

    // ...an allocated room does not...
    await assert.rejects(
      assertRoomsAvailable(prisma, request, [room.id]),
      (error: unknown) =>
        error instanceof AvailabilityConflictError &&
        error.reason === "stay_overlap" &&
        error.roomIds.includes(room.id),
    );

    // ...unless the caller is that very booking (modify flow).
    await assertRoomsAvailable(prisma, request, [room.id], {
      excludeBookingId: booking.booking.id,
    });
  });

  it("rejects invalid stays before touching the database", async () => {
    await assert.rejects(
      findAvailability({
        checkIn: dateOnly("2027-03-03"),
        checkOut: dateOnly("2027-03-03"),
        adults: 1,
        children: 0,
      }),
      (error: unknown) =>
        error instanceof StayValidationError && error.code === "invalid_date_range",
    );
    await assert.rejects(
      findAvailability({
        checkIn: dateOnly("2027-03-01"),
        checkOut: dateOnly("2027-03-03"),
        adults: 0,
        children: 0,
      }),
      (error: unknown) => error instanceof StayValidationError && error.code === "invalid_occupancy",
    );
    await assert.rejects(
      findAvailability({
        checkIn: dateOnly("2027-01-01"),
        checkOut: dateOnly("2027-03-15"),
        adults: 1,
        children: 0,
      }),
      (error: unknown) => error instanceof StayValidationError && error.code === "stay_too_long",
    );
    await assert.rejects(
      createPendingBooking({
        guestId,
        bookingReference: uniqRef(PREFIX),
        checkIn: dateOnly("2027-03-03"),
        checkOut: dateOnly("2027-03-01"),
        adults: 1,
        children: 0,
        rooms: [{ roomId: inventory.bySlug.get("deluxe-king")!.rooms[0].id, nightlyRate: 450 }],
      }),
      (error: unknown) => error instanceof StayValidationError,
    );
  });
});
