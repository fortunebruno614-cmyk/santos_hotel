import { createRemoteJWKSet, jwtVerify } from "jose";
import { AppRole } from "@/server/auth/roles";
import type { SessionPayload } from "@/server/auth/session";
import { normalizeEmail } from "@/server/auth/validation";
import { FIREBASE_PROJECT_ID } from "@/lib/firebase/config";
import { GUEST_ACCOUNTS_ENABLED } from "@/config/auth";
import { prisma } from "@/lib/prisma";

/**
 * Firebase ID-token verification without the Firebase Admin SDK.
 *
 * ID tokens are RS256 JWTs signed by Google. Verifying against Google's public
 * JWKS means the deployment needs no service-account key: only the public
 * project id (already in `NEXT_PUBLIC_FIREBASE_PROJECT_ID`) is required.
 * `jose` caches the remote key set for us.
 */
const FIREBASE_JWKS = createRemoteJWKSet(
  new URL("https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com"),
);

export type FirebaseAuthErrorCode =
  | "invalid_token"
  | "email_missing"
  | "email_unverified"
  | "provider_not_allowed"
  | "account_disabled"
  | "signup_disabled"
  | "staff_account"
  | "identity_conflict";

export class FirebaseAuthError extends Error {
  constructor(readonly code: FirebaseAuthErrorCode) {
    super(code);
    this.name = "FirebaseAuthError";
  }
}

export type FirebaseIdentity = {
  uid: string;
  email: string;
  name: string | null;
  picture: string | null;
};

export async function verifyFirebaseIdToken(idToken: string): Promise<FirebaseIdentity> {
  let payload;
  try {
    ({ payload } = await jwtVerify(idToken, FIREBASE_JWKS, {
      algorithms: ["RS256"],
      audience: FIREBASE_PROJECT_ID,
      issuer: `https://securetoken.google.com/${FIREBASE_PROJECT_ID}`,
    }));
  } catch {
    throw new FirebaseAuthError("invalid_token");
  }

  // https://firebase.google.com/docs/auth/admin/verify-id-tokens#verify_id_tokens_using_a_third-party_jwt_library
  const uid = typeof payload.sub === "string" ? payload.sub : "";
  if (!uid || uid.length > 128) throw new FirebaseAuthError("invalid_token");

  const email = typeof payload.email === "string" ? payload.email.trim() : "";
  if (!email) throw new FirebaseAuthError("email_missing");
  if (payload.email_verified !== true) throw new FirebaseAuthError("email_unverified");

  // This endpoint is the Google button only. Refusing other Firebase
  // providers keeps password/email-link accounts from bypassing the app's own
  // password policy and staff-invite rules.
  const firebase = payload.firebase as { sign_in_provider?: unknown } | undefined;
  if (firebase?.sign_in_provider !== "google.com") {
    throw new FirebaseAuthError("provider_not_allowed");
  }

  return {
    uid,
    email: normalizeEmail(email),
    name: typeof payload.name === "string" ? payload.name : null,
    picture: typeof payload.picture === "string" ? payload.picture : null,
  };
}

function splitDisplayName(name: string | null, email: string) {
  const cleaned = (name ?? "").replace(/\s+/g, " ").trim();
  const parts = cleaned ? cleaned.split(" ") : [];
  const local = email.split("@")[0]?.replace(/[^\p{L}\p{N}._-]/gu, "").slice(0, 80) || "Guest";
  return {
    firstName: (parts.shift() || local).slice(0, 80),
    lastName: parts.join(" ").slice(0, 80),
  };
}

function isUniqueViolation(error: unknown) {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { code?: unknown }).code === "P2002"
  );
}

type GuestAccount = {
  id: string;
  firstName: string;
  lastName: string;
  email: string | null;
  avatarUrl: string | null;
  isActive: boolean;
};

async function findOrCreateGuest(identity: FirebaseIdentity): Promise<{
  guest: GuestAccount;
  created: boolean;
}> {
  const byFirebaseUid = await prisma.guest.findUnique({ where: { firebaseUid: identity.uid } });
  if (byFirebaseUid) {
    if (!byFirebaseUid.isActive) throw new FirebaseAuthError("account_disabled");
    const guest = await prisma.guest.update({
      where: { id: byFirebaseUid.id },
      data: {
        avatarUrl: identity.picture ?? byFirebaseUid.avatarUrl,
        authProvider: "google",
        lastLoginAt: new Date(),
      },
    });
    return { guest, created: false };
  }

  const byEmail = await prisma.guest.findUnique({ where: { email: identity.email } });
  if (byEmail) {
    if (!byEmail.isActive) throw new FirebaseAuthError("account_disabled");
    // A different Google identity already owns this email. Never silently
    // overwrite the link — the guest must contact the hotel to resolve it.
    if (byEmail.firebaseUid && byEmail.firebaseUid !== identity.uid) {
      throw new FirebaseAuthError("identity_conflict");
    }
    const guest = await prisma.guest.update({
      where: { id: byEmail.id },
      data: {
        firebaseUid: identity.uid,
        avatarUrl: identity.picture ?? byEmail.avatarUrl,
        authProvider: "google",
        lastLoginAt: new Date(),
      },
    });
    return { guest, created: false };
  }

  const names = splitDisplayName(identity.name, identity.email);

  // Existing guests can always sign in; only *new* guest accounts respect the
  // same feature flag as the password signup form.
  if (!GUEST_ACCOUNTS_ENABLED) throw new FirebaseAuthError("signup_disabled");

  try {
    const guest = await prisma.guest.create({
      data: {
        firstName: names.firstName,
        lastName: names.lastName,
        email: identity.email,
        firebaseUid: identity.uid,
        avatarUrl: identity.picture,
        authProvider: "google",
        lastLoginAt: new Date(),
      },
    });
    return { guest, created: true };
  } catch (error) {
    // Two tabs can exchange the same first sign-in concurrently. The unique
    // email constraint decides the winner; the loser links to that row.
    if (!isUniqueViolation(error)) throw error;
    const winner = await prisma.guest.findUnique({ where: { email: identity.email } });
    if (!winner || winner.firebaseUid !== identity.uid) {
      throw new FirebaseAuthError("identity_conflict");
    }
    const guest = await prisma.guest.update({
      where: { id: winner.id },
      data: { lastLoginAt: new Date() },
    });
    return { guest, created: false };
  }
}

/**
 * Turns a verified Google identity into the app's existing guest session.
 *
 * Staff accounts are deliberately kept on the password form: mixing the two
 * principal kinds in one browser would let a Google guest session shadow an
 * admin console session.
 */
export async function signInGuestWithFirebase(identity: FirebaseIdentity) {
  const staff = await prisma.user.findUnique({
    where: { email: identity.email },
    select: { id: true, isActive: true },
  });
  if (staff?.isActive) throw new FirebaseAuthError("staff_account");

  const { guest, created } = await findOrCreateGuest(identity);

  const payload: SessionPayload = {
    kind: "guest",
    role: AppRole.GUEST,
    guestId: guest.id,
    email: guest.email ?? undefined,
  };

  return { payload, guest, created };
}
