# Email notifications (Resend)

Santo Hotel sends transactional email through [Resend](https://resend.com) from
the server only. The API key is never exposed to the browser and email failures
never roll back a booking or a payment.

## Events

| Business event | Guest email | Admin email |
| -------------- | ----------- | ----------- |
| Reservation created (online) | Reservation received | New reservation needs attention |
| Reservation created by staff as confirmed | Reservation confirmed | New reservation |
| Staff confirms a reservation | Reservation confirmed | — |
| Guest or staff cancels (guest path) | Reservation cancelled | Guest cancelled a reservation |
| Staff cancels (desk path) | Reservation cancelled | — |
| Payment succeeds (webhook/desk capture) | Payment received | Payment received |
| Payment confirms a PENDING booking | Reservation confirmed + payment receipt | Payment received |

Emails are queued after the response with Next.js `after()` so SMTP/API latency
is not added to the booking request. Outside a request context (CLI/tests) the
scheduler starts the work immediately. Every failure is caught and logged.

## Delivery log and dedupe

The existing `notifications` table records one row per recipient/event:

- `recipient`, `subject`, `body` (plain-text version)
- `status`: `PENDING` → `SENT` / `FAILED`
- `error` for failed deliveries
- `providerId` (Resend message id) on success
- `dedupeKey` unique — a webhook replay or retry cannot send the same event twice

Admins can inspect recent delivery rows and send a branded test email at
**Admin → Notifications** (`/admin/notifications`). The page and API are
restricted to `ADMIN` with `MANAGE_SETTINGS`.

## Configuration

Put these in `.env.local` (git-ignored) for local development. In production,
set them as server environment variables:

```env
RESEND_API_KEY=re_...
RESEND_FROM_EMAIL="Santo Hotel <reservations@your-verified-domain.com>"
RESEND_REPLY_TO=reservations@your-verified-domain.com
HOTEL_NOTIFICATION_EMAIL=owner@your-domain.com
APP_URL=https://your-domain.com
EMAIL_ENABLED=true
```

- `RESEND_API_KEY` — required; create it at <https://resend.com/api-keys>.
  Never use a `NEXT_PUBLIC_` prefix.
- `RESEND_FROM_EMAIL` — Resend only accepts `onboarding@resend.dev` in test
  mode (and only to the account owner). Verify a sending domain in Resend and
  use an address on that domain for real guest mail.
- `HOTEL_NOTIFICATION_EMAIL` — optional comma-separated admin recipient(s).
  When absent, the hotel profile email and active organization admin accounts
  are used.
- `RESEND_REPLY_TO` — optional reply-to; falls back to the hotel profile email.
- `APP_URL` — base URL used in email links. Required in production.
- `EMAIL_ENABLED=false` — kill switch; no sends and no notification rows.

`.env` is tracked in this repository as the shared **dev-only** baseline (see
`docs/setup.md`). Do not put a real Resend key in it. `.gitignore` now also
contains an explicit `.env` entry, but an already-tracked file stays tracked;
use `.env.local` for secrets, or `git rm --cached .env` if you deliberately
want to stop tracking the baseline.

## Files

- `src/config/email.ts` — server-only Resend/env configuration
- `src/server/notifications/provider.ts` — Resend SDK transport + test seam
- `src/server/notifications/templates.ts` — branded responsive HTML/plain text
- `src/server/notifications/service.ts` — event routing, recipients, dedupe, log
- `src/server/notifications/schedule.ts` — post-response `after()` scheduling
- `src/app/api/admin/notifications/route.ts` — recent delivery log
- `src/app/api/admin/notifications/test/route.ts` — guarded test send
- `src/app/admin/notifications/` — delivery log page + test form
- `src/server/booking/service.ts` — creation/confirmation/cancellation hooks
- `src/server/payments/service.ts` — payment success/desk-capture hooks

## Testing

Unit/workflow tests use a fake transport and a real temporary booking:

```bash
node --import tsx --test tests/notifications/email.test.ts
npm run typecheck
npm run lint
npm test
```

`scripts/load-env.ts` forces `EMAIL_ENABLED=false` under the Node test runner,
so the normal suite can never send real email. The notification test explicitly
enables the service and injects a fake Resend transport.

Real delivery was verified through the production transport to Resend's
`delivered@resend.dev` test address and to the configured admin inbox. The full
booking workflow (created, confirmed, payment, cancelled) produced nine `SENT`
rows with Resend message ids and zero failures.

## Security notes

- The API key is read only by server modules; a bundle scan confirms it is absent
  from `.next/dev/static`.
- The public booking endpoints never accept recipient addresses from the client.
- Admin notification actions require an authenticated admin session and tenant
  permission.
- Upstream Resend error details are stored in the delivery log but only a generic
  error is returned to admin API callers.
