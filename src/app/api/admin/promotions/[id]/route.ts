import { NextResponse } from "next/server";
import { guardApi, guardTenantHotel } from "@/server/auth/api";
import { hotelOfPromotion } from "@/server/auth/tenancy";
import { AppRole, Permissions } from "@/server/auth/roles";
import { deletePromotion, updatePromotion } from "@/server/console/catalog";
import { PromotionUpsertSchema } from "@/server/console/validation";
import { consoleErrorResponse } from "@/server/console/errors";
import { invalidBody } from "@/server/booking/http";

type Params = { params: Promise<{ id: string }> };

export async function PATCH(request: Request, { params }: Params) {
  const auth = await guardApi({
    route: "/api/admin/promotions/[id]",
    roles: [AppRole.STAFF, AppRole.ADMIN],
    permission: Permissions.MANAGE_PROMOTIONS,
  });
  if (auth instanceof NextResponse) return auth;
  const { id } = await params;
  const tenant = await guardTenantHotel(auth, Permissions.MANAGE_PROMOTIONS, () =>
    hotelOfPromotion(id),
  );
  if (tenant instanceof NextResponse) return tenant;

  const parsed = PromotionUpsertSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return invalidBody(parsed.error.flatten().fieldErrors);

  try {
    const updated = await updatePromotion(tenant.hotelId, id, parsed.data, {
      userId: auth.userId!,
    });
    return NextResponse.json({ id: updated.id });
  } catch (error) {
    return consoleErrorResponse(error);
  }
}

export async function DELETE(_request: Request, { params }: Params) {
  const auth = await guardApi({
    route: "/api/admin/promotions/[id]",
    roles: [AppRole.STAFF, AppRole.ADMIN],
    permission: Permissions.MANAGE_PROMOTIONS,
  });
  if (auth instanceof NextResponse) return auth;
  const { id } = await params;
  const tenant = await guardTenantHotel(auth, Permissions.MANAGE_PROMOTIONS, () =>
    hotelOfPromotion(id),
  );
  if (tenant instanceof NextResponse) return tenant;

  try {
    return NextResponse.json(
      await deletePromotion(tenant.hotelId, id, { userId: auth.userId! }),
    );
  } catch (error) {
    return consoleErrorResponse(error);
  }
}
