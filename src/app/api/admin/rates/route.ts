import { NextResponse } from "next/server";
import { guardApi } from "@/server/auth/api";
import { AppRole, Permissions } from "@/server/auth/roles";
import { createRate, listRates } from "@/server/console/catalog";
import { RateUpsertSchema } from "@/server/console/validation";
import { consoleErrorResponse } from "@/server/console/errors";
import { invalidBody } from "@/server/booking/http";

/**
 * Rates (P7): `GET /api/admin/rates[?roomTypeId=…]`, `POST /api/admin/rates`.
 *
 * Pricing reads these rows on every quote — a new ACTIVE rate takes effect for
 * the nights inside its window immediately (no cache to bust).
 */
export async function GET(request: Request) {
  const auth = await guardApi({
    route: "/api/admin/rates",
    roles: [AppRole.STAFF, AppRole.ADMIN],
    permission: Permissions.MANAGE_RATES,
  });
  if (auth instanceof NextResponse) return auth;

  const roomTypeId = new URL(request.url).searchParams.get("roomTypeId") ?? undefined;
  const rows = await listRates(roomTypeId);
  return NextResponse.json(
    rows.map((row) => ({
      id: row.id,
      roomTypeId: row.roomTypeId,
      roomTypeName: row.roomType.name,
      name: row.name,
      amount: row.amount.toString(),
      currency: row.currency,
      startDate: row.startDate.toISOString().slice(0, 10),
      endDate: row.endDate.toISOString().slice(0, 10),
      status: row.status,
    })),
  );
}

export async function POST(request: Request) {
  const auth = await guardApi({
    route: "/api/admin/rates",
    roles: [AppRole.STAFF, AppRole.ADMIN],
    permission: Permissions.MANAGE_RATES,
  });
  if (auth instanceof NextResponse) return auth;

  const parsed = RateUpsertSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return invalidBody(parsed.error.flatten().fieldErrors);

  try {
    const created = await createRate(parsed.data, { userId: auth.userId! });
    return NextResponse.json({ id: created.id }, { status: 201 });
  } catch (error) {
    return consoleErrorResponse(error);
  }
}
