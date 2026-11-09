import { NextResponse } from "next/server";
import { getCurrentSession, getCurrentUser, isSessionValid } from "@/server/auth/dal";

export async function GET() {
  const session = await getCurrentSession();
  if (!session) return NextResponse.json({ error: "unauthenticated" }, { status: 401 });

  // A well-formed token is not enough: the account behind it must still exist,
  // still be active and still hold the role the token claims.
  if (!(await isSessionValid(session))) {
    return NextResponse.json({ error: "session_invalid" }, { status: 401 });
  }

  const user = await getCurrentUser();
  const profile = user
    ? "firstName" in user
      ? {
          id: user.id,
          name: [user.firstName, user.lastName].filter(Boolean).join(" "),
          firstName: user.firstName,
          lastName: user.lastName,
          email: user.email,
          avatarUrl: user.avatarUrl,
          authProvider: user.authProvider,
          role: "GUEST",
        }
      : {
          id: user.id,
          name: user.name,
          email: user.email,
          avatarUrl: null,
          authProvider: null,
          role: user.role,
        }
    : null;

  return NextResponse.json({ ...session, user: profile });
}
