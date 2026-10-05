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

function loginError(error: string, next: string | null) {
  const params = new URLSearchParams({ error });
  if (next) params.set("next", next);
  return `/login?${params.toString()}`;
}

export async function loginStaff(formData: FormData) {
  const next = sanitizeNextPath(formData.get("next"));
  const parsed = CredentialsSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
  });
  if (!parsed.success) redirect(loginError("invalid", next));

  const email = normalizeEmail(parsed.data.email);
  const ip = await requestIp();

  const throttle = loginThrottleState(ip, email);
  if (throttle.limited) {
    await auditLoginFailed("staff", email, "rate_limited", ip);
    redirect(loginError("rate_limited", next));
  }

  const result = await authenticateStaff(email, parsed.data.password);
  if (!result) {
    recordFailedLogin(ip, email);
    await auditLoginFailed("staff", email, "invalid_credentials", ip);
    redirect(loginError("invalid", next));
  }

  clearFailedLogins(ip, email);
  await setSessionCookie(result.payload);
  await auditLogin({ userId: result.user.id }, result.user.role, result.user.email);
  redirect(resolvePostLoginPath(toSessionLike(result.payload), next));
}

export async function loginGuest(formData: FormData) {
  const next = sanitizeNextPath(formData.get("next"));
  const parsed = CredentialsSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
  });
  if (!parsed.success) redirect(loginError("invalid", next));

  const email = normalizeEmail(parsed.data.email);
  const ip = await requestIp();

  const throttle = loginThrottleState(ip, email);
  if (throttle.limited) {
    await auditLoginFailed("guest", email, "rate_limited", ip);
    redirect(loginError("rate_limited", next));
  }

  const result = await authenticateGuest(email, parsed.data.password);
  if (!result) {
    recordFailedLogin(ip, email);
    await auditLoginFailed("guest", email, "invalid_credentials", ip);
    redirect(loginError("invalid", next));
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
