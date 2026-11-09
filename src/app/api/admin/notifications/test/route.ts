import { NextResponse } from "next/server";
import { z } from "zod";
import { guardApi, guardTenantHotel } from "@/server/auth/api";
import { AppRole, Permissions } from "@/server/auth/roles";
import { EmailSchema } from "@/server/auth/validation";
import {
  EmailNotConfiguredError,
  sendTestNotification,
} from "@/server/notifications/service";

const BodySchema = z.object({
  to: EmailSchema.optional(),
});

/**
 * Send a branded Resend test email (admin only).
 *
 *   POST /api/admin/notifications/test   { to?: "admin@example.com" }
 *
 * Defaults to the signed-in admin's address. The response never includes the
 * API key, the provider token, or the raw upstream error.
 */
export async function POST(request: Request) {
  const auth = await guardApi({
    route: "/api/admin/notifications/test",
    roles: [AppRole.ADMIN],
    permission: Permissions.MANAGE_SETTINGS,
  });
  if (auth instanceof NextResponse) return auth;

  const tenant = await guardTenantHotel(auth, Permissions.MANAGE_SETTINGS);
  if (tenant instanceof NextResponse) return tenant;

  const parsed = BodySchema.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json(
      { error: "invalid_body", issues: parsed.error.flatten().fieldErrors },
      { status: 400 },
    );
  }

  const to = parsed.data.to ?? auth.email;
  if (!to) {
    return NextResponse.json({ error: "recipient_required" }, { status: 400 });
  }

  try {
    const result = await sendTestNotification({ to, hotelId: tenant.hotelId });
    if (!result.ok) {
      return NextResponse.json(
        { error: "email_failed", transport: result.transport },
        { status: 502 },
      );
    }
    return NextResponse.json({
      ok: true,
      transport: result.transport,
      delivery: result.result,
      message: `Test email accepted for ${to}.`,
    });
  } catch (error) {
    if (error instanceof EmailNotConfiguredError) {
      return NextResponse.json({ error: "email_not_configured" }, { status: 503 });
    }
    console.error("admin notification test failed", {
      hotelId: tenant.hotelId,
      reason: error instanceof Error ? error.message : "unknown",
    });
    return NextResponse.json({ error: "email_failed" }, { status: 502 });
  }
}
