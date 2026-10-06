import "../scripts/load-env";
import { randomBytes } from "node:crypto";
import { prisma } from "../src/lib/prisma";
import { parseDateOnly } from "../src/server/availability/overlap";

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
