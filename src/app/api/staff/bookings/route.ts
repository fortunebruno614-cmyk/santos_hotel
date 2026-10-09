import { NextResponse } from "next/server";
import { BookingStatus } from "@/generated/prisma/enums";
import { prisma } from "@/lib/prisma";
import { guardApi } from "@/server/auth/api";
import { AppRole, Permissions } from "@/server/auth/roles";
import { createBooking, type StaffActor } from "@/server/booking/service";
import { StaffBookingSchema } from "@/server/booking/validation";
import { bookingErrorResponse, invalidBody } from "@/server/booking/http";

/**
 * Staff reservations (manual/walk-in bookings).
 *
 *   GET  /api/staff/bookings[?status=CONFIRMED]  — latest reservations
 *   POST /api/staff/bookings                     — phone/walk-in booking
 *
 * POST is the walk-in flow: same pricing, same availability transaction and the
 * same `SH-YYYY-NNNNNN` reference as online checkout, plus `created_by_user_id`
 * and an optional `confirm: true` for a guest paying at the desk. The actor
 * always comes from the session (MANAGE_RESERVATIONS).
 */
export async function GET(request: Request) {
  const auth = await guardApi({
    route: "/api/staff/bookings",
    roles: [AppRole.STAFF, AppRole.ADMIN],
    permission: Permissions.MANAGE_RESERVATIONS,
  });
  if (auth instanceof NextResponse) return auth;

  const statusParam = new URL(request.url).searchParams.get("status");
  const statusFilter =
    statusParam && (Object.values(BookingStatus) as string[]).includes(statusParam)
      ? (statusParam as BookingStatus)
      : null;

  const bookings = await prisma.booking.findMany({
    take: 100,
    orderBy: { createdAt: "desc" },
    ...(statusFilter ? { where: { bookingStatus: statusFilter } } : {}),
    include: {
      guest: { select: { firstName: true, lastName: true } },
      rooms: { select: { room: { select: { roomNumber: true } } } },
    },
  });

  return NextResponse.json(
    bookings.map((booking) => ({
      id: booking.id,
      bookingReference: booking.bookingReference,
      guestName: `${booking.guest.firstName} ${booking.guest.lastName}`,
      checkIn: booking.checkIn.toISOString().slice(0, 10),
      checkOut: booking.checkOut.toISOString().slice(0, 10),
      bookingStatus: booking.bookingStatus,
      paymentStatus: booking.paymentStatus,
      total: booking.total.toString(),
      rooms: booking.rooms.map((line) => line.room.roomNumber),
    })),
  );
}

export async function POST(request: Request) {
  const auth = await guardApi({
    route: "/api/staff/bookings",
    roles: [AppRole.STAFF, AppRole.ADMIN],
    permission: Permissions.MANAGE_RESERVATIONS,
  });
  if (auth instanceof NextResponse) return auth;

  const parsed = StaffBookingSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return invalidBody(parsed.error.flatten().fieldErrors);

  const actor: StaffActor = { kind: "staff", userId: auth.userId!, email: auth.email ?? null };
  try {
    const booking = await createBooking(
      { ...parsed.data, expectedTotal: parsed.data.expectedTotal ?? null },
      actor,
    );
    return NextResponse.json({ booking }, { status: 201 });
  } catch (error) {
    return bookingErrorResponse(error);
  }
}
