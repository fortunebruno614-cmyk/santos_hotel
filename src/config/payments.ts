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
 *       swapping in Stripe/whatever is one registry entry + one env var.
 *
 *   PAYMENT_WEBHOOK_SECRET   (#4)
 *       HMAC-SHA256 secret webhook payloads are signed with. Falls back to
 *       SESSION_SECRET, then to the documented dev constant — production
 *       refuses to run without one (see getWebhookSecret).
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
