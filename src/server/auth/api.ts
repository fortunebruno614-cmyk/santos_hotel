import { NextResponse } from "next/server";
import { getCurrentSession, isSessionValid, type CurrentSession } from "@/server/auth/dal";
import { AppRole, hasPermission, type Permission } from "@/server/auth/roles";
import { auditAccessDenied } from "@/server/audit/write";

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

  if (permission && !hasPermission(session.role, permission)) {
    return deny(403, "permission_denied", route, session);
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
