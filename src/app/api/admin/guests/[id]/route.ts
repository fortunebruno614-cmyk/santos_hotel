import { NextResponse } from "next/server";
import { guardApi, guardTenantHotel } from "@/server/auth/api";
import { AppRole, Permissions } from "@/server/auth/roles";
import { getGuestDetail, updateGuest } from "@/server/console/guests";
import { GuestUpdateSchema } from "@/server/console/validation";
import { consoleErrorResponse } from "@/server/console/errors";
import { invalidBody } from "@/server/booking/http";

type Params = { params: Promise<{ id: string }> };

/** Guest record: `GET /api/admin/guests/{id}`, `PATCH` (contact/ID corrections). */
export async function GET(_request: Request, { params }: Params) {
  const auth = await guardApi({
    route: "/api/admin/guests/[id]",
    roles: [AppRole.STAFF, AppRole.ADMIN],
    permission: Permissions.VIEW_GUESTS,
  });
  if (auth instanceof NextResponse) return auth;
  const tenant = await guardTenantHotel(auth, Permissions.VIEW_GUESTS);
  if (tenant instanceof NextResponse) return tenant;
  const { id } = await params;

  try {
    return NextResponse.json(await getGuestDetail(tenant.hotelId, id));
  } catch (error) {
    return consoleErrorResponse(error);
  }
}

export async function PATCH(request: Request, { params }: Params) {
  const auth = await guardApi({
    route: "/api/admin/guests/[id]",
    roles: [AppRole.STAFF, AppRole.ADMIN],
    // Mutations need a separate permission from read-only VIEW_GUESTS.
    permission: Permissions.MANAGE_GUESTS,
  });
  if (auth instanceof NextResponse) return auth;
  const tenant = await guardTenantHotel(auth, Permissions.MANAGE_GUESTS);
  if (tenant instanceof NextResponse) return tenant;
  const { id } = await params;

  const parsed = GuestUpdateSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return invalidBody(parsed.error.flatten().fieldErrors);

  try {
    const updated = await updateGuest(tenant.hotelId, id, parsed.data, {
      userId: auth.userId!,
    });
    return NextResponse.json({ id: updated.id });
  } catch (error) {
    return consoleErrorResponse(error);
  }
}
