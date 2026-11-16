/**
 * P6 payment flags — reversible defaults while the real gateway is unconfirmed
 * (docs/OPEN_QUESTIONS.md #4). Nothing here is a decision: every value is an env
 * var, and the provider registry (src/server/payments/provider.ts) is where a
 * real gateway plugs in without touching the service.
 *
 *   PAYMENT_PROVIDER         (#4, default "mock")
 *       Which provider implementation handles intents, refunds and webhook
 *       signatures. "mock" is a fully working local gateway (signed webhooks,
 *       success/failure/refund) so the whole money path is testable today;
 *       "paystack" is the real Naira gateway (hosted checkout + callback +
 *       signed webhooks). Pick one with this env var.
 *
 *   PAYMENT_WEBHOOK_SECRET   (#4)
 *       HMAC-SHA256 secret webhook payloads are signed with for the mock
 *       provider. Falls back to SESSION_SECRET, then to the documented dev
 *       constant — production refuses to run without one (see getWebhookSecret).
 *
 *   PAYSTACK_SECRET_KEY      (#4, required when PAYMENT_PROVIDER=paystack)
 *       Server-only secret key (sk_test_… / sk_live_…). Used for transaction
 *       initialize/verify/refund and to verify the x-paystack-signature header.
 *       Never prefix it with NEXT_PUBLIC_ and never commit a live key.
 *
 *   PAYSTACK_WEBHOOK_SECRET  (#4, optional)
 *       Paystack's dedicated webhook signing secret (whsec_…), when one has been
 *       generated in the dashboard. Falls back to PAYSTACK_SECRET_KEY, which is
 *       what Paystack signs with by default.
 *
 *   PAYSTACK_CALLBACK_URL    (#4, optional)
 *       URL Paystack redirects the guest to after checkout. Defaults to
 *       APP_URL + /api/public/payments/callback.
 *
 *   STRIPE_SECRET_KEY        (#4, required when PAYMENT_PROVIDER=stripe)
 *       Server-only secret key (sk_test_… / sk_live_…). Used to create Checkout
 *       Sessions, read payment status and issue refunds. Never prefix it with
 *       NEXT_PUBLIC_ and never commit a live key.
 *
 *   STRIPE_WEBHOOK_SECRET    (#4, required when PAYMENT_PROVIDER=stripe)
 *       Signing secret (whsec_…) for the `Stripe-Signature` header. The
 *       endpoint refuses deliveries without it. `stripe listen` prints one for
 *       local development.
 *
 *   STRIPE_CHARGE_CURRENCY   (#4, default "USD")
 *       Currency Stripe charges in. Bookings stay in the hotel's currency; the
 *       total is converted at the site's documented NGN/USD rate, and the
 *       payment row is recorded in this currency.
 *
 *   REFUND_ON_CANCELLATION   (#6, default true)
 *       When a booking is cancelled, automatically refund any captured
 *       (PAID / PARTIALLY_REFUNDED) payments. false = money stays captured and
 *       staff refund manually from the reservation page.
 */

function envString(raw: string | undefined, fallback: string): string {
  const value = raw?.trim();
  return value ? value : fallback;
}

export const PAYMENT_PROVIDER = envString(process.env.PAYMENT_PROVIDER, "mock").toLowerCase();

export const REFUND_ON_CANCELLATION = process.env.REFUND_ON_CANCELLATION !== "false";

// ---------------------------------------------------------------------------
// Paystack (real Naira gateway)
// ---------------------------------------------------------------------------

/** Paystack REST base; overridable only for tests/staging proxies. */
export const PAYSTACK_BASE_URL = envString(
  process.env.PAYSTACK_BASE_URL,
  "https://api.paystack.co",
).replace(/\/+$/, "");

export const PAYSTACK_CALLBACK_PATH = "/api/public/payments/callback";

/** Server-only secret key. Fails closed rather than sending an empty bearer. */
export function getPaystackSecretKey(): string {
  const key = process.env.PAYSTACK_SECRET_KEY?.trim();
  if (!key) {
    throw new Error(
      "PAYSTACK_SECRET_KEY is not set. Paystack server-side checkout needs the " +
        "secret key (sk_test_… or sk_live_…) — the publishable pk_… key cannot " +
        "initialize transactions or verify webhooks.",
    );
  }
  if (key.startsWith("pk_")) {
    throw new Error(
      "PAYSTACK_SECRET_KEY starts with pk_, which is Paystack's publishable key. " +
        "Use the matching secret key (sk_test_… or sk_live_…) instead.",
    );
  }
  return key;
}

/** Webhook signing secret: dedicated whsec_… when set, else the secret key. */
export function getPaystackWebhookSecret(): string {
  return process.env.PAYSTACK_WEBHOOK_SECRET?.trim() || getPaystackSecretKey();
}

/** Optional public key (kept for future inline checkout); never used server-side. */
export function getPaystackPublicKey(): string | null {
  return process.env.PAYSTACK_PUBLIC_KEY?.trim() || null;
}

/** Absolute site origin used for gateway redirect URLs. */
export function appBaseUrl(): string {
  const raw =
    process.env.APP_URL?.trim() ||
    process.env.NEXT_PUBLIC_APP_URL?.trim() ||
    process.env.NEXT_PUBLIC_SITE_URL?.trim() ||
    "http://localhost:3000";
  return raw.replace(/\/+$/, "");
}

/** Absolute URL Paystack redirects to after the hosted checkout. */
export function paystackCallbackUrl(): string {
  const configured = process.env.PAYSTACK_CALLBACK_URL?.trim();
  if (configured) return configured;
  return `${appBaseUrl()}${PAYSTACK_CALLBACK_PATH}`;
}

// ---------------------------------------------------------------------------
// Stripe (hosted card checkout, charged in USD)
// ---------------------------------------------------------------------------

/**
 * Currency Stripe presents to the guest. Bookings are priced in the hotel's
 * currency (NGN), so the provider converts the total at the same documented
 * rate the site uses for USD display (1,500 NGN = 1 USD) and records the
 * payment row in the charge currency.
 */
export const STRIPE_CHARGE_CURRENCY = envString(
  process.env.STRIPE_CHARGE_CURRENCY,
  "USD",
).toUpperCase();

/** Server-only secret key. Fails closed rather than sending an empty bearer. */
export function getStripeSecretKey(): string {
  const key = process.env.STRIPE_SECRET_KEY?.trim();
  if (!key) {
    throw new Error(
      "STRIPE_SECRET_KEY is not set. Stripe server-side checkout needs the " +
        "secret key (sk_test_… or sk_live_…) — the publishable pk_… key cannot " +
        "create Checkout Sessions or verify webhooks.",
    );
  }
  if (key.startsWith("pk_")) {
    throw new Error(
      "STRIPE_SECRET_KEY starts with pk_, which is Stripe's publishable key. " +
        "Use the matching secret key (sk_test_… or sk_live_…) instead.",
    );
  }
  return key;
}

/**
 * Signing secret for Stripe webhooks (whsec_…). Stripe signs `Stripe-Signature`
 * with this value; without it the webhook endpoint must refuse deliveries.
 * `stripe listen` prints one for local development.
 */
export function getStripeWebhookSecret(): string {
  const secret = process.env.STRIPE_WEBHOOK_SECRET?.trim();
  if (!secret) {
    throw new Error(
      "STRIPE_WEBHOOK_SECRET is not set. Copy the whsec_… signing secret from " +
        "the Stripe dashboard (or `stripe listen`) so webhook signatures can be verified.",
    );
  }
  return secret;
}

const DEV_FALLBACK_WEBHOOK_SECRET = "dev-webhook-secret-change-in-production";
let cachedWebhookSecret: Uint8Array | null = null;

/**
 * Secret used to sign/verify webhook payloads. Fails closed in production
 * instead of silently verifying with a known constant (same contract as
 * getSecretKey in src/server/auth/session.ts).
 */
export function getWebhookSecret(): Uint8Array {
  if (cachedWebhookSecret) return cachedWebhookSecret;
  const secret = process.env.PAYMENT_WEBHOOK_SECRET ?? process.env.SESSION_SECRET;
  if (!secret) {
    if (process.env.NODE_ENV === "production") {
      throw new Error(
        "PAYMENT_WEBHOOK_SECRET (or SESSION_SECRET) is not set. Refusing to verify " +
          "payment webhooks in production — set it in the environment (see .env.example).",
      );
    }
    cachedWebhookSecret = new TextEncoder().encode(DEV_FALLBACK_WEBHOOK_SECRET);
    return cachedWebhookSecret;
  }
  cachedWebhookSecret = new TextEncoder().encode(secret);
  return cachedWebhookSecret;
}
