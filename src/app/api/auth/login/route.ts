import { NextResponse } from "next/server";
import { z } from "zod";
import { authenticateGuest, authenticateStaff, setSessionCookie } from "@/server/auth/service";
import { auditLogin, auditLoginFailed } from "@/server/audit/write";
import { AppRole } from "@/server/auth/roles";
import { normalizeEmail, CredentialsSchema } from "@/server/auth/validation";
import { loginThrottleState, recordFailedLogin, clearFailedLogins } from "@/server/auth/throttle";
import { clientIp } from "@/server/auth/request";

const Body = CredentialsSchema.extend({
  kind: z.enum(["staff", "guest"]).default("staff"),
});

export async function POST(request: Request) {
  const parsed = Body.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid_body" }, { status: 400 });
  }

  const { password, kind } = parsed.data;
  const email = normalizeEmail(parsed.data.email);
  const ip = clientIp(request.headers);

  const throttle = loginThrottleState(ip, email);
  if (throttle.limited) {
    await auditLoginFailed(kind, email, "rate_limited", ip);
    return NextResponse.json(
      { error: "rate_limited", retryAfter: throttle.retryAfterSec },
      { status: 429, headers: { "retry-after": String(throttle.retryAfterSec) } },
    );
  }

  if (kind === "staff") {
    const result = await authenticateStaff(email, password);
    if (!result) {
      recordFailedLogin(ip, email);
      await auditLoginFailed("staff", email, "invalid_credentials", ip);
      return NextResponse.json({ error: "invalid_credentials" }, { status: 401 });
    }
    clearFailedLogins(ip, email);
    await setSessionCookie(result.payload);
    await auditLogin({ userId: result.user.id }, result.user.role as AppRole, result.user.email);
    return NextResponse.json({
      role: result.user.role,
      userId: result.user.id,
      email: result.user.email,
    });
  }

  const result = await authenticateGuest(email, password);
  if (!result) {
    recordFailedLogin(ip, email);
    await auditLoginFailed("guest", email, "invalid_credentials", ip);
    return NextResponse.json({ error: "invalid_credentials" }, { status: 401 });
  }
  clearFailedLogins(ip, email);
  await setSessionCookie(result.payload);
  await auditLogin({ guestId: result.guest.id }, AppRole.GUEST, result.guest.email);
  return NextResponse.json({
    role: AppRole.GUEST,
    guestId: result.guest.id,
    email: result.guest.email,
  });
}
