import { NextResponse } from "next/server";
import { clearSessionCookie, readSessionCookie } from "@/server/auth/service";
import { verifySession } from "@/server/auth/session";
import { auditLogout } from "@/server/audit/write";

export async function POST() {
  const token = await readSessionCookie();
  await clearSessionCookie();

  if (token) {
    const payload = await verifySession(token);
    if (payload?.userId) await auditLogout({ userId: payload.userId });
    else if (payload?.guestId) await auditLogout({ guestId: payload.guestId });
  }

  return NextResponse.json({ ok: true });
}
