import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { cache } from "react";
import { verifySession } from "@/server/auth/session";
import { AppRole, isAdmin, isStaffOrAdmin } from "@/server/auth/roles";
import { prisma } from "@/lib/prisma";

export type CurrentSession = {
  kind: "staff" | "guest";
  role: AppRole;
  userId?: string;
  guestId?: string;
  email?: string | null;
};

export const getCurrentSession = cache(async (): Promise<CurrentSession | null> => {
  const cookieStore = await cookies();
  const sessionCookie = cookieStore.get("session")?.value;
  if (!sessionCookie) return null;
  const payload = await verifySession(sessionCookie);
  if (!payload) return null;
  return {
    kind: payload.kind,
    role: payload.role as AppRole,
    userId: payload.userId,
    guestId: payload.guestId,
    email: payload.email,
  };
});

/**
 * Authoritative check: the JWT is still *valid*, but is the principal behind it
 * still active and still holding the role the token claims?
 *
 * This is what makes a role change, deactivation or account deletion take effect
 * immediately instead of waiting for the 7-day token to expire.
 */
export const isSessionValid = cache(
  async (session: CurrentSession): Promise<boolean> => {
    if (session.kind === "staff") {
      if (!session.userId) return false;
      const user = await prisma.user.findUnique({
        where: { id: session.userId },
        select: { role: true, isActive: true },
      });
      if (!user) return false;
      return user.isActive && user.role === session.role;
    }

    if (!session.guestId) return false;
    const guestRow = await prisma.guest.findUnique({
      where: { id: session.guestId },
      select: { isActive: true },
    });
    if (!guestRow) return false;
    return guestRow.isActive;
  },
);

/** `-1` when there is no session at all — used to pick the right login message. */
export type AuthFailure = "anonymous" | "expired" | "forbidden";

async function resolveSession(): Promise<{ session: CurrentSession } | { failure: AuthFailure }> {
  const session = await getCurrentSession();
  if (!session) return { failure: "anonymous" };
  if (!(await isSessionValid(session))) return { failure: "expired" };
  return { session };
}

function failWith(failure: AuthFailure): never {
  if (failure === "anonymous") redirect("/login");
  // An expired/revoked token keeps signing the login page into a redirect loop,
  // so the page skips its "already signed in" redirect when ?expired=1 is set.
  if (failure === "expired") redirect("/login?expired=1");
  redirect("/unauthorized");
}

export async function requireAuth() {
  const resolved = await resolveSession();
  if ("failure" in resolved) failWith(resolved.failure);
  return resolved.session;
}

export async function requireGuest() {
  const resolved = await resolveSession();
  if ("failure" in resolved) failWith(resolved.failure);
  if (resolved.session.role !== AppRole.GUEST || !resolved.session.guestId) {
    redirect("/unauthorized");
  }
  return resolved.session;
}

export async function requireStaffOrAdmin() {
  const session = await requireAuth();
  if (!isStaffOrAdmin(session.role)) redirect("/unauthorized");
  return session;
}

export async function requireAdmin() {
  const session = await requireAuth();
  if (!isAdmin(session.role)) redirect("/unauthorized");
  return session;
}

export async function getCurrentUser() {
  const s = await getCurrentSession();
  if (!s || !(await isSessionValid(s))) return null;
  if (s.kind === "staff" && s.userId) {
    return prisma.user.findUnique({
      where: { id: s.userId },
      select: { id: true, name: true, email: true, role: true, isActive: true },
    });
  }
  if (s.kind === "guest" && s.guestId) {
    return prisma.guest.findUnique({
      where: { id: s.guestId },
      select: { id: true, firstName: true, lastName: true, email: true, isActive: true },
    });
  }
  return null;
}
