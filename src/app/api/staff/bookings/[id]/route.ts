import { NextResponse } from "next/server";
import { guardApi } from "@/server/auth/api";
import { AppRole, Permissions } from "@/server/auth/roles";
import { getBookingDetail, modifyBooking, type StaffActor } from "@/server/booking/service";
import { ModifyBookingSchema } from "@/server/booking/validation";
import { bookingErrorResponse, invalidBody } from "@/server/booking/http";

/**
 * One reservation (staff).
 *
 *   GET   /api/staff/bookings/{id} — full detail (price snapshot, transitions,
 *                                     cancellation eligibility, activity trail)
 *   PATCH /api/staff/bookings/{id} — modify dates/occupancy/rooms/notes/
 *                                     promotion/guest contact
 *
 * Modification never edits a booking in place blindly: when the stay changes the
 * service locks old + new rooms, drops this booking's own nights, re-runs the
 * availability check and re-prices — all inside one transaction.
 */

type Params = { params: Promise<{ id: string }> };

export async function GET(request: Request, context: Params) {
  const auth = await guardApi({
    route: "/api/staff/bookings/[id]",
    roles: [AppRole.STAFF, AppRole.ADMIN],
    permission: Permissions.MANAGE_RESERVATIONS,
  });
  if (auth instanceof NextResponse) return auth;
  const { id } = await context.params;

  try {
    return NextResponse.json(await getBookingDetail(id, { kind: "staff" }));
  } catch (error) {
    return bookingErrorResponse(error);
  }
}

export async function PATCH(request: Request, context: Params) {
  const auth = await guardApi({
    route: "/api/staff/bookings/[id]",
    roles: [AppRole.STAFF, AppRole.ADMIN],
    permission: Permissions.MANAGE_RESERVATIONS,
  });
  if (auth instanceof NextResponse) return auth;
  const { id } = await context.params;

  const parsed = ModifyBookingSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return invalidBody(parsed.error.flatten().fieldErrors);

  const actor: StaffActor = { kind: "staff", userId: auth.userId!, email: auth.email ?? null };
  try {
    const booking = await modifyBooking({ bookingId: id, ...parsed.data }, actor);
    return NextResponse.json({ booking });
  } catch (error) {
    return bookingErrorResponse(error);
  }
}
