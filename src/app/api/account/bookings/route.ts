import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { guardGuestApi } from "@/server/auth/api";

export async function GET() {
  const auth = await guardGuestApi("/api/account/bookings");
  if (auth instanceof NextResponse) return auth;

  // Scoped to the signed-in guest only — never accepts a guest id from input.
  const bookings = await prisma.booking.findMany({
    where: { guestId: auth.guestId! },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      bookingReference: true,
      checkIn: true,
      checkOut: true,
      total: true,
      bookingStatus: true,
      paymentStatus: true,
    },
  });

  return NextResponse.json(bookings);
}
