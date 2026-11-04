import { NextResponse } from "next/server";
import { guardApi, guardTenantHotel } from "@/server/auth/api";
import { staffActor } from "@/server/auth/actor";
import { hotelOfRoom } from "@/server/auth/tenancy";
import { AppRole, Permissions } from "@/server/auth/roles";
import { updateRoomStatus, type StaffActor } from "@/server/booking/service";
import { allowedRoomTransitions } from "@/server/booking/policy";
import { RoomStatusSchema } from "@/server/booking/validation";
import { bookingErrorResponse, invalidBody } from "@/server/booking/http";

/**
 * Room status transitions (staff housekeeping/front desk).
 *
 *   PATCH /api/staff/rooms/{id}   { status, note? }
 *
 * The server re-reads the room under a row lock and applies the transition
 * table — `OCCUPIED → AVAILABLE` is impossible (check-out moves a room to
 * CLEANING first), which is the CheckedOut → Cleaning → Available rule.
 * The response carries the legal next steps so the board can offer them.
 */
export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const auth = await guardApi({
    route: "/api/staff/rooms/[id]",
    roles: [AppRole.STAFF, AppRole.ADMIN],
    permission: Permissions.MANAGE_ROOMS,
  });
  if (auth instanceof NextResponse) return auth;
  const { id } = await context.params;
  const tenant = await guardTenantHotel(auth, Permissions.MANAGE_ROOMS, () =>
    hotelOfRoom(id),
  );
  if (tenant instanceof NextResponse) return tenant;

  const parsed = RoomStatusSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return invalidBody(parsed.error.flatten().fieldErrors);

  const actor: StaffActor = staffActor(auth, tenant.member);
  try {
    const result = await updateRoomStatus(
      { roomId: id, status: parsed.data.status, note: parsed.data.note ?? null },
      actor,
    );
    return NextResponse.json({
      room: result,
      allowedTransitions: allowedRoomTransitions(result.status),
    });
  } catch (error) {
    return bookingErrorResponse(error);
  }
}
