import { prisma } from "@/lib/prisma";
import { Prisma } from "@/generated/prisma/client";
import { parseDateOnly } from "@/server/availability/overlap";
import type { BookingSearchInput } from "@/server/console/validation";

/**
 * P7 reservation search — the front desk's "find that booking" query.
 *
 * `q` matches the reference, the guest name/e-mail or a room number; the other
 * filters compose with it. Date filters mean "overlaps the range"
 * (`check_in < to AND check_out > from`), the same half-open rule the
 * availability engine uses, so a stay that ends on `from` or starts on `to` is
 * correctly excluded.
 */

export type BookingListRow = {
  id: string;
  bookingReference: string;
  guestId: string;
  guestName: string;
  guestEmail: string | null;
  checkIn: string;
  checkOut: string;
  nights: number;
  adults: number;
  children: number;
  bookingStatus: string;
  paymentStatus: string;
  total: string;
  roomNumbers: string[];
  createdAt: string;
};

export type BookingSearchResult = {
  rows: BookingListRow[];
  total: number;
  page: number;
  pageSize: number;
};

function escapeLike(value: string) {
  return value.replace(/[\\%_]/g, (match) => `\\${match}`);
}

export async function searchBookings(input: BookingSearchInput): Promise<BookingSearchResult> {
  const conditions: Prisma.BookingWhereInput[] = [];

  const q = input.q?.trim();
  if (q) {
    const like = escapeLike(q);
    conditions.push({
      OR: [
        { bookingReference: { contains: like, mode: "insensitive" } },
        { guest: { firstName: { contains: like, mode: "insensitive" } } },
        { guest: { lastName: { contains: like, mode: "insensitive" } } },
        { guest: { email: { contains: like, mode: "insensitive" } } },
        { rooms: { some: { room: { roomNumber: { contains: like } } } } },
      ],
    });
  }
  if (input.status) conditions.push({ bookingStatus: input.status });
  if (input.paymentStatus) conditions.push({ paymentStatus: input.paymentStatus });

  const from = input.from ? parseDateOnly(input.from) : null;
  const to = input.to ? parseDateOnly(input.to) : null;
  if (from && to) {
    conditions.push({ checkIn: { lt: to }, checkOut: { gt: from } });
  } else if (from) {
    conditions.push({ checkOut: { gt: from } });
  } else if (to) {
    conditions.push({ checkIn: { lt: to } });
  }

  const where: Prisma.BookingWhereInput = conditions.length > 0 ? { AND: conditions } : {};

  const [total, bookings] = await Promise.all([
    prisma.booking.count({ where }),
    prisma.booking.findMany({
      where,
      orderBy: [{ checkIn: "asc" }, { createdAt: "desc" }],
      skip: (input.page - 1) * input.pageSize,
      take: input.pageSize,
      include: {
        guest: { select: { id: true, firstName: true, lastName: true, email: true } },
        rooms: { select: { room: { select: { roomNumber: true } }, nights: true } },
      },
    }),
  ]);

  return {
    total,
    page: input.page,
    pageSize: input.pageSize,
    rows: bookings.map((booking) => ({
      id: booking.id,
      bookingReference: booking.bookingReference,
      guestId: booking.guest.id,
      guestName: `${booking.guest.firstName} ${booking.guest.lastName}`,
      guestEmail: booking.guest.email,
      checkIn: booking.checkIn.toISOString().slice(0, 10),
      checkOut: booking.checkOut.toISOString().slice(0, 10),
      nights: booking.rooms[0]?.nights ?? 0,
      adults: booking.adults,
      children: booking.children,
      bookingStatus: booking.bookingStatus,
      paymentStatus: booking.paymentStatus,
      total: booking.total.toString(),
      roomNumbers: booking.rooms.map((line) => line.room.roomNumber),
      createdAt: booking.createdAt.toISOString(),
    })),
  };
}
