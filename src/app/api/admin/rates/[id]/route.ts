import { NextResponse } from "next/server";
import { guardApi, guardTenantHotel } from "@/server/auth/api";
import { hotelOfRate } from "@/server/auth/tenancy";
import { AppRole, Permissions } from "@/server/auth/roles";
import { deleteRate, updateRate } from "@/server/console/catalog";
import { RateUpsertSchema } from "@/server/console/validation";
import { consoleErrorResponse } from "@/server/console/errors";
import { invalidBody } from "@/server/booking/http";

type Params = { params: Promise<{ id: string }> };

export async function PATCH(request: Request, { params }: Params) {
  const auth = await guardApi({
    route: "/api/admin/rates/[id]",
    roles: [AppRole.STAFF, AppRole.ADMIN],
    permission: Permissions.MANAGE_RATES,
  });
  if (auth instanceof NextResponse) return auth;
  const { id } = await params;
  const tenant = await guardTenantHotel(auth, Permissions.MANAGE_RATES, () =>
    hotelOfRate(id),
  );
  if (tenant instanceof NextResponse) return tenant;

  const parsed = RateUpsertSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return invalidBody(parsed.error.flatten().fieldErrors);

  try {
    const updated = await updateRate(tenant.hotelId, id, parsed.data, {
      userId: auth.userId!,
    });
    return NextResponse.json({ id: updated.id });
  } catch (error) {
    return consoleErrorResponse(error);
  }
}

export async function DELETE(_request: Request, { params }: Params) {
  const auth = await guardApi({
    route: "/api/admin/rates/[id]",
    roles: [AppRole.STAFF, AppRole.ADMIN],
    permission: Permissions.MANAGE_RATES,
  });
  if (auth instanceof NextResponse) return auth;
  const { id } = await params;
  const tenant = await guardTenantHotel(auth, Permissions.MANAGE_RATES, () =>
    hotelOfRate(id),
  );
  if (tenant instanceof NextResponse) return tenant;

  try {
    return NextResponse.json(await deleteRate(tenant.hotelId, id, { userId: auth.userId! }));
  } catch (error) {
    return consoleErrorResponse(error);
  }
}
