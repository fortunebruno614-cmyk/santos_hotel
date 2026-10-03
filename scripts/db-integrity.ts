import "./load-env";
import { prisma } from "../src/lib/prisma";

type Result = { name: string; ok: boolean; detail: string };

const results: Result[] = [];

async function expectFailure(name: string, fn: () => Promise<unknown>) {
  try {
    await fn();
    results.push({ name, ok: false, detail: "expected failure, but it succeeded" });
  } catch (error) {
    results.push({ name, ok: true, detail: firstLine(error) });
  }
}

async function expectSuccess(name: string, fn: () => Promise<unknown>) {
  try {
    await fn();
    results.push({ name, ok: true, detail: "ok" });
  } catch (error) {
    results.push({ name, ok: false, detail: firstLine(error) });
  }
}

function firstLine(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error);
  return (
    message
      .split("\n")
      .map((line) => line.trim())
      .find((line) => line.length > 0) ?? "failed as expected"
  );
}

async function main() {
  const hotel = await prisma.hotel.findFirst();
  const roomType = await prisma.roomType.findFirst({ where: { slug: "deluxe-king" }, include: { rooms: true } });
  const room = roomType?.rooms[0];

  if (!hotel || !roomType || !room) {
    throw new Error("Seed data missing. Run `npm run db:seed` before the integrity check.");
  }

  const [roomTypeCount, roomCount] = await Promise.all([
    prisma.roomType.count(),
    prisma.room.count(),
  ]);
  results.push({
    name: "seed data present",
    ok: roomTypeCount >= 3 && roomCount >= 9,
    detail: `${roomTypeCount} room types, ${roomCount} rooms`,
  });

  // Unique constraints
  await expectFailure("rooms.room_number unique", () =>
    prisma.room.create({
      data: { roomTypeId: roomType.id, roomNumber: room.roomNumber, floor: 1 },
    }),
  );

  // Foreign keys
  await expectFailure("bookings.guest_id FK enforced", () =>
    prisma.booking.create({
      data: {
        bookingReference: `INTEGRITY-FK-${Date.now()}`,
        guestId: "00000000-0000-0000-0000-000000000000",
        checkIn: new Date("2026-03-01"),
        checkOut: new Date("2026-03-03"),
      },
    }),
  );

  // Deletion behavior
  await expectFailure("room_types delete restricted while rooms exist", () =>
    prisma.roomType.delete({ where: { id: roomType.id } }),
  );

  // Transactional snapshots + composite uniqueness
  const guest = await prisma.guest.create({
    data: { firstName: "Integrity", lastName: "Check", email: `integrity-${Date.now()}@example.com` },
  });

  let bookingId: string | undefined;

  try {
    // Check constraints
    await expectFailure("bookings check_out > check_in", () =>
      prisma.booking.create({
        data: {
          bookingReference: `INTEGRITY-DATES-${Date.now()}`,
          guestId: guest.id,
          checkIn: new Date("2026-03-05"),
          checkOut: new Date("2026-03-05"),
        },
      }),
    );

    await expectFailure("promotions end_at > start_at", () =>
      prisma.promotion.create({
        data: {
          code: `INTEGRITY-PROMO-${Date.now()}`,
          type: "PERCENTAGE",
          value: 5,
          startAt: new Date("2026-12-31T00:00:00Z"),
          endAt: new Date("2026-01-01T00:00:00Z"),
        },
      }),
    );

    const booking = await prisma.booking.create({
      data: {
        bookingReference: `INTEGRITY-${Date.now()}`,
        guestId: guest.id,
        checkIn: new Date("2026-04-01"),
        checkOut: new Date("2026-04-03"),
        adults: 2,
        subtotal: 900,
        total: 900,
      },
    });
    bookingId = booking.id;

    await expectSuccess("booking + booking_room creation", () =>
      prisma.bookingRoom.create({
        data: {
          bookingId: booking.id,
          roomId: room.id,
          nightlyRate: 450,
          nights: 2,
          roomTotal: 900,
        },
      }),
    );

    await expectFailure("booking_rooms unique (booking_id, room_id)", () =>
      prisma.bookingRoom.create({
        data: {
          bookingId: booking.id,
          roomId: room.id,
          nightlyRate: 450,
          nights: 2,
          roomTotal: 900,
        },
      }),
    );

    await expectFailure("bookings.booking_reference unique", () =>
      prisma.booking.create({
        data: {
          bookingReference: booking.bookingReference,
          guestId: guest.id,
          checkIn: new Date("2026-05-01"),
          checkOut: new Date("2026-05-02"),
        },
      }),
    );

    await expectFailure("payments refunded_amount <= amount", () =>
      prisma.payment.create({
        data: {
          bookingId: booking.id,
          provider: "test",
          amount: 100,
          refundedAmount: 150,
        },
      }),
    );

    const historicalRate = await prisma.bookingRoom.findFirst({
      where: { bookingId: booking.id },
    });
    results.push({
      name: "historical nightly_rate snapshot stored",
      ok: historicalRate?.nightlyRate.toFixed(2) === "450.00",
      detail: `nightly_rate=${historicalRate?.nightlyRate.toFixed(2)}`,
    });
  } finally {
    if (bookingId) {
      await prisma.booking.delete({ where: { id: bookingId } }).catch(() => undefined);
    }
    await prisma.guest.delete({ where: { id: guest.id } }).catch(() => undefined);
  }

  const failed = results.filter((r) => !r.ok);
  for (const result of results) {
    console.log(`${result.ok ? "PASS" : "FAIL"}  ${result.name} — ${result.detail}`);
  }
  console.log(`\n${results.length - failed.length}/${results.length} integrity checks passed.`);

  if (failed.length > 0) {
    process.exitCode = 1;
  }
}

main()
  .catch((error) => {
    console.error("Integrity check failed to run:", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
