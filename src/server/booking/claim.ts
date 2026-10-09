import { SignJWT, jwtVerify } from "jose";
import { z } from "zod";
import { getSecretKey } from "@/server/auth/session";

/**
 * P5 booking claim — a short-lived signed cookie that proves "this browser
 * created reservation SH-2026-000042".
 *
 * It exists for guests who booked without an account
 * (docs/OPEN_QUESTIONS.md #13, `GUEST_BOOKING_REQUIRES_ACCOUNT=false`): after
 * checkout they have no session, yet the confirmation page and an eligible
 * cancellation must still be reachable. The claim carries the booking reference
 * and the guest id, is signed with the session secret, and grants nothing else
 * — it is scoped to that one reservation and expires in 24 hours.
 *
 * It is never a substitute for a session: a signed-in guest's `/account` page
 * works without it, and staff routes never read it.
 */

export const BOOKING_CLAIM_COOKIE = "booking_claim";
export const BOOKING_CLAIM_TTL = "24h";

const CLAIM_KIND = "booking";

const ClaimSchema = z.object({
  kind: z.literal(CLAIM_KIND),
  ref: z.string().min(8).max(32),
  gid: z.string().min(1),
  iat: z.number().optional(),
  exp: z.number().optional(),
});

export type BookingClaim = { reference: string; guestId: string };

export async function signBookingClaim(
  claim: BookingClaim,
  expiresIn: string = BOOKING_CLAIM_TTL,
): Promise<string> {
  return new SignJWT({ kind: CLAIM_KIND, ref: claim.reference, gid: claim.guestId })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(expiresIn)
    .sign(getSecretKey());
}

export async function verifyBookingClaim(
  token: string | undefined | null,
): Promise<BookingClaim | null> {
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, getSecretKey(), { algorithms: ["HS256"] });
    const parsed = ClaimSchema.safeParse(payload);
    if (!parsed.success) return null;
    return { reference: parsed.data.ref, guestId: parsed.data.gid };
  } catch {
    return null;
  }
}
