import { NextResponse } from "next/server";
import { setSessionCookie } from "@/server/auth/service";
import { verifySession } from "@/server/auth/session";

/**
 * Redeems the short-lived session token an AI-chat sign-up hands back
 * (src/server/ai/tools.ts → signup_user).
 *
 * Why this exists: the chat streams, and once streaming starts the response
 * headers — including Set-Cookie — can no longer change. So the turn carries
 * a 15-minute signed JWT instead, and the widget redeems it here on a plain,
 * unstreamed request that sets the real 7-day session cookie.
 *
 * The token is the same HMAC-signed payload as a session (same secret, same
 * verifier), it is single-purpose and expires in minutes, and only a *guest*
 * payload is accepted — staff sessions are never minted through chat.
 */
export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as { token?: unknown } | null;
  const token = typeof body?.token === "string" && body.token.length <= 4_096 ? body.token : null;
  if (!token) {
    return NextResponse.json({ error: "invalid_token" }, { status: 400 });
  }

  const payload = await verifySession(token);
  if (!payload || payload.kind !== "guest" || !payload.guestId) {
    return NextResponse.json({ error: "invalid_token" }, { status: 401 });
  }

  await setSessionCookie(payload);
  return NextResponse.json({
    role: payload.role,
    guestId: payload.guestId,
    email: payload.email ?? null,
  });
}
