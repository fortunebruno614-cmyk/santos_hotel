import "./load-env";
import { prisma } from "../src/lib/prisma";
import { hashPassword } from "../src/server/auth/crypto";

const GUEST_A_EMAIL = "guest@santohotel.test";
const GUEST_A_PASSWORD = "Guest123!";
const GUEST_B_EMAIL = "guest2@santohotel.test";
const GUEST_B_PASSWORD = "Guest123!";

async function ensureGuest(email: string, firstName: string, lastName: string, password: string) {
  const passwordHash = await hashPassword(password);
  const existing = await prisma.guest.findUnique({ where: { email } });
  if (existing) {
    await prisma.guest.update({ where: { id: existing.id }, data: { passwordHash, isActive: true } });
    return existing.id;
  }
  const created = await prisma.guest.create({
    data: { firstName, lastName, email, passwordHash },
  });
  return created.id;
}

/**
 * Every guest in the gate gets exactly one booking. The isolation check needs
 * BOTH guests to own data — an empty list for guest B would prove nothing.
 */
async function ensureBooking(guestId: string, bookingReference: string, checkIn: string, checkOut: string) {
  const existing = await prisma.booking.findFirst({ where: { guestId } });
  if (existing) return existing;

  return prisma.booking.create({
    data: {
      bookingReference,
      guestId,
      checkIn: new Date(checkIn),
      checkOut: new Date(checkOut),
      adults: 1,
      children: 0,
      subtotal: 900,
      taxes: 0,
      fees: 0,
      discount: 0,
      total: 900,
      bookingStatus: "CONFIRMED",
      paymentStatus: "PENDING",
    },
  });
}

async function main() {
  const guestAId = await ensureGuest(GUEST_A_EMAIL, "Gina", "Guest", GUEST_A_PASSWORD);
  const guestBId = await ensureGuest(GUEST_B_EMAIL, "Bobby", "Second", GUEST_B_PASSWORD);

  const bookingA = await ensureBooking(guestAId, "SH-2026-900001", "2026-11-01", "2026-11-03");
  const bookingB = await ensureBooking(guestBId, "SH-2026-900002", "2026-11-10", "2026-11-12");

  console.log(
    `Fixtures OK: ${GUEST_A_EMAIL} -> ${bookingA.bookingReference}, ${GUEST_B_EMAIL} -> ${bookingB.bookingReference}.`,
  );
}

main()
  .catch((error) => {
    console.error("Fixture seeding failed:", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
    process.exit();
  });
