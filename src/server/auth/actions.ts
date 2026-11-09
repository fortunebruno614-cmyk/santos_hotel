"use server";

import { redirect } from "next/navigation";
import { headers } from "next/headers";
import {
  authenticateGuest,
  authenticateStaff,
  clearSessionCookie,
  createGuestAccount,
  readSessionCookie,
  setSessionCookie,
} from "@/server/auth/service";
import { auditLogin, auditLoginFailed, auditLogout, auditSignup } from "@/server/audit/write";
import { verifySession, type SessionPayload } from "@/server/auth/session";
import { CredentialsSchema, SignupSchema, normalizeEmail } from "@/server/auth/validation";
import { loginThrottleState, recordFailedLogin, clearFailedLogins } from "@/server/auth/throttle";
import { clientIp } from "@/server/auth/request";
import { prisma } from "@/lib/prisma";
import {
  resolvePostLoginPath,
  sanitizeNextPath,
  type SessionLike,
} from "@/config/access-map";

function toSessionLike(payload: SessionPayload): SessionLike {
  return { kind: payload.kind, role: payload.role, userId: payload.userId, guestId: payload.guestId };
}

async function requestIp() {
  return clientIp(await headers());
}

type LoginPortal = "tenant" | "platform";

function loginPath(portal: LoginPortal) {
  return portal === "platform" ? "/platform/login" : "/staff/login";
}

function loginError(error: string, next: string | null, portal: LoginPortal) {
  const params = new URLSearchParams({ error });
  if (next) params.set("next", next);
  return `${loginPath(portal)}?${params.toString()}`;
}

export async function loginStaff(formData: FormData) {
  const portal: LoginPortal =
    formData.get("portal") === "platform" ? "platform" : "tenant";
  const next = sanitizeNextPath(formData.get("next"));
  const parsed = CredentialsSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
  });
  if (!parsed.success) redirect(loginError("invalid", next, portal));

  const email = normalizeEmail(parsed.data.email);
  const ip = await requestIp();

  const throttle = loginThrottleState(ip, email);
  if (throttle.limited) {
    await auditLoginFailed("staff", email, "rate_limited", ip);
    redirect(loginError("rate_limited", next, portal));
  }

  const result = await authenticateStaff(email, parsed.data.password);
  if (!result) {
    recordFailedLogin(ip, email);
    await auditLoginFailed("staff", email, "invalid_credentials", ip);
    redirect(loginError("invalid", next, portal));
  }

  // The two portals are separate doors: a tenant member cannot sign in at the
  // platform door, and a platform-only operator cannot sign in at the tenant
  // door (REQ-026, REQ-047).
  const allowed =
    portal === "platform"
      ? Boolean(result.user.platformRole)
      : Boolean(
          await prisma.organizationMember.findFirst({
            where: {
              userId: result.user.id,
              status: "ACTIVE",
              organization: { status: "ACTIVE" },
            },
            select: { id: true },
          }),
        );
  if (!allowed) {
    recordFailedLogin(ip, email);
    await auditLoginFailed("staff", email, "invalid_credentials", ip);
    redirect(loginError("forbidden", next, portal));
  }

  clearFailedLogins(ip, email);
  await setSessionCookie(result.payload);
  await auditLogin({ userId: result.user.id }, result.user.role, result.user.email);
  redirect(
    portal === "platform"
      ? "/platform"
      : resolvePostLoginPath(toSessionLike(result.payload), next),
  );
}

export async function loginGuest(formData: FormData) {
  const next = sanitizeNextPath(formData.get("next"));
  const parsed = CredentialsSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
  });
  if (!parsed.success) redirect(loginError("invalid", next, "tenant"));

  const email = normalizeEmail(parsed.data.email);
  const ip = await requestIp();

  const throttle = loginThrottleState(ip, email);
  if (throttle.limited) {
    await auditLoginFailed("guest", email, "rate_limited", ip);
    redirect(loginError("rate_limited", next, "tenant"));
  }

  const result = await authenticateGuest(email, parsed.data.password);
  if (!result) {
    recordFailedLogin(ip, email);
    await auditLoginFailed("guest", email, "invalid_credentials", ip);
    redirect(loginError("invalid", next, "tenant"));
  }

  clearFailedLogins(ip, email);
  await setSessionCookie(result.payload);
  await auditLogin({ guestId: result.guest.id }, result.payload.role, result.guest.email);
  redirect(resolvePostLoginPath(toSessionLike(result.payload), next));
}

export async function signupGuest(formData: FormData) {
  const next = sanitizeNextPath(formData.get("next"));
  const parsed = SignupSchema.safeParse({
    firstName: formData.get("firstName"),
    lastName: formData.get("lastName"),
    email: formData.get("email"),
    password: formData.get("password"),
  });
  if (!parsed.success) redirect(`/signup?error=invalid`);

  const result = await createGuestAccount({
    ...parsed.data,
    email: normalizeEmail(parsed.data.email),
  });
  if (!result) redirect(`/signup?error=exists`);

  await setSessionCookie(result.payload);
  await auditSignup({ guestId: result.guest.id }, result.guest.email);
  redirect(resolvePostLoginPath(toSessionLike(result.payload), next));
}

export async function logout() {
  const token = await readSessionCookie();
  await clearSessionCookie();

  if (token) {
    const payload = await verifySession(token);
    if (payload?.userId) await auditLogout({ userId: payload.userId });
    else if (payload?.guestId) await auditLogout({ guestId: payload.guestId });
  }

  redirect("/");
}
