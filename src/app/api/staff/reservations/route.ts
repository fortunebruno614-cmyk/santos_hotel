import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { guardApi } from "@/server/auth/api";
import { AppRole, Permissions } from "@/server/auth/roles";

export async function GET() {
  const auth = await guardApi({
    route: "/api/staff/reservations",
    roles: [AppRole.STAFF, AppRole.ADMIN],
    permission: Permissions.MANAGE_RESERVATIONS,
  });
  if (auth instanceof NextResponse) return auth;

  const reservations = await prisma.booking.findMany({
    take: 50,
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      bookingReference: true,
      guestId: true,
      checkIn: true,
      checkOut: true,
      bookingStatus: true,
      paymentStatus: true,
    },
  });

  return NextResponse.json(reservations);
}
