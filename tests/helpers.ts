import "../scripts/load-env";
import { randomBytes } from "node:crypto";
import { prisma } from "../src/lib/prisma";
import { parseDateOnly } from "../src/server/availability/overlap";
import { RoomStatus } from "../src/generated/prisma/enums";

export { prisma };

/** UTC-midnight date-only value (the representation every @db.Date column uses). */
export function dateOnly(iso: string): Date {
  const date = parseDateOnly(iso);
  if (!date) throw new Error(`bad test date: ${iso}`);
  return date;
}

/** Unique booking reference for test rows; the prefix scopes cleanup. */
export function uniqRef(prefix: string): string {
  return `${prefix}-${Date.now().toString(36)}-${randomBytes(3).toString("hex")}`;
}

export async function ensureTestGuest(): Promise<string> {
  const email = "p4-tests@santohotel.test";
  const existing = await prisma.guest.findUnique({ where: { email } });
  if (existing) return existing.id;
  const created = await prisma.guest.create({
    data: { firstName: "P4", lastName: "Tests", email },
  });
  return created.id;
}

/** Removes every booking created under `prefix` (room_nights/booking_rooms cascade). */
export async function deleteTestBookings(prefix: string): Promise<number> {
  const result = await prisma.booking.deleteMany({
    where: { bookingReference: { startsWith: prefix } },
  });
  return result.count;
}

/**
 * P5 booking tests create rows through `createBooking`, which assigns its own
 * `SH-…` reference — cleanup therefore sweeps by the test guests' email suffix
 * (bookings first: the guest relation is Restrict).
 */
export const BOOKING_TEST_SUFFIX = "@p5.test";

export async function deleteTestBookingGuests(suffix: string = BOOKING_TEST_SUFFIX) {
  await prisma.booking.deleteMany({ where: { guest: { email: { endsWith: suffix } } } });
  await prisma.guest.deleteMany({ where: { email: { endsWith: suffix } } });
}

/** Staff actor for walk-in/transition/modify tests (same email suffix cleanup). */
export async function ensureTestStaffUser(): Promise<string> {
  const email = `p5-staff${BOOKING_TEST_SUFFIX}`;
  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) return existing.id;
  const created = await prisma.user.create({
    data: { name: "P5 Tests", email, passwordHash: "test-hash", role: "STAFF" },
  });
  return created.id;
}

export async function deleteTestStaffUser(suffix: string = BOOKING_TEST_SUFFIX) {
  await prisma.user.deleteMany({ where: { email: { endsWith: suffix } } });
}

/** Restores room statuses after a test mutated the housekeeping board. */
export async function restoreRooms(rows: Array<{ id: string; status: RoomStatus }>) {
  for (const row of rows) {
    await prisma.room.update({ where: { id: row.id }, data: { status: row.status } });
  }
}

/** Loads seeded inventory, failing fast when the dev DB has not been seeded. */
export async function loadInventory() {
  const roomTypes = await prisma.roomType.findMany({
    include: { rooms: { orderBy: { roomNumber: "asc" } } },
    orderBy: { name: "asc" },
  });
  if (roomTypes.length === 0) {
    throw new Error("Seed data missing. Run `npm run db:seed` before the tests.");
  }
  const bySlug = new Map(roomTypes.map((type) => [type.slug, type]));
  return { roomTypes, bySlug };
}
