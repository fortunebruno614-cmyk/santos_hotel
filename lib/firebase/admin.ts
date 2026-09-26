import { initializeApp, getApps, cert, type AppOptions } from "firebase-admin/app";
import { getMessaging, type Messaging } from "firebase-admin/messaging";

type ServiceAccountJson = {
  project_id?: string;
  private_key?: string;
  client_email?: string;
  [key: string]: unknown;
};

/**
 * Parses the FIREBASE_SERVICE_ACCOUNT_JSON env var.
 * Accepts either the raw service account JSON or a base64-encoded version.
 */
export function getServiceAccount(): ServiceAccountJson | null {
  const raw = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
  if (!raw || raw.trim() === "") {
    return null;
  }

  let json: ServiceAccountJson | null = null;
  try {
    json = JSON.parse(raw) as ServiceAccountJson;
  } catch {
    try {
      json = JSON.parse(Buffer.from(raw, "base64").toString("utf-8")) as ServiceAccountJson;
    } catch {
      return null;
    }
  }
  return json;
}

/**
 * Returns true when a usable Firebase Admin credential is configured.
 */
export function isAdminConfigured(): boolean {
  const sa = getServiceAccount();
  if (!sa) return false;
  return Boolean(sa.project_id && sa.private_key && sa.client_email);
}

let adminAppPromise: Promise<void> | null = null;

/**
 * Initializes the Firebase Admin SDK (singleton). Safe to call repeatedly.
 * Never throws when credentials are missing; callers must check
 * `isAdminConfigured()` first (or call `getAdminMessaging()` which returns null).
 */
async function ensureAdminInitialized(): Promise<void> {
  if (getApps().length > 0) return;

  const sa = getServiceAccount();
  if (!sa) {
    throw new Error("FIREBASE_SERVICE_ACCOUNT_JSON is not configured (server-side only).");
  }

  const options: AppOptions = {
    credential: cert({
      projectId: sa.project_id as string,
      clientEmail: sa.client_email as string,
      privateKey: (sa.private_key as string).replace(/\\n/g, "\n"),
    }),
    projectId: sa.project_id as string,
  };

  initializeApp(options);
}

/**
 * Returns the Firebase Admin Messaging instance, or null if not configured.
 */
export async function getAdminMessaging(): Promise<Messaging | null> {
  if (!isAdminConfigured()) return null;
  if (!adminAppPromise) {
    adminAppPromise = ensureAdminInitialized().catch((err) => {
      adminAppPromise = null;
      throw err;
    });
  }
  await adminAppPromise;
  return getMessaging();
}

/**
 * Human readable hint about how to obtain the service account credential.
 */
export function missingAdminHint(): string {
  return (
    "Set FIREBASE_SERVICE_ACCOUNT_JSON to your Firebase service account JSON " +
    "(Firebase Console > Project Settings > Service accounts > Generate new private key)."
  );
}