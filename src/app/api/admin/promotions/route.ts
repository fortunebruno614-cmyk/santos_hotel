import { NextResponse } from "next/server";
import { guardApi } from "@/server/auth/api";
import { AppRole, Permissions } from "@/server/auth/roles";
import { createPromotion, listPromotions } from "@/server/console/catalog";
import { PromotionUpsertSchema } from "@/server/console/validation";
import { consoleErrorResponse } from "@/server/console/errors";
import { invalidBody } from "@/server/booking/http";

/**
 * Promotions (P7): `GET /api/admin/promotions`, `POST /api/admin/promotions`.
 *
 * The discount rules are evaluated by the pricing service on every quote; a
 * change here (window, cap, status) applies to the next quote immediately.
 */
export async function GET() {
  const auth = await guardApi({
    route: "/api/admin/promotions",
    roles: [AppRole.STAFF, AppRole.ADMIN],
    permission: Permissions.MANAGE_PROMOTIONS,
  });
  if (auth instanceof NextResponse) return auth;

  const rows = await listPromotions();
  return NextResponse.json(
    rows.map((row) => ({
      id: row.id,
      code: row.code,
      type: row.type,
      value: row.value.toString(),
      startAt: row.startAt.toISOString(),
      endAt: row.endAt.toISOString(),
      maxUses: row.maxUses,
      status: row.status,
      redeemed: row._count.bookings,
    })),
  );
}

export async function POST(request: Request) {
  const auth = await guardApi({
    route: "/api/admin/promotions",
    roles: [AppRole.STAFF, AppRole.ADMIN],
    permission: Permissions.MANAGE_PROMOTIONS,
  });
  if (auth instanceof NextResponse) return auth;

  const parsed = PromotionUpsertSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return invalidBody(parsed.error.flatten().fieldErrors);

  try {
    const created = await createPromotion(parsed.data, { userId: auth.userId! });
    return NextResponse.json({ id: created.id }, { status: 201 });
  } catch (error) {
    return consoleErrorResponse(error);
  }
}
