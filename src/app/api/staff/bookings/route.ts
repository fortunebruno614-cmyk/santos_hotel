import { NextResponse } from "next/server";
import { guardApi } from "@/server/auth/api";
import { AppRole, Permissions } from "@/server/auth/roles";
import { createBooking, type StaffActor } from "@/server/booking/service";
import { searchBookings } from "@/server/console/bookings";
import { BookingSearchSchema } from "@/server/console/validation";
import { StaffBookingSchema } from "@/server/booking/validation";
import { bookingErrorResponse, invalidBody } from "@/server/booking/http";

/**
 * Staff reservations (manual/walk-in bookings).
 *
 *   GET  /api/staff/bookings[?q=…&status=…&paymentStatus=…&from=…&to=…&page=…]
 *        — searchable reservation list (P7: reference, guest, room number,
 *          status, payment status and date-range overlap filters)
 *   POST /api/staff/bookings — phone/walk-in booking
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

  const params = new URL(request.url).searchParams;
  const parsed = BookingSearchSchema.safeParse({
    q: params.get("q") ?? undefined,
    status: params.get("status") ?? undefined,
    paymentStatus: params.get("paymentStatus") ?? undefined,
    from: params.get("from") ?? undefined,
    to: params.get("to") ?? undefined,
    page: params.get("page") ?? undefined,
    pageSize: params.get("pageSize") ?? undefined,
  });
  if (!parsed.success) return invalidBody(parsed.error.flatten().fieldErrors);

  return NextResponse.json(await searchBookings(parsed.data));
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
