import { NextResponse } from "next/server";
import { guardApi } from "@/server/auth/api";
import { AppRole, Permissions } from "@/server/auth/roles";
import { transitionBooking, type StaffActor } from "@/server/booking/service";
import { TransitionSchema } from "@/server/booking/validation";
import { bookingErrorResponse, invalidBody } from "@/server/booking/http";

/**
 * Guarded status transition (staff).
 *
 *   POST /api/staff/bookings/{id}/transition   { to: "CONFIRMED" | "CHECKED_IN" |
 *                                               "CHECKED_OUT" | "CANCELLED" |
 *                                               "NO_SHOW", note? }
 *
 * The service enforces the transition table, the arrival-date timing rules and
 * the cancellation policy; check-in also flips the allocated rooms to OCCUPIED
 * and check-out to CLEANING (the CheckedOut → Cleaning → Available flow).
 */
export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const auth = await guardApi({
    route: "/api/staff/bookings/[id]/transition",
    roles: [AppRole.STAFF, AppRole.ADMIN],
    permission: Permissions.MANAGE_RESERVATIONS,
  });
  if (auth instanceof NextResponse) return auth;
  const { id } = await context.params;

  const parsed = TransitionSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return invalidBody(parsed.error.flatten().fieldErrors);

  const actor: StaffActor = { kind: "staff", userId: auth.userId!, email: auth.email ?? null };
  try {
    const booking = await transitionBooking(
      { bookingId: id, to: parsed.data.to, note: parsed.data.note ?? null },
      actor,
    );
    return NextResponse.json({ booking });
  } catch (error) {
    return bookingErrorResponse(error);
  }
}
