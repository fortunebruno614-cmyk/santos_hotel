/**
 * Public Firebase web-app configuration.
 *
 * Firebase web API keys are *not* secrets — they identify the project and are
 * safe to ship to the browser (access is controlled by Firebase Security Rules
 * and the authorized-domain list in the Firebase console). Values can still be
 * overridden per environment with the `NEXT_PUBLIC_FIREBASE_*` variables in
 * `.env.local`, which is the recommended setup for staging/production.
 *
 * The literal values below are the `santos-hotel-final` project defaults, so a
 * fresh checkout works without extra setup.
 */
const defaults = {
  apiKey: "AIzaSyD1uajQ2Xeec2cfvVNuV59x7vs53Y78d0k",
  authDomain: "santos-hotel-final.firebaseapp.com",
  projectId: "santos-hotel-final",
  storageBucket: "santos-hotel-final.firebasestorage.app",
  messagingSenderId: "882289736613",
  appId: "1:882289736613:web:efd75b3ef9e75537e2864c",
  measurementId: "G-PCPZMQD1TM",
} as const;

function read(value: string | undefined, fallback: string) {
  const trimmed = value?.trim();
  return trimmed ? trimmed : fallback;
}

export const firebaseConfig = {
  apiKey: read(process.env.NEXT_PUBLIC_FIREBASE_API_KEY, defaults.apiKey),
  authDomain: read(process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN, defaults.authDomain),
  projectId: read(process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID, defaults.projectId),
  storageBucket: read(process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET, defaults.storageBucket),
  messagingSenderId: read(
    process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
    defaults.messagingSenderId,
  ),
  appId: read(process.env.NEXT_PUBLIC_FIREBASE_APP_ID, defaults.appId),
  measurementId: read(process.env.NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID, defaults.measurementId),
} as const;

/** Project id used to verify ID-token issuer/audience on the server. */
export const FIREBASE_PROJECT_ID = firebaseConfig.projectId;
