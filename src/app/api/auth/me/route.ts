import { NextResponse } from "next/server";
import { getCurrentSession, isSessionValid } from "@/server/auth/dal";

export async function GET() {
  const session = await getCurrentSession();
  if (!session) return NextResponse.json({ error: "unauthenticated" }, { status: 401 });

  // A well-formed token is not enough: the account behind it must still exist,
  // still be active and still hold the role the token claims.
  if (!(await isSessionValid(session))) {
    return NextResponse.json({ error: "session_invalid" }, { status: 401 });
  }

  return NextResponse.json(session);
}
