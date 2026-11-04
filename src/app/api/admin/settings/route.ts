import { NextResponse } from "next/server";
import { guardApi, guardTenantHotel } from "@/server/auth/api";
import { AppRole, Permissions } from "@/server/auth/roles";
import { getSettings, updateSettings } from "@/server/console/settings";
import { SettingsPatchSchema } from "@/server/console/validation";
import { consoleErrorResponse } from "@/server/console/errors";
import { invalidBody } from "@/server/booking/http";

/**
 * System settings (P7, admin only).
 *
 *   GET  /api/admin/settings  — the stored hotel row (what the console edits)
 *   PATCH /api/admin/settings — partial update; changed keys only are audited
 *
 * Pricing, cancellation and the public pages read the same row through
 * `loadHotelContext`, so an update is live on the next request.
 */
export async function GET() {
  const auth = await guardApi({
    route: "/api/admin/settings",
    roles: [AppRole.ADMIN],
    permission: Permissions.MANAGE_SETTINGS,
  });
  if (auth instanceof NextResponse) return auth;
  const tenant = await guardTenantHotel(auth, Permissions.MANAGE_SETTINGS);
  if (tenant instanceof NextResponse) return tenant;

  try {
    return NextResponse.json(await getSettings(tenant.hotelId));
  } catch (error) {
    return consoleErrorResponse(error);
  }
}

export async function PATCH(request: Request) {
  const auth = await guardApi({
    route: "/api/admin/settings",
    roles: [AppRole.ADMIN],
    permission: Permissions.MANAGE_SETTINGS,
  });
  if (auth instanceof NextResponse) return auth;
  const tenant = await guardTenantHotel(auth, Permissions.MANAGE_SETTINGS);
  if (tenant instanceof NextResponse) return tenant;

  const parsed = SettingsPatchSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return invalidBody(parsed.error.flatten().fieldErrors);

  try {
    return NextResponse.json(
      await updateSettings(tenant.hotelId, parsed.data, { userId: auth.userId! }),
    );
  } catch (error) {
    return consoleErrorResponse(error);
  }
}
