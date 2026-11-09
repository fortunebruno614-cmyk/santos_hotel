# Firebase Authentication (Google sign-in)

Santo keeps its existing signed-cookie session system. Firebase is used **only**
to prove a Google identity; the app still issues and validates its own `session`
JWT, so `src/proxy.ts`, the access map, `requireGuest`, and audit logging work
unchanged.

## Flow

1. The visitor clicks **Continue with Google** (`src/components/auth/google-sign-in-button.tsx`).
2. Firebase opens the Google popup and returns a Firebase user with local
   persistence enabled (`src/lib/firebase/client.ts`).
3. The browser sends the Firebase **ID token** to `POST /api/auth/firebase`.
4. The server verifies it with Google's public JWKS (`src/server/auth/firebase.ts`):
   RS256 signature, `aud`/`iss` = the configured project, a verified email, and
   the `google.com` provider.
5. The server finds/creates a `Guest` row and calls the existing
   `setSessionCookie()`. The httpOnly `session` cookie is the app session.
6. `FirebaseSessionSync` restores that cookie after a browser restart if the
   7-day cookie expired but Firebase still has the Google user.

Sign-out clears Firebase first, then the app cookie through the audited
`logout` server action (`src/components/auth/sign-out-button.tsx`).

## Setup

1. Firebase console → **Authentication** → Sign-in method → enable **Google**.
2. Authentication → Settings → **Authorized domains** → add `localhost` and the
   production host.
3. Public web config is read from `NEXT_PUBLIC_FIREBASE_*` (see `.env.example`).
   The `santos-hotel-final` defaults are built into
   `src/lib/firebase/config.ts`, so local development works immediately.

No Firebase Admin SDK or service-account key is required.

## Data model

The migration `20261109000000_firebase_google_auth` adds to `guests`:

- `firebase_uid` — unique; links the Google identity to one guest.
- `avatar_url` — Google profile picture.
- `auth_provider` — `google` for linked accounts.

An existing password guest with the same **verified** Google email is linked,
not duplicated. A guest already linked to a different Firebase uid is rejected
(`identity_conflict`) rather than silently overwritten.

## Error handling

The API returns `{ ok: false, error }` with a specific HTTP status:

| Code | Status | Meaning |
| ---- | ------ | ------- |
| `invalid_body` | 400 | Missing/oversized token or wrong content type |
| `invalid_token` | 401 | Bad signature, issuer, audience, subject |
| `email_unverified` | 403 | Google email not verified |
| `provider_not_allowed` | 403 | Not a Google Firebase sign-in |
| `account_disabled` | 403 | Guest `is_active = false` |
| `signup_disabled` | 403 | New guests blocked by `GUEST_ACCOUNTS_ENABLED=false` |
| `staff_account` | 403 | Email belongs to a staff User; use staff sign-in |
| `identity_conflict` | 409 | Email linked to another Firebase identity |
| `rate_limited` | 429 | Shared login throttle (5-minute window) |
| `server_error` | 500 | Unexpected failure (details are not leaked) |

The button translates these and the common Firebase popup/domain/network errors
via `auth.google.error.*` dictionary keys.

## Deliberate boundaries

- Staff accounts stay on the password form. Google sign-in creates **guest**
  sessions only, so a social login cannot shadow an admin console session.
- Registration still respects `GUEST_ACCOUNTS_ENABLED`; the Google button is
  hidden on `/signup` when guest accounts are disabled.
- The API checks `Origin`, requires JSON, caps token length, and reuses the
  existing login throttle and audit trail.
