# Santos Hotel — Booking Website

A luxury hotel booking platform built with Next.js 16, Supabase, Paystack, Resend email, and Firebase Cloud Messaging push notifications.

## Tech Stack

- **Framework**: Next.js 16 (App Router, Turbopack)
- **Language**: TypeScript
- **Auth & Database**: Supabase (PostgreSQL)
- **Payments**: Paystack (Nigerian Naira)
- **Email**: Resend
- **Push Notifications**: Firebase Cloud Messaging (FCM)

## Getting Started

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Environment Variables

Copy `.env.example` to `.env.local` and fill in all values:

```bash
cp .env.example .env.local
```

| Variable | Purpose |
|----------|---------|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Supabase anon/publishable key |
| `PAYSTACK_SECRET_KEY` | Paystack server-side secret key |
| `NEXT_PUBLIC_PAYSTACK_KEY` | Paystack public key (browser) |
| `RESEND_API_KEY` | Resend email API key |
| `NEXT_PUBLIC_FIREBASE_API_KEY` | Firebase Web App API key |
| `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN` | Firebase Auth domain |
| `NEXT_PUBLIC_FIREBASE_PROJECT_ID` | Firebase project ID |
| `NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET` | Firebase Storage bucket |
| `NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID` | FCM sender ID |
| `NEXT_PUBLIC_FIREBASE_APP_ID` | Firebase App ID |
| `NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID` | Firebase Analytics measurement ID (optional) |
| `NEXT_PUBLIC_FIREBASE_VAPID_KEY` | Web Push VAPID key (Firebase Console → Cloud Messaging → Web Push certificates) |
| `FIREBASE_SERVICE_ACCOUNT_JSON` | Firebase Admin service account JSON (Firebase Console → Project Settings → Service accounts → Generate new private key) |

**Never commit `.env.local`.** It is already in `.gitignore`.

---

## Firebase Cloud Messaging (FCM)

### Setup

1. Create a Firebase project at [console.firebase.google.com](https://console.firebase.google.com).
2. Register a **Web App** in Project Settings → General and copy the config values into `.env.local`.
3. Enable **Cloud Messaging** in Project Settings → Cloud Messaging.
4. Under **Web Push certificates**, click **Generate key pair** and copy the VAPID key into `NEXT_PUBLIC_FIREBASE_VAPID_KEY`.
5. Under **Service accounts**, click **Generate new private key** and paste the JSON into `FIREBASE_SERVICE_ACCOUNT_JSON` (this enables server-side sending).
6. Run `create-fcm-tokens-table.sql` in the Supabase SQL Editor to create the device token table.

### How FCM token registration works

- A client component (`NotificationProvider`) is mounted in the root layout.
- On page load it checks browser support and current permission state.
- When the user is logged in and permission is `granted`, it calls `registerForNotifications()` which:
  1. Ensures the service worker is registered (`/firebase-messaging-sw.js`).
  2. Calls `register()` to obtain a Firebase Installation ID (FID).
  3. The `onRegistered` callback delivers the FID to the provider.
  4. The provider calls the `registerDeviceToken()` server action, which upserts the FID into the `fcm_tokens` Supabase table (unique on `user_id + token` prevents duplicates).
- The floating bell button (bottom-right) toggles registration on/off.
- Token refresh: the SDK re-registers on FID change; `onUnregistered` cleans up stale tokens.

### How notifications are sent

Three ways:

1. **Server action** (simplest):
   ```ts
   import { sendTestNotification } from "@/app/actions";
   await sendTestNotification("Hello", "World");
   ```

2. **HTTP API** (`POST /api/notifications/send`):
   ```json
   {
     "title": "Welcome!",
     "body": "Thanks for booking with us.",
     "url": "/dashboard"
   }
   ```
   Omitting `fid`/`fids`/`topic` defaults to sending to the caller's own devices.

   Send to specific devices:
   ```json
   { "fids": ["fid1", "fid2"], "title": "...", "body": "..." }
   ```

   Topic-based:
   ```json
   { "topic": "announcements", "title": "...", "body": "..." }
   ```

3. **Direct module import** (server-side only):
   ```ts
   import { sendPushNotification, sendPushNotifications, sendPushToTopic } from "@/lib/notifications/sender";
   ```

### Automatic booking confirmation push

When a payment is verified (`/api/verify-payment`), a push notification is automatically sent to all the user's registered devices, linking to the thank-you page.

### How to test notifications

1. Log in and click the **bell icon** (bottom-right) to enable notifications.
2. Grant permission in the browser prompt.
3. Click the bell again to disable/enable, or use the **Send test** flow.
4. Or call the API directly:
   ```bash
   curl -X POST http://localhost:3000/api/notifications/send \
     -H "Content-Type: application/json" \
     -d '{"title":"Test","body":"Hello from Santos Hotel"}'
   ```
   (must be authenticated — include the session cookie)

5. Or complete a booking to receive the automatic confirmation notification.

### Troubleshooting

| Problem | Fix |
|---------|-----|
| "No registered devices" | Enable notifications via the bell button first. |
| Permission prompt never appears | Check browser site settings → Notifications. |
| Service worker not registering | Visit `/firebase-messaging-sw.js` directly in the browser. |
| `FIREBASE_SERVICE_ACCOUNT_JSON is not configured` | Paste the service account JSON into `.env.local`. |
| Token not saving | Run `create-fcm-tokens-table.sql` in Supabase SQL Editor. |
| Notifications work on localhost but not production | HTTPS is required for service workers in production. |
| VAPID key error | Generate a Web Push key pair in Firebase Console → Cloud Messaging. |

---

## Running locally

```bash
npm install
npm run dev        # development
npm run build      # production build
npm run start      # start production server
npm run lint       # ESLint
npx tsc --noEmit   # type check
```

## Database setup

Run the following SQL files in the Supabase SQL Editor (in order):

1. `create-bookings-table.sql`
2. `create-fcm-tokens-table.sql`
3. `setup-storage.sql` (for avatar uploads)

## License

Private project.
