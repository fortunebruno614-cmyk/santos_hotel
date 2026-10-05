import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { verifySession } from "@/server/auth/session";
import { isApiPath, matchAccess, evaluateAccess } from "@/config/access-map";
import { auditAccessDenied } from "@/server/audit/write";

/**
 * P3 request filter (Next 16 `proxy.ts` — the middleware.ts convention was renamed).
 *
 * This is the *pre-filter*: decisions come from the signed session + the access
 * map, and run before any rendering starts. It is not the authority — every route
 * handler re-checks with `guardApi` / `require*`, which also re-validate the
 * principal against the database (see src/server/auth/api.ts and dal.ts).
 *
 * Response shape by area type:
 *   - page request → 307 to /login (anonymous) or /unauthorized (wrong role)
 *   - /api request → 401 / 403 JSON, never a redirect
 */
export async function proxy(request: NextRequest) {
  const path = request.nextUrl.pathname;
  const isApi = isApiPath(path);

  const token = request.cookies.get("session")?.value;
  const session = token ? await verifySession(token) : null;

  const decision = evaluateAccess(matchAccess(path), session);
  if (decision === "allow") return NextResponse.next();

  // Denials for a *signed-in* principal are security events. Anonymous probes
  // (401) are not logged — they would drown the trail without identifying anyone.
  // Proxy runs on the Node.js runtime by default in Next 16, so the shared
  // Prisma client is available here; the writer swallows its own failures.
  if (decision === "forbidden" && session) {
    await auditAccessDenied(
      { userId: session.userId, guestId: session.guestId, role: session.role },
      path,
      "forbidden",
    );
  }

  if (isApi) {
    return NextResponse.json(
      { error: decision === "unauthenticated" ? "unauthenticated" : "forbidden" },
      { status: decision === "unauthenticated" ? 401 : 403 },
    );
  }

  if (decision === "unauthenticated") {
    const url = new URL("/login", request.url);
    const next = `${request.nextUrl.pathname}${request.nextUrl.search}`;
    if (next !== "/login" && next !== "/signup") url.searchParams.set("next", next);
    return NextResponse.redirect(url);
  }

  return NextResponse.redirect(new URL("/unauthorized", request.url));
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:png|jpg|jpeg|gif|svg|webp|ico|css|js|map|woff2?)$).*)",
  ],
};
