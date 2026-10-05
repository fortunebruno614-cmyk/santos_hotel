import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { guardGuestApi } from "@/server/auth/api";

type Params = { params: Promise<{ id: string }> };

/**
 * Booking detail for the signed-in guest.
 *
 * Ownership is part of the query, not a check afterwards: a booking that belongs
 * to somebody else is filtered out exactly like one that does not exist (404),
 * so this endpoint can never be used to probe for other guests' reservations.
 */
export async function GET(_request: Request, { params }: Params) {
  const auth = await guardGuestApi("/api/account/bookings/:id");
  if (auth instanceof NextResponse) return auth;

  const { id } = await params;

  const booking = await prisma.booking.findFirst({
    where: { id, guestId: auth.guestId! },
    select: {
      id: true,
      bookingReference: true,
      checkIn: true,
      checkOut: true,
      adults: true,
      children: true,
      total: true,
      bookingStatus: true,
      paymentStatus: true,
      notes: true,
      rooms: {
        select: {
          roomId: true,
          nights: true,
          nightlyRate: true,
          roomTotal: true,
          room: { select: { roomNumber: true, roomTypeId: true } },
        },
      },
    },
  });

  if (!booking) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  return NextResponse.json(booking);
}
