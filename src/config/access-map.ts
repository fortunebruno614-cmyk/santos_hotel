import { AppRole, hasPermission, type Permission } from "@/server/auth/roles";

/**
 * P3 access map — the single source of truth for who may reach what.
 *
 * Consumed by:
 *   - src/proxy.ts            (edge pre-filter: redirects pages, 401/403 JSON for /api)
 *   - src/server/auth/api.ts  (authoritative handler guard, re-checks against the DB)
 *   - src/server/auth/dal.ts  (page guards: requireStaffOrAdmin / requireAdmin / requireGuest)
 *
 * Rules are evaluated top-down, first match wins — keep specific rules above their
 * catch-all prefix (e.g. `/api/admin/users` above `/api/admin`).
 *
 * Defaults for anything not listed:
 *   - pages   → public (the marketing/booking site is open; staff areas must live
 *               under `/admin` and guest areas under `/account`).
 *   - /api/** → requires *some* signed-in session. Nothing under /api is ever
 *               anonymous unless it is explicitly listed here as public, and no
 *               role-gated subtree can be forgotten because `/api/admin` and
 *               `/api/staff` are catch-alls.
 *
 * When you add a route, register it here first — that is the P3 contract.
 */

export type Principal = "staff" | "guest";

export type Access =
  | { kind: "public" }
  | { kind: "authenticated" }
  | { kind: "restricted"; principal: Principal; roles: AppRole[]; permission?: Permission };

export type AccessRule = { path: string; access: Access };

const staff = (path: string, roles: AppRole[], permission?: Permission): AccessRule => ({
  path,
  access: { kind: "restricted", principal: "staff", roles, permission },
});

const guest = (path: string): AccessRule => ({
  path,
  access: { kind: "restricted", principal: "guest", roles: [AppRole.GUEST] },
});

const open = (path: string): AccessRule => ({ path, access: { kind: "public" } });

export const ACCESS_RULES: AccessRule[] = [
  // --- Public site (home, room list/detail, availability search, booking flow) ---
  open("/"),
  open("/rooms"),
  open("/search"),
  open("/booking"),
  open("/login"),
  open("/signup"),
  open("/unauthorized"),

  // --- Guest area (profile, booking history) ---
  guest("/account"),

  // --- Staff/admin console (dashboard, reservations, rooms, rates, guests,
  //     payments, reports) — everything under /admin is staff-only by catch-all ---
  staff("/admin/users", [AppRole.ADMIN], "MANAGE_USERS"),
  staff("/admin", [AppRole.STAFF, AppRole.ADMIN]),

  // --- API: public ---
  open("/api/auth"),
  open("/api/public"),

  // --- API: guest-only (never accepts a guest id from the request) ---
  guest("/api/account"),

  // --- API: admin-only ---
  staff("/api/admin/users", [AppRole.ADMIN], "MANAGE_USERS"),
  staff("/api/admin/audit", [AppRole.ADMIN], "MANAGE_AUDIT"),
  staff("/api/admin", [AppRole.ADMIN]),

  // --- API: staff + admin ---
  staff("/api/staff/reservations", [AppRole.STAFF, AppRole.ADMIN], "MANAGE_RESERVATIONS"),
  staff("/api/staff", [AppRole.STAFF, AppRole.ADMIN]),
];

/** Unlisted API routes are not anonymous: they require a session of any role. */
const API_FALLBACK: Access = { kind: "authenticated" };
const PAGE_FALLBACK: Access = { kind: "public" };

export function isApiPath(path: string) {
  return path.startsWith("/api/") || path === "/api";
}

function matches(path: string, prefix: string) {
  return path === prefix || path.startsWith(`${prefix}/`);
}

export function matchAccess(path: string): Access {
  for (const rule of ACCESS_RULES) {
    if (matches(path, rule.path)) return rule.access;
  }
  return isApiPath(path) ? API_FALLBACK : PAGE_FALLBACK;
}

/** Shape the access map needs from a session (structurally compatible with the JWT payload). */
export type SessionLike = {
  kind: "staff" | "guest";
  role: AppRole;
  userId?: string;
  guestId?: string;
} | null;

export type AccessDecision = "allow" | "unauthenticated" | "forbidden";

/**
 * Pure decision function shared by the proxy, the API guards and post-login
 * redirects, so the same path can never mean two different things.
 */
export function evaluateAccess(access: Access, session: SessionLike): AccessDecision {
  if (access.kind === "public") return "allow";
  if (!session) return "unauthenticated";

  if (access.kind === "authenticated") return "allow";

  const principalOk =
    access.principal === "staff"
      ? session.kind === "staff" && Boolean(session.userId)
      : session.kind === "guest" && Boolean(session.guestId);

  if (!principalOk) return "forbidden";
  if (!access.roles.includes(session.role)) return "forbidden";
  if (access.permission && !hasPermission(session.role, access.permission)) return "forbidden";
  return "allow";
}

/** Convenience: decide for a concrete path. */
export function canAccess(path: string, session: SessionLike): AccessDecision {
  return evaluateAccess(matchAccess(path), session);
}

/**
 * Validates a post-login `?next=` target so it can never leave this origin or
 * bounce a user into an API endpoint. Returns null when the value is unusable.
 */
export function sanitizeNextPath(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const value = raw.trim();
  if (!value.startsWith("/")) return null;
  if (value.startsWith("//") || value.includes("\\") || value.includes("..")) return null;
  if (value.includes("#") || value.length > 512) return null;
  if (value === "/api" || value.startsWith("/api/")) return null;
  return value;
}

/**
 * Picks where a user lands after signing in: the requested `next` target when
 * their session is actually allowed there, otherwise the role's home area.
 */
export function resolvePostLoginPath(session: SessionLike, rawNext: unknown): string {
  const next = sanitizeNextPath(rawNext);
  if (next && session && canAccess(next, session) === "allow") return next;
  if (!session) return "/";
  if (session.kind === "guest") return "/account";
  return "/admin";
}
