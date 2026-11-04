import { NextResponse } from "next/server";
import { guardApi, guardTenantHotel } from "@/server/auth/api";
import { hotelOfRoom } from "@/server/auth/tenancy";
import { AppRole, Permissions } from "@/server/auth/roles";
import { deleteRoom, updateRoom, type ConsoleActor } from "@/server/console/catalog";
import { RoomUpsertSchema } from "@/server/console/validation";
import { consoleErrorResponse } from "@/server/console/errors";
import { invalidBody } from "@/server/booking/http";
import { TransitionError } from "@/server/booking/policy";

type Params = { params: Promise<{ id: string }> };

export async function PATCH(request: Request, { params }: Params) {
  const auth = await guardApi({
    route: "/api/admin/rooms/[id]",
    roles: [AppRole.STAFF, AppRole.ADMIN],
    permission: Permissions.MANAGE_ROOMS,
  });
  if (auth instanceof NextResponse) return auth;
  const { id } = await params;
  const tenant = await guardTenantHotel(auth, Permissions.MANAGE_ROOMS, () =>
    hotelOfRoom(id),
  );
  if (tenant instanceof NextResponse) return tenant;

  const parsed = RoomUpsertSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return invalidBody(parsed.error.flatten().fieldErrors);

  const actor: ConsoleActor = { userId: auth.userId! };
  try {
    const updated = await updateRoom(tenant.hotelId, id, parsed.data, actor);
    return NextResponse.json({ id: updated.id, status: updated.status });
  } catch (error) {
    if (error instanceof TransitionError) {
      return NextResponse.json(
        { error: error.code, message: error.message, from: error.from, to: error.to },
        { status: 409 },
      );
    }
    return consoleErrorResponse(error);
  }
}

export async function DELETE(_request: Request, { params }: Params) {
  const auth = await guardApi({
    route: "/api/admin/rooms/[id]",
    roles: [AppRole.STAFF, AppRole.ADMIN],
    permission: Permissions.MANAGE_ROOMS,
  });
  if (auth instanceof NextResponse) return auth;
  const { id } = await params;
  const tenant = await guardTenantHotel(auth, Permissions.MANAGE_ROOMS, () =>
    hotelOfRoom(id),
  );
  if (tenant instanceof NextResponse) return tenant;

  try {
    return NextResponse.json(await deleteRoom(tenant.hotelId, id, { userId: auth.userId! }));
  } catch (error) {
    return consoleErrorResponse(error);
  }
}
