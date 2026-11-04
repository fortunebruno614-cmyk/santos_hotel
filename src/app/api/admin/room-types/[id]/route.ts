import { NextResponse } from "next/server";
import { guardApi, guardTenantHotel } from "@/server/auth/api";
import { hotelOfRoomType } from "@/server/auth/tenancy";
import { AppRole, Permissions } from "@/server/auth/roles";
import {
  deleteRoomType,
  updateRoomType,
  type ConsoleActor,
} from "@/server/console/catalog";
import { RoomTypeUpsertSchema } from "@/server/console/validation";
import { consoleErrorResponse } from "@/server/console/errors";
import { invalidBody } from "@/server/booking/http";

type Params = { params: Promise<{ id: string }> };

export async function PATCH(request: Request, { params }: Params) {
  const auth = await guardApi({
    route: "/api/admin/room-types/[id]",
    roles: [AppRole.STAFF, AppRole.ADMIN],
    permission: Permissions.MANAGE_ROOMS,
  });
  if (auth instanceof NextResponse) return auth;
  const { id } = await params;
  const tenant = await guardTenantHotel(auth, Permissions.MANAGE_ROOMS, () =>
    hotelOfRoomType(id),
  );
  if (tenant instanceof NextResponse) return tenant;

  const parsed = RoomTypeUpsertSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return invalidBody(parsed.error.flatten().fieldErrors);

  const actor: ConsoleActor = { userId: auth.userId! };
  try {
    const updated = await updateRoomType(tenant.hotelId, id, parsed.data, actor);
    return NextResponse.json({ id: updated.id });
  } catch (error) {
    return consoleErrorResponse(error);
  }
}

export async function DELETE(_request: Request, { params }: Params) {
  const auth = await guardApi({
    route: "/api/admin/room-types/[id]",
    roles: [AppRole.STAFF, AppRole.ADMIN],
    permission: Permissions.MANAGE_ROOMS,
  });
  if (auth instanceof NextResponse) return auth;
  const { id } = await params;
  const tenant = await guardTenantHotel(auth, Permissions.MANAGE_ROOMS, () =>
    hotelOfRoomType(id),
  );
  if (tenant instanceof NextResponse) return tenant;

  try {
    return NextResponse.json(
      await deleteRoomType(tenant.hotelId, id, { userId: auth.userId! }),
    );
  } catch (error) {
    return consoleErrorResponse(error);
  }
}
