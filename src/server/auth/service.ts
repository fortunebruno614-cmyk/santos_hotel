import { cookies } from "next/headers";
import { prisma } from "@/lib/prisma";
import { hashPassword, verifyPassword } from "@/server/auth/crypto";
import { signSession, type SessionPayload } from "@/server/auth/session";
import { AppRole } from "@/server/auth/roles";

export const SESSION_COOKIE = "session";
const SESSION_MAX_AGE = 60 * 60 * 24 * 7;

export async function authenticateStaff(email: string, password: string) {
  const user = await prisma.user.findUnique({ where: { email } });
  if (!user || !user.isActive) return null;
  const ok = await verifyPassword(password, user.passwordHash);
  if (!ok) return null;

  await prisma.user.update({
    where: { id: user.id },
    data: { lastLoginAt: new Date() },
  });

  const payload: SessionPayload = {
    kind: "staff",
    role: user.role as AppRole,
    userId: user.id,
    email: user.email,
  };
  return { payload, user };
}

export async function authenticateGuest(email: string, password: string) {
  const guest = await prisma.guest.findUnique({ where: { email } });
  if (!guest || !guest.isActive || !guest.passwordHash) return null;
  const ok = await verifyPassword(password, guest.passwordHash);
  if (!ok) return null;

  await prisma.guest.update({
    where: { id: guest.id },
    data: { lastLoginAt: new Date() },
  });

  const payload: SessionPayload = {
    kind: "guest",
    role: AppRole.GUEST,
    guestId: guest.id,
    email: guest.email ?? undefined,
  };
  return { payload, guest };
}

export async function createGuestAccount(input: {
  firstName: string;
  lastName: string;
  email: string;
  password: string;
}) {
  const existing = await prisma.guest.findUnique({ where: { email: input.email } });
  if (existing) return null;

  const passwordHash = await hashPassword(input.password);
  const guest = await prisma.guest.create({
    data: {
      firstName: input.firstName,
      lastName: input.lastName,
      email: input.email,
      passwordHash,
    },
  });

  const payload: SessionPayload = {
    kind: "guest",
    role: AppRole.GUEST,
    guestId: guest.id,
    email: guest.email ?? undefined,
  };
  return { payload, guest };
}

export async function setSessionCookie(payload: SessionPayload) {
  const token = await signSession(payload);
  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_MAX_AGE,
  });
}

export async function clearSessionCookie() {
  const cookieStore = await cookies();
  cookieStore.delete(SESSION_COOKIE);
}

export async function readSessionCookie() {
  const cookieStore = await cookies();
  return cookieStore.get(SESSION_COOKIE)?.value;
}
