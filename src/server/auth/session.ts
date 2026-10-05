import { SignJWT, jwtVerify } from "jose";
import { z } from "zod";
import { AppRole } from "@/server/auth/roles";

const DEV_FALLBACK_SECRET = "dev-secret-change-in-production";
let cachedKey: Uint8Array | null = null;

/**
 * Fails closed in production instead of silently signing with a known constant.
 * Dev keeps a documented fallback so `npm run dev` works without extra setup.
 */
function getSecretKey(): Uint8Array {
  if (cachedKey) return cachedKey;
  const secret = process.env.SESSION_SECRET;
  if (!secret) {
    if (process.env.NODE_ENV === "production") {
      throw new Error(
        "SESSION_SECRET is not set. Refusing to sign or verify sessions in production — " +
          "set it in the environment (see .env.example).",
      );
    }
    cachedKey = new TextEncoder().encode(DEV_FALLBACK_SECRET);
    return cachedKey;
  }
  cachedKey = new TextEncoder().encode(secret);
  return cachedKey;
}

export type SessionKind = "staff" | "guest";

export type SessionPayload = {
  kind: SessionKind;
  role: AppRole;
  userId?: string;
  guestId?: string;
  email?: string;
  iat?: number;
  exp?: number;
};

/**
 * A token is only trustworthy when its claims are self-consistent: staff
 * sessions carry a user id and the GUEST role, guest sessions carry a guest id.
 * Anything else (legacy, hand-edited, truncated) is rejected as if unsigned.
 */
const PayloadSchema = z
  .object({
    kind: z.enum(["staff", "guest"]),
    role: z.enum([AppRole.ADMIN, AppRole.STAFF, AppRole.GUEST]),
    userId: z.string().min(1).optional(),
    guestId: z.string().min(1).optional(),
    email: z.string().optional(),
    iat: z.number().optional(),
    exp: z.number().optional(),
  })
  .refine(
    (p) =>
      p.kind === "staff"
        ? p.role !== AppRole.GUEST && Boolean(p.userId)
        : p.role === AppRole.GUEST && Boolean(p.guestId),
    { message: "session claims are inconsistent with its kind" },
  );

export async function signSession(payload: SessionPayload, expiresIn = "7d") {
  return new SignJWT({ ...payload })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(expiresIn)
    .sign(getSecretKey());
}

export async function verifySession(token: string): Promise<SessionPayload | null> {
  try {
    const { payload } = await jwtVerify(token, getSecretKey(), { algorithms: ["HS256"] });
    const parsed = PayloadSchema.safeParse(payload);
    return parsed.success ? (parsed.data as SessionPayload) : null;
  } catch {
    return null;
  }
}
