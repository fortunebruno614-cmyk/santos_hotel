import { NextResponse } from "next/server";
import { guardApi, guardTenantHotel } from "@/server/auth/api";
import { staffActor } from "@/server/auth/actor";
import { hotelOfBooking } from "@/server/auth/tenancy";
import { AppRole, Permissions } from "@/server/auth/roles";
import { addBookingNote, type StaffActor } from "@/server/booking/service";
import { BookingNoteSchema } from "@/server/booking/validation";
import { bookingErrorResponse, invalidBody } from "@/server/booking/http";

/**
 * Operational note on a reservation (staff).
 *
 *   POST /api/staff/bookings/{id}/notes   { note }
 *
 * Notes are appended as `[timestamp actor] text` lines so the history of the
 * desk conversation survives edits, and the write is mirrored in the audit log.
 */
export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const auth = await guardApi({
    route: "/api/staff/bookings/[id]/notes",
    roles: [AppRole.STAFF, AppRole.ADMIN],
    permission: Permissions.MANAGE_RESERVATIONS,
  });
  if (auth instanceof NextResponse) return auth;
  const { id } = await context.params;
  const tenant = await guardTenantHotel(auth, Permissions.MANAGE_RESERVATIONS, () =>
    hotelOfBooking(id),
  );
  if (tenant instanceof NextResponse) return tenant;

  const parsed = BookingNoteSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return invalidBody(parsed.error.flatten().fieldErrors);

  const actor: StaffActor = staffActor(auth, tenant.member);
  try {
    const result = await addBookingNote({ bookingId: id, note: parsed.data.note }, actor);
    return NextResponse.json(result);
  } catch (error) {
    return bookingErrorResponse(error);
  }
}
