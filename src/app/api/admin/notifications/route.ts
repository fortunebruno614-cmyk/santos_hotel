import { NextResponse } from "next/server";
import { guardApi, guardTenantHotel } from "@/server/auth/api";
import { AppRole, Permissions } from "@/server/auth/roles";
import { listRecentNotifications } from "@/server/notifications/service";

/**
 * Recent email delivery log (admin only). The rows are written by the
 * notification service before/after each Resend call, so this is the durable
 * record of what was sent, skipped or failed.
 *
 *   GET /api/admin/notifications
 */
export async function GET() {
  const auth = await guardApi({
    route: "/api/admin/notifications",
    roles: [AppRole.ADMIN],
    permission: Permissions.MANAGE_SETTINGS,
  });
  if (auth instanceof NextResponse) return auth;

  const tenant = await guardTenantHotel(auth, Permissions.MANAGE_SETTINGS);
  if (tenant instanceof NextResponse) return tenant;

  return NextResponse.json({
    notifications: await listRecentNotifications(tenant.hotelId, 50),
  });
}
