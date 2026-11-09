import { NextResponse } from "next/server";
import { AppRole } from "@/server/auth/roles";
import { setSessionCookie } from "@/server/auth/service";
import {
  FirebaseAuthError,
  signInGuestWithFirebase,
  verifyFirebaseIdToken,
  type FirebaseAuthErrorCode,
} from "@/server/auth/firebase";
import { auditLogin, auditLoginFailed, auditSignup } from "@/server/audit/write";
import { clientIp } from "@/server/auth/request";
import { clearFailedLogins, loginThrottleState, recordFailedLogin } from "@/server/auth/throttle";
import { resolvePostLoginPath, sanitizeNextPath } from "@/config/access-map";

const THROTTLE_KEY = "firebase-google";

function errorStatus(code: FirebaseAuthErrorCode | "invalid_body" | "rate_limited" | "server_error") {
  if (code === "invalid_token") return 401;
  if (code === "invalid_body") return 400;
  if (code === "rate_limited") return 429;
  if (code === "identity_conflict") return 409;
  if (code === "server_error") return 500;
  return 403;
}

function jsonError(
  code: FirebaseAuthErrorCode | "invalid_body" | "rate_limited" | "server_error",
  retryAfterSec?: number,
) {
  return NextResponse.json(
    { ok: false, error: code },
    {
      status: errorStatus(code),
      headers: {
        "cache-control": "no-store",
        ...(retryAfterSec ? { "retry-after": String(retryAfterSec) } : {}),
      },
    },
  );
}

/** Accept only same-origin browser requests (login CSRF defence). */
function isSameOrigin(request: Request) {
  const origin = request.headers.get("origin");
  if (!origin) return true; // non-browser clients and same-origin form posts omit it
  try {
    return new URL(origin).origin === new URL(request.url).origin;
  } catch {
    return false;
  }
}

/**
 * Exchanges a Firebase Google ID token for the app's own signed session cookie.
 *
 * The Firebase token is verified server-side (signature, issuer, audience,
 * verified email, Google provider) and then mapped to a Guest row. Everything
 * after this point — proxy.ts, the access map, requireGuest, audit logs — works
 * exactly as it does for password sign-in.
 */
export async function POST(request: Request) {
  if (!isSameOrigin(request)) return jsonError("invalid_body");

  const contentType = request.headers.get("content-type") ?? "";
  if (!contentType.toLowerCase().includes("application/json")) {
    return jsonError("invalid_body");
  }

  const body = (await request.json().catch(() => null)) as
    | { idToken?: unknown; next?: unknown }
    | null;
  const idToken = typeof body?.idToken === "string" ? body.idToken : "";
  if (!idToken || idToken.length > 10_000) return jsonError("invalid_body");

  const next = sanitizeNextPath(body?.next);
  const ip = clientIp(request.headers);

  const throttle = loginThrottleState(ip, THROTTLE_KEY);
  if (throttle.limited) {
    await auditLoginFailed("guest", THROTTLE_KEY, "rate_limited", ip);
    return jsonError("rate_limited", throttle.retryAfterSec);
  }

  try {
    const identity = await verifyFirebaseIdToken(idToken);
    const { payload, guest, created } = await signInGuestWithFirebase(identity);

    clearFailedLogins(ip, THROTTLE_KEY);
    await setSessionCookie(payload);

    if (created) {
      await auditSignup({ guestId: guest.id }, guest.email);
    } else {
      await auditLogin({ guestId: guest.id }, AppRole.GUEST, guest.email);
    }

    return NextResponse.json(
      {
        ok: true,
        redirectTo: resolvePostLoginPath(payload, next),
        user: {
          name: [guest.firstName, guest.lastName].filter(Boolean).join(" "),
          email: guest.email,
          avatarUrl: guest.avatarUrl,
        },
      },
      { headers: { "cache-control": "no-store" } },
    );
  } catch (error) {
    if (error instanceof FirebaseAuthError) {
      recordFailedLogin(ip, THROTTLE_KEY);
      await auditLoginFailed("guest", THROTTLE_KEY, error.code, ip);
      return jsonError(error.code);
    }
    console.error("firebase sign-in failed", error);
    return jsonError("server_error");
  }
}
