import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { z } from "zod";
import { PAYMENT_PROVIDER, getWebhookSecret } from "@/config/payments";
import { moneyString, type Money } from "@/server/pricing/model";

/**
 * P6 provider layer — the seam where a real payment gateway plugs in.
 *
 * The hotel has not confirmed its gateway yet (docs/OPEN_QUESTIONS.md #4), so
 * the default provider is a fully working **mock**: it issues references,
 * signs webhook payloads with HMAC-SHA256 and can succeed or fail on demand.
 * The service (src/server/payments/service.ts) only ever talks to this
 * interface — swapping the mock for Stripe/whoever is one registry entry and
 * one env var, with no change to the money logic or its tests.
 *
 * Security contract the mock already enforces (and a real provider must too):
 *   - the service stores only `providerReference` — never card data;
 *   - webhook payloads are signed; the endpoint verifies the signature against
 *     the raw request body before anything is parsed or written;
 *   - signature comparison is constant-time.
 */

export type WebhookEvent =
  | {
      type: "payment.succeeded";
      provider: string;
      providerReference: string;
      amount: string;
      currency: string;
    }
  | {
      type: "payment.failed";
      provider: string;
      providerReference: string;
      amount: string;
      currency: string;
    };

export const WebhookEventSchema = z.object({
  type: z.enum(["payment.succeeded", "payment.failed"]),
  provider: z.string().min(1).max(40),
  providerReference: z.string().min(1).max(120),
  amount: z.string().regex(/^\d{1,10}\.\d{2}$/),
  currency: z.string().min(3).max(8),
});

export const SIGNATURE_HEADER = "x-payment-signature";

export type PaymentIntent = {
  /** Stored on the Payment row; every webhook is correlated by this value. */
  providerReference: string;
  /** Where the guest completes the payment (real: hosted page; mock: /pay/…). */
  checkoutPath: string;
};

export interface PaymentProvider {
  readonly id: string;
  createIntent(input: {
    amount: Money;
    currency: string;
    bookingReference: string;
  }): Promise<PaymentIntent>;
  /** Returns false when the provider refused; the service never fakes success. */
  refund(input: { providerReference: string; amount: Money }): Promise<boolean>;
  verifyWebhookSignature(rawBody: string, signature: string | null | undefined): boolean;
  /**
   * Signs an event the way the provider would. Real providers sign on their
   * side and call our webhook; the mock exposes this so the mock-complete
   * endpoint and the tests can produce genuine signed payloads.
   */
  signWebhookEvent(event: WebhookEvent): { rawBody: string; signature: string };
}

// ---------------------------------------------------------------------------
// Mock provider — the reversible default while #4 is open
// ---------------------------------------------------------------------------

function hmacHex(rawBody: string): string {
  return createHmac("sha256", getWebhookSecret()).update(rawBody, "utf8").digest("hex");
}

export const mockProvider: PaymentProvider = {
  id: "mock",

  async createIntent({ bookingReference }) {
    return {
      providerReference: `mock_${randomBytes(12).toString("hex")}`,
      checkoutPath: `/pay/${encodeURIComponent(bookingReference)}`,
    };
  },

  async refund() {
    // The mock always accepts refunds; a real provider returns the gateway's
    // verdict and the service refuses to record money that was not returned.
    return true;
  },

  verifyWebhookSignature(rawBody, signature) {
    if (!signature) return false;
    const expected = hmacHex(rawBody);
    const provided = signature.trim();
    if (expected.length !== provided.length) return false;
    return timingSafeEqual(Buffer.from(expected, "utf8"), Buffer.from(provided, "utf8"));
  },

  signWebhookEvent(event) {
    const rawBody = JSON.stringify(event);
    return { rawBody, signature: hmacHex(rawBody) };
  },
};

// ---------------------------------------------------------------------------
// Registry
// ---------------------------------------------------------------------------

const REGISTRY: Record<string, PaymentProvider> = {
  [mockProvider.id]: mockProvider,
};

export class PaymentProviderNotConfiguredError extends Error {
  readonly providerId: string;
  constructor(providerId: string) {
    super(
      `payment provider "${providerId}" is not configured — add it to src/server/payments/provider.ts`,
    );
    this.name = "PaymentProviderNotConfiguredError";
    this.providerId = providerId;
  }
}

export function getPaymentProvider(id: string = PAYMENT_PROVIDER): PaymentProvider {
  const provider = REGISTRY[id];
  if (!provider) throw new PaymentProviderNotConfiguredError(id);
  return provider;
}

/** Canonical money shape for webhook payloads (two decimals, never scientific). */
export function webhookAmount(amount: Money): string {
  return moneyString(amount);
}
