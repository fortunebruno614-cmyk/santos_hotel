import { NextResponse } from "next/server";
import { guardApi, guardTenantHotel } from "@/server/auth/api";
import { AppRole, Permissions } from "@/server/auth/roles";
import { createRoom, listRooms, type ConsoleActor } from "@/server/console/catalog";
import { RoomUpsertSchema } from "@/server/console/validation";
import { consoleErrorResponse } from "@/server/console/errors";
import { invalidBody } from "@/server/booking/http";

/**
 * Physical rooms (P7 inventory CRUD) — the housekeeping board's data source.
 *
 *   GET  /api/admin/rooms
 *   POST /api/admin/rooms   { roomNumber, roomTypeId, floor?, status?, notes? }
 *
 * Status *transitions* still go through `/api/staff/rooms/[id]` (policy table);
 * creating a room may start in any status, editing one must stay legal.
 */
export async function GET() {
  const auth = await guardApi({
    route: "/api/admin/rooms",
    roles: [AppRole.STAFF, AppRole.ADMIN],
    permission: Permissions.MANAGE_ROOMS,
  });
  if (auth instanceof NextResponse) return auth;
  const tenant = await guardTenantHotel(auth, Permissions.MANAGE_ROOMS);
  if (tenant instanceof NextResponse) return tenant;

  const rows = await listRooms(tenant.hotelId);
  return NextResponse.json(
    rows.map((room) => ({
      id: room.id,
      roomNumber: room.roomNumber,
      floor: room.floor,
      status: room.status,
      notes: room.notes,
      roomTypeId: room.roomType.id,
      roomTypeName: room.roomType.name,
    })),
  );
}

export async function POST(request: Request) {
  const auth = await guardApi({
    route: "/api/admin/rooms",
    roles: [AppRole.STAFF, AppRole.ADMIN],
    permission: Permissions.MANAGE_ROOMS,
  });
  if (auth instanceof NextResponse) return auth;
  const tenant = await guardTenantHotel(auth, Permissions.MANAGE_ROOMS);
  if (tenant instanceof NextResponse) return tenant;

  const parsed = RoomUpsertSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return invalidBody(parsed.error.flatten().fieldErrors);

  const actor: ConsoleActor = { userId: auth.userId! };
  try {
    const created = await createRoom(tenant.hotelId, parsed.data, actor);
    return NextResponse.json({ id: created.id }, { status: 201 });
  } catch (error) {
    return consoleErrorResponse(error);
  }
}
