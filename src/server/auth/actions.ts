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
  return {
    kind: payload.kind,
    role: payload.role,
    userId: payload.userId,
    guestId: payload.guestId,
    orgId: payload.orgId,
    platformRole: payload.platformRole ?? null,
  };
}

async function requestIp() {
  return clientIp(await headers());
}

type LoginPortal = "guest" | "tenant" | "platform";

const ORG_SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/i;

/**
 * Organization slugs only choose *which* tenant door the visitor is standing
 * at. They are validated here so they can safely be used in a redirect path;
 * actual membership is always re-read from the database below.
 */
function readOrgSlug(value: FormDataEntryValue | null): string | null {
  if (typeof value !== "string") return null;
  const slug = value.trim();
  return slug.length <= 80 && ORG_SLUG_PATTERN.test(slug) ? slug : null;
}

function loginPath(portal: LoginPortal, orgSlug: string | null = null) {
  if (portal === "platform") return "/platform/login";
  if (portal === "guest") return "/login";
  return orgSlug ? `/h/${orgSlug}/login` : "/staff/login";
}

function loginError(
  error: string,
  next: string | null,
  portal: LoginPortal,
  orgSlug: string | null = null,
) {
  const params = new URLSearchParams({ error });
  if (next) params.set("next", next);
  return `${loginPath(portal, orgSlug)}?${params.toString()}`;
}

export async function loginStaff(formData: FormData) {
  const portal: LoginPortal =
    formData.get("portal") === "platform" ? "platform" : "tenant";
  const orgSlug = portal === "tenant" ? readOrgSlug(formData.get("orgSlug")) : null;
  const next = sanitizeNextPath(formData.get("next"));
  const parsed = CredentialsSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
  });
  if (!parsed.success) redirect(loginError("invalid", next, portal, orgSlug));

  const email = normalizeEmail(parsed.data.email);
  const ip = await requestIp();

  const throttle = loginThrottleState(ip, email);
  if (throttle.limited) {
    await auditLoginFailed("staff", email, "rate_limited", ip);
    redirect(loginError("rate_limited", next, portal, orgSlug));
  }

  const result = await authenticateStaff(email, parsed.data.password);
  if (!result) {
    recordFailedLogin(ip, email);
    await auditLoginFailed("staff", email, "invalid_credentials", ip);
    redirect(loginError("invalid", next, portal, orgSlug));
  }

  // The two portals are separate doors: a tenant member cannot sign in at the
  // platform door, and a platform-only operator cannot sign in at the tenant
  // door (REQ-026, REQ-047).
  //
  // A tenant-specific door additionally proves membership of *that*
  // organization. The slug only selects the door; the membership is always
  // re-read from the database, so a URL can never grant tenant context.
  let orgId: string | undefined;
  if (portal === "platform") {
    if (!result.user.platformRole) {
      recordFailedLogin(ip, email);
      await auditLoginFailed("staff", email, "invalid_credentials", ip);
      redirect(loginError("forbidden", next, portal));
    }
  } else if (orgSlug) {
    const organization = await prisma.organization.findFirst({
      where: { slug: orgSlug, status: "ACTIVE" },
      select: { id: true },
    });
    const membership = organization
      ? await prisma.organizationMember.findFirst({
          where: {
            userId: result.user.id,
            organizationId: organization.id,
            status: "ACTIVE",
          },
          select: { id: true },
        })
      : null;
    if (!organization || !membership) {
      recordFailedLogin(ip, email);
      await auditLoginFailed("staff", email, "invalid_credentials", ip);
      redirect(loginError("forbidden", next, portal, orgSlug));
    }
    orgId = organization.id;
  } else {
    const membership = await prisma.organizationMember.findFirst({
      where: {
        userId: result.user.id,
        status: "ACTIVE",
        organization: { status: "ACTIVE" },
      },
      select: { organizationId: true },
    });
    if (!membership) {
      recordFailedLogin(ip, email);
      await auditLoginFailed("staff", email, "invalid_credentials", ip);
      redirect(loginError("forbidden", next, portal));
    }
    orgId = membership.organizationId;
  }

  clearFailedLogins(ip, email);
  const payload = orgId ? { ...result.payload, orgId } : result.payload;
  await setSessionCookie(payload);
  await auditLogin({ userId: result.user.id }, result.user.role, result.user.email);
  redirect(
    portal === "platform"
      ? "/platform"
      : resolvePostLoginPath(toSessionLike(payload), next),
  );
}

export async function loginGuest(formData: FormData) {
  const next = sanitizeNextPath(formData.get("next"));
  const parsed = CredentialsSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
  });
  if (!parsed.success) redirect(loginError("invalid", next, "guest"));

  const email = normalizeEmail(parsed.data.email);
  const ip = await requestIp();

  const throttle = loginThrottleState(ip, email);
  if (throttle.limited) {
    await auditLoginFailed("guest", email, "rate_limited", ip);
    redirect(loginError("rate_limited", next, "guest"));
  }

  const result = await authenticateGuest(email, parsed.data.password);
  if (!result) {
    recordFailedLogin(ip, email);
    await auditLoginFailed("guest", email, "invalid_credentials", ip);
    redirect(loginError("invalid", next, "guest"));
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
