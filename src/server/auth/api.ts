import { NextResponse } from "next/server";
import { getCurrentSession, isSessionValid, type CurrentSession } from "@/server/auth/dal";
import {
  AppRole,
  hasOrgPermission,
  hasPermission,
  type Permission,
  type PlatformPermission,
} from "@/server/auth/roles";
import { auditAccessDenied } from "@/server/audit/write";
import {
  loadTenantMember,
  requirePlatform,
  tenantHotelFor,
  TenancyError,
  type TenantMember,
} from "@/server/auth/tenancy";

export function apiUnauthenticated(error = "unauthenticated") {
  return NextResponse.json({ error }, { status: 401 });
}

export function apiForbidden(reason = "forbidden") {
  return NextResponse.json({ error: reason }, { status: 403 });
}

export type GuardOptions = {
  /** Path label recorded in the audit log when access is denied. */
  route: string;
  /** Empty or omitted = any signed-in principal. */
  roles?: AppRole[];
  /** Extra permission the role must hold (see src/server/auth/roles.ts). */
  permission?: Permission;
};

async function deny(
  status: 401 | 403,
  reason: string,
  route: string,
  session: CurrentSession | null,
): Promise<NextResponse> {
  if (status === 403 && session) {
    await auditAccessDenied(
      { userId: session.userId, guestId: session.guestId, role: session.role },
      route,
      reason,
    );
  }
  return status === 401 ? apiUnauthenticated(reason) : apiForbidden(reason);
}

/**
 * Authoritative authorization for route handlers.
 *
 * Returns the session when allowed, otherwise a ready-to-return 401/403 response:
 *
 *   const auth = await guardApi({
 *     route: "/api/admin/users",
 *     roles: [AppRole.ADMIN],
 *     permission: Permissions.MANAGE_USERS,
 *   });
 *   if (auth instanceof NextResponse) return auth;
 *
 * Checks, in order: signed in → principal matches the required role family →
 * role allowed → permission held → principal still valid in the database
 * (revoked/deactivated/demoted sessions die here, not in 7 days).
 *
 * This is the second layer: src/proxy.ts already filtered the request, so a
 * handler that reaches this line has passed both — removing one still leaves
 * the other enforcing.
 */
export async function guardApi(options: GuardOptions): Promise<CurrentSession | NextResponse> {
  const { route, roles, permission } = options;
  const session = await getCurrentSession();

  if (!session) return deny(401, "unauthenticated", route, null);

  if (roles && roles.length > 0) {
    const wantsGuest = roles.every((r) => r === AppRole.GUEST);
    const wantsStaff = roles.some((r) => r === AppRole.STAFF || r === AppRole.ADMIN);

    if (wantsGuest && (session.kind !== "guest" || !session.guestId)) {
      return deny(403, "role_not_allowed", route, session);
    }
    if (wantsStaff && (session.kind !== "staff" || !session.userId)) {
      return deny(403, "role_not_allowed", route, session);
    }
    if (!roles.includes(session.role)) {
      return deny(403, "role_not_allowed", route, session);
    }
  }

  if (permission) {
    if (session.kind === "staff") {
      // Tenant permissions come from the active organization membership, not
      // the legacy User.role column (REQ-019/REQ-047).
      const member = session.userId
        ? await loadTenantMember(session.userId, session.orgId)
        : null;
      if (!member) return deny(403, "tenant_membership_required", route, session);
      if (!hasOrgPermission(member.role, permission)) {
        return deny(403, "permission_denied", route, session);
      }
    } else if (!hasPermission(session.role, permission)) {
      return deny(403, "permission_denied", route, session);
    }
  }

  if (!(await isSessionValid(session))) {
    return deny(401, "session_invalid", route, session);
  }

  return session;
}

/**
 * Guest-only API guard. The guest id always comes from the session — a request
 * body, query param or header can never point it at somebody else's rows.
 */
export async function guardGuestApi(route: string): Promise<CurrentSession | NextResponse> {
  return guardApi({ route, roles: [AppRole.GUEST] });
}

/**
 * Platform-operator API guard. Deliberately separate from `guardApi`: tenant
 * roles never grant platform access, and vice versa (REQ-026).
 */
export async function guardPlatformApi(
  route: string,
  permission?: PlatformPermission,
): Promise<{ session: CurrentSession; platformRole: string } | NextResponse> {
  const session = await getCurrentSession();
  if (!session) return apiUnauthenticated();
  if (session.kind !== "staff") return apiForbidden("role_not_allowed");
  if (!(await isSessionValid(session))) return apiUnauthenticated("session_invalid");
  try {
    const platformRole = await requirePlatform(session, permission);
    return { session, platformRole };
  } catch (error) {
    if (error instanceof TenancyError) {
      return error.code === "unauthenticated" ? apiUnauthenticated() : apiForbidden(error.message);
    }
    throw error;
  }
}

/**
 * Resolve the concrete tenant hotel for an already-guarded staff session.
 * Resource routes pass a resolver so the hotel comes from the resource, never
 * from a request parameter.
 */
export async function guardTenantHotel(
  session: CurrentSession,
  permission?: Permission,
  resolveHotelId?: () => Promise<string>,
): Promise<{ member: TenantMember; hotelId: string } | NextResponse> {
  try {
    return await tenantHotelFor(session, permission, resolveHotelId);
  } catch (error) {
    if (error instanceof TenancyError) {
      if (error.code === "not_found") {
        return NextResponse.json({ error: "not_found" }, { status: 404 });
      }
      if (error.code === "unauthenticated") return apiUnauthenticated();
      return apiForbidden(error.message);
    }
    throw error;
  }
}

/** Maps tenancy errors from services/routes to HTTP responses. */
export function tenancyErrorResponse(error: unknown): NextResponse {
  if (error instanceof TenancyError) {
    if (error.code === "not_found") {
      return NextResponse.json({ error: "not_found" }, { status: 404 });
    }
    if (error.code === "unauthenticated") return apiUnauthenticated();
    return apiForbidden(error.message);
  }
  throw error;
}
