import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import Stripe from "stripe";
import { z } from "zod";
import {
  PAYMENT_PROVIDER,
  PAYSTACK_BASE_URL,
  STRIPE_CHARGE_CURRENCY,
  appBaseUrl,
  getPaystackSecretKey,
  getPaystackWebhookSecret,
  getStripeSecretKey,
  getStripeWebhookSecret,
  getWebhookSecret,
  paystackCallbackUrl,
} from "@/config/payments";
import { conversionRate, USD_TO_NGN_RATE } from "@/lib/currency";
import { money, moneyString, type Money } from "@/server/pricing/model";

/**
 * P6 provider layer — the seam where a real payment gateway plugs in.
 *
 * Two providers are registered:
 *   - `mock`     fully working local gateway (signed webhooks, success/failure/
 *                refund) used by the test suite and the reversible default.
 *   - `paystack` real Naira gateway: hosted checkout, transaction verification
 *                and HMAC-SHA512-signed webhooks.
 *
 * The service (src/server/payments/service.ts) only talks to this interface.
 *
 * Security contract every provider enforces:
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

/** The mock provider's HMAC header (Paystack uses `x-paystack-signature`). */
export const SIGNATURE_HEADER = "x-payment-signature";

export type PaymentIntent = {
  /** Stored on the Payment row; every webhook is correlated by this value. */
  providerReference: string;
  /** Where the guest completes the payment (real: hosted page; mock: /pay/…). */
  checkoutPath: string;
};

export type CreateIntentInput = {
  amount: Money;
  currency: string;
  bookingReference: string;
  bookingId: string;
  /** Paystack requires a customer email; the mock ignores it. */
  customerEmail?: string | null;
};

/** Result of asking the gateway whether a checkout actually settled. */
export type VerifiedPayment = {
  status: "succeeded" | "failed" | "pending";
  amount: string;
  currency: string;
};

export interface PaymentProvider {
  readonly id: string;
  /** Header(s) carrying the webhook signature, most-specific first. */
  readonly webhookSignatureHeaders: readonly string[];
  createIntent(input: CreateIntentInput): Promise<PaymentIntent>;
  /**
   * The amount the gateway will actually charge, when it differs from the
   * booking's own currency (Stripe charges USD for NGN-priced bookings). The
   * service stores this on the Payment row so webhooks and refunds correlate.
   */
  chargeAmount?(input: { amount: Money; currency: string }): { amount: Money; currency: string };
  /** Returns false when the provider refused; the service never fakes success. */
  refund(input: { providerReference: string; amount: Money }): Promise<boolean>;
  verifyWebhookSignature(rawBody: string, signature: string | null | undefined): boolean;
  /**
   * Normalizes a provider webhook into the service's canonical event.
   * Returns null for well-formed events this app does not handle (the endpoint
   * still answers 200 so the gateway stops retrying), and throws
   * `InvalidWebhookPayloadError` for malformed payloads.
   */
  parseWebhookEvent(rawBody: string): WebhookEvent | null;
  /** Used by the post-checkout callback when no webhook has arrived yet. */
  verifyTransaction?(reference: string): Promise<VerifiedPayment>;
  /**
   * Signs an event the way the provider would. Real providers sign on their
   * side and call our webhook; the mock exposes this so the mock-complete
   * endpoint and the tests can produce genuine signed payloads.
   */
  signWebhookEvent(event: WebhookEvent): { rawBody: string; signature: string };
}

/** Malformed webhook body — the service maps this to `invalid_webhook`. */
export class InvalidWebhookPayloadError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "InvalidWebhookPayloadError";
  }
}

/** The gateway rejected or failed a server-side request. */
export class PaymentProviderRequestError extends Error {
  readonly status: number;
  constructor(message: string, status = 502) {
    super(message);
    this.name = "PaymentProviderRequestError";
    this.status = status;
  }
}

// ---------------------------------------------------------------------------
// Mock provider — the reversible default used by tests
// ---------------------------------------------------------------------------

function hmacHex(rawBody: string): string {
  return createHmac("sha256", getWebhookSecret()).update(rawBody, "utf8").digest("hex");
}

export const mockProvider: PaymentProvider = {
  id: "mock",
  webhookSignatureHeaders: [SIGNATURE_HEADER],

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

  parseWebhookEvent(rawBody) {
    let parsedJson: unknown;
    try {
      parsedJson = JSON.parse(rawBody);
    } catch {
      throw new InvalidWebhookPayloadError("webhook body is not valid JSON");
    }
    const parsed = WebhookEventSchema.safeParse(parsedJson);
    if (!parsed.success) {
      throw new InvalidWebhookPayloadError("webhook payload failed validation");
    }
    return parsed.data;
  },

  signWebhookEvent(event) {
    const rawBody = JSON.stringify(event);
    return { rawBody, signature: hmacHex(rawBody) };
  },
};

// ---------------------------------------------------------------------------
// Paystack provider — real Naira gateway
// ---------------------------------------------------------------------------

/** Currencies Paystack accepts; amounts are always charged in minor units. */
const PAYSTACK_CURRENCIES = new Set(["NGN", "GHS", "ZAR", "USD", "KES"]);

function toSubunit(amount: Money): number {
  // DECIMAL(10,2) money × 100 is an exact integer (kobo/pesewas/cents).
  return Number(amount.times(100).toFixed(0));
}

function fromSubunit(subunit: number): string {
  if (!Number.isFinite(subunit) || subunit < 0) {
    throw new InvalidWebhookPayloadError("invalid amount in provider payload");
  }
  return (Math.round(subunit) / 100).toFixed(2);
}

async function paystackRequest<T>(
  path: string,
  init: { method?: "GET" | "POST"; body?: unknown } = {},
): Promise<T> {
  const secret = getPaystackSecretKey();
  let response: Response;
  try {
    response = await fetch(`${PAYSTACK_BASE_URL}${path}`, {
      method: init.method ?? "GET",
      headers: {
        Authorization: `Bearer ${secret}`,
        Accept: "application/json",
        ...(init.body === undefined ? {} : { "Content-Type": "application/json" }),
      },
      body: init.body === undefined ? undefined : JSON.stringify(init.body),
      cache: "no-store",
      signal: AbortSignal.timeout(15_000),
    });
  } catch (error) {
    throw new PaymentProviderRequestError(
      `Paystack request failed: ${error instanceof Error ? error.message : "network error"}`,
    );
  }

  const payload = (await response.json().catch(() => null)) as
    | { status?: boolean; message?: string; data?: T }
    | null;
  if (!response.ok || !payload?.status) {
    throw new PaymentProviderRequestError(
      payload?.message ?? `Paystack responded ${response.status}`,
    );
  }
  if (payload.data === undefined) {
    throw new PaymentProviderRequestError("Paystack returned no data");
  }
  return payload.data;
}

function paystackWebhookHmac(rawBody: string): string {
  return createHmac("sha512", getPaystackWebhookSecret()).update(rawBody, "utf8").digest("hex");
}

type PaystackVerifyData = {
  status?: string;
  reference?: string;
  amount?: number;
  currency?: string;
};

export const paystackProvider: PaymentProvider = {
  id: "paystack",
  webhookSignatureHeaders: ["x-paystack-signature", SIGNATURE_HEADER],

  async createIntent({ amount, currency, bookingReference, bookingId, customerEmail }) {
    const code = currency.trim().toUpperCase();
    if (!PAYSTACK_CURRENCIES.has(code)) {
      throw new PaymentProviderRequestError(
        `Paystack does not support ${code}; supported currencies: ${[...PAYSTACK_CURRENCIES].join(", ")}`,
      );
    }
    if (!customerEmail || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(customerEmail)) {
      throw new PaymentProviderRequestError(
        "a guest email address is required to start a Paystack payment",
      );
    }

    const payload = await paystackRequest<{
      authorization_url?: string;
      access_code?: string;
      reference?: string;
    }>("/transaction/initialize", {
      method: "POST",
      body: {
        email: customerEmail,
        amount: toSubunit(amount),
        currency: code,
        // Booking-reference characters are all accepted by Paystack; the random
        // suffix keeps a retry from colliding with an older transaction.
        reference: `${bookingReference}-${randomBytes(5).toString("hex")}`,
        callback_url: paystackCallbackUrl(),
        metadata: { bookingId, bookingReference },
      },
    });

    if (!payload.authorization_url || !payload.reference) {
      throw new PaymentProviderRequestError("Paystack did not return a checkout URL");
    }
    return {
      providerReference: payload.reference,
      checkoutPath: payload.authorization_url,
    };
  },

  async refund({ providerReference, amount }) {
    try {
      await paystackRequest("/refund", {
        method: "POST",
        body: { transaction: providerReference, amount: toSubunit(amount) },
      });
      return true;
    } catch (error) {
      // A 4xx (other than bad credentials) is the gateway refusing the refund;
      // keep the payment captured so staff can retry. Network/auth failures
      // surface as provider_error instead of a misleading "refused".
      if (
        error instanceof PaymentProviderRequestError &&
        error.status >= 400 &&
        error.status < 500 &&
        error.status !== 401 &&
        error.status !== 403
      ) {
        return false;
      }
      throw error;
    }
  },

  verifyWebhookSignature(rawBody, signature) {
    if (!signature) return false;
    const expected = paystackWebhookHmac(rawBody);
    const provided = signature.trim();
    if (expected.length !== provided.length) return false;
    return timingSafeEqual(Buffer.from(expected, "utf8"), Buffer.from(provided, "utf8"));
  },

  parseWebhookEvent(rawBody) {
    let parsedJson: unknown;
    try {
      parsedJson = JSON.parse(rawBody);
    } catch {
      throw new InvalidWebhookPayloadError("webhook body is not valid JSON");
    }
    if (!parsedJson || typeof parsedJson !== "object") {
      throw new InvalidWebhookPayloadError("webhook body is not a JSON object");
    }

    const payload = parsedJson as { event?: unknown; data?: unknown };
    if (typeof payload.event !== "string") {
      throw new InvalidWebhookPayloadError("webhook is missing its event name");
    }

    // Paystack emits many event types; only charge outcomes move money here.
    if (payload.event !== "charge.success" && payload.event !== "charge.failed") {
      return null;
    }

    if (!payload.data || typeof payload.data !== "object") {
      throw new InvalidWebhookPayloadError("webhook is missing its data object");
    }
    const data = payload.data as {
      reference?: unknown;
      amount?: unknown;
      currency?: unknown;
      status?: unknown;
    };
    if (typeof data.reference !== "string" || data.reference.trim() === "") {
      throw new InvalidWebhookPayloadError("webhook is missing the transaction reference");
    }
    const amount = typeof data.amount === "number" ? data.amount : Number(data.amount);
    if (!Number.isFinite(amount)) {
      throw new InvalidWebhookPayloadError("webhook is missing a numeric amount");
    }

    const failed =
      payload.event === "charge.failed" || (data.status !== undefined && data.status !== "success");

    return {
      type: failed ? "payment.failed" : "payment.succeeded",
      provider: "paystack",
      providerReference: data.reference,
      amount: fromSubunit(amount),
      currency:
        typeof data.currency === "string" && data.currency
          ? data.currency.toUpperCase()
          : "NGN",
    };
  },

  async verifyTransaction(reference) {
    const data = await paystackRequest<PaystackVerifyData>(
      `/transaction/verify/${encodeURIComponent(reference)}`,
    );
    if (typeof data.amount !== "number") {
      throw new PaymentProviderRequestError("Paystack verification returned no amount");
    }
    const gatewayStatus = data.status ?? "failed";
    const status: VerifiedPayment["status"] =
      gatewayStatus === "success"
        ? "succeeded"
        : gatewayStatus === "pending" || gatewayStatus === "ongoing"
          ? "pending"
          : "failed";
    return {
      status,
      amount: fromSubunit(data.amount),
      currency: (data.currency ?? "NGN").toUpperCase(),
    };
  },

  signWebhookEvent(event) {
    // Only used by local tooling/tests; Paystack signs its own webhooks.
    const rawBody = JSON.stringify(event);
    return { rawBody, signature: paystackWebhookHmac(rawBody) };
  },
};

// ---------------------------------------------------------------------------
// Stripe provider — hosted card checkout, charged in a supported currency
// ---------------------------------------------------------------------------

/** Currencies Stripe treats as zero-decimal (amount === minor unit). */
const ZERO_DECIMAL_CURRENCIES = new Set([
  "BIF", "CLP", "DJF", "GNF", "JPY", "KMF", "KRW", "MGA",
  "PYG", "RWF", "UGX", "VND", "VUV", "XAF", "XOF", "XPF",
]);

function stripeMinorUnits(amount: Money, currency: string): number {
  const factor = ZERO_DECIMAL_CURRENCIES.has(currency.trim().toUpperCase()) ? 1 : 100;
  return Number(amount.times(factor).toFixed(0));
}

function stripeDecimalAmount(minor: number, currency: string): string {
  if (!Number.isFinite(minor) || minor < 0) {
    throw new InvalidWebhookPayloadError("invalid amount in Stripe payload");
  }
  const factor = ZERO_DECIMAL_CURRENCIES.has(currency.trim().toUpperCase()) ? 1 : 100;
  return moneyString(money(minor / factor));
}

/**
 * Convert a booking total into the currency Stripe charges. Prices stay in the
 * hotel's currency (NGN); the guest is charged the equivalent in
 * STRIPE_CHARGE_CURRENCY at the same rate the site uses for USD display.
 */
function stripeCharge(amount: Money, currency: string): { amount: Money; currency: string } {
  const from = currency.trim().toUpperCase();
  const target = STRIPE_CHARGE_CURRENCY;
  if (from === target) return { amount, currency: target };

  if (from === "NGN" && target === "USD") {
    return { amount: money(amount.div(USD_TO_NGN_RATE)), currency: target };
  }
  if (from === "USD" && target === "NGN") {
    return { amount: money(amount.times(USD_TO_NGN_RATE)), currency: target };
  }
  const rate = conversionRate(from, target);
  if (rate === null) {
    throw new PaymentProviderRequestError(
      `no conversion rate from ${from} to ${target} — set STRIPE_CHARGE_CURRENCY to a supported currency`,
    );
  }
  return { amount: money(amount.times(rate)), currency: target };
}

let cachedStripe: Stripe | null = null;

function stripeClient(): Stripe {
  if (!cachedStripe) cachedStripe = new Stripe(getStripeSecretKey());
  return cachedStripe;
}

function stripePaymentIntentId(session: Stripe.Checkout.Session): string | null {
  const value = session.payment_intent;
  if (!value) return null;
  return typeof value === "string" ? value : value.id;
}

export const stripeProvider: PaymentProvider = {
  id: "stripe",
  webhookSignatureHeaders: ["stripe-signature"],

  chargeAmount({ amount, currency }) {
    return stripeCharge(amount, currency);
  },

  async createIntent({ amount, currency, bookingReference, bookingId, customerEmail }) {
    const charge = stripeCharge(amount, currency);
    const base = appBaseUrl();

    let session: Stripe.Checkout.Session;
    try {
      session = await stripeClient().checkout.sessions.create({
        mode: "payment",
        client_reference_id: bookingReference,
        metadata: {
          bookingId,
          bookingReference,
          // Keep the original amount for reconciliation in the dashboard.
          hotelAmount: moneyString(amount),
          hotelCurrency: currency.toUpperCase(),
        },
        customer_email:
          customerEmail && /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(customerEmail)
            ? customerEmail
            : undefined,
        line_items: [
          {
            quantity: 1,
            price_data: {
              currency: charge.currency.toLowerCase(),
              unit_amount: stripeMinorUnits(charge.amount, charge.currency),
              product_data: {
                name: `Reservation ${bookingReference}`,
                description: `Santo Hotel · ${bookingReference}`,
              },
            },
          },
        ],
        // Stripe replaces {CHECKOUT_SESSION_ID}; the shared callback verifies
        // the session server-side before the guest lands on the confirmation.
        success_url: `${base}/api/public/payments/callback?reference={CHECKOUT_SESSION_ID}`,
        cancel_url: `${base}/pay/${encodeURIComponent(bookingReference)}`,
      });
    } catch (error) {
      if (error instanceof PaymentProviderRequestError) throw error;
      throw new PaymentProviderRequestError(
        `Stripe checkout failed: ${error instanceof Error ? error.message : "unknown error"}`,
      );
    }

    if (!session.url) throw new PaymentProviderRequestError("Stripe did not return a checkout URL");
    return { providerReference: session.id, checkoutPath: session.url };
  },

  async refund({ providerReference, amount }) {
    let session: Stripe.Checkout.Session;
    try {
      session = await stripeClient().checkout.sessions.retrieve(providerReference);
    } catch (error) {
      throw new PaymentProviderRequestError(
        `Stripe could not load ${providerReference}: ${error instanceof Error ? error.message : "unknown error"}`,
      );
    }
    const paymentIntent = stripePaymentIntentId(session);
    if (!paymentIntent) {
      throw new PaymentProviderRequestError(
        `Stripe session ${providerReference} has no captured PaymentIntent to refund`,
      );
    }

    try {
      const refund = await stripeClient().refunds.create({
        payment_intent: paymentIntent,
        amount: stripeMinorUnits(amount, session.currency ?? STRIPE_CHARGE_CURRENCY),
      });
      // Stripe refunds settle asynchronously; failed/canceled are refusals.
      return refund.status !== "failed" && refund.status !== "canceled";
    } catch (error) {
      // A 4xx is a refusal; keep the payment captured so staff can retry.
      if (error instanceof Stripe.errors.StripeError && error.statusCode !== undefined) {
        if (error.statusCode >= 400 && error.statusCode < 500) return false;
      }
      throw new PaymentProviderRequestError(
        `Stripe refund failed: ${error instanceof Error ? error.message : "unknown error"}`,
      );
    }
  },

  verifyWebhookSignature(rawBody, signature) {
    if (!signature) return false;
    try {
      stripeClient().webhooks.constructEvent(rawBody, signature, getStripeWebhookSecret());
      return true;
    } catch {
      return false;
    }
  },

  parseWebhookEvent(rawBody) {
    let event: Stripe.Event;
    try {
      event = JSON.parse(rawBody) as Stripe.Event;
    } catch {
      throw new InvalidWebhookPayloadError("webhook body is not valid JSON");
    }
    if (!event || typeof event.type !== "string" || !event.data?.object) {
      throw new InvalidWebhookPayloadError("webhook payload is not a Stripe event");
    }

    const session = event.data.object as Stripe.Checkout.Session;
    if (typeof session.id !== "string" || session.id.trim() === "") {
      // Other Stripe objects (payment_intent, charge, …) are not correlated by
      // our stored session reference, so answer 200 and ignore them.
      return null;
    }

    const type = event.type;
    const isSuccess = type === "checkout.session.async_payment_succeeded";
    const isCompleted = type === "checkout.session.completed";
    const isFailure = type === "checkout.session.async_payment_failed" || type === "checkout.session.expired";
    if (!isSuccess && !isCompleted && !isFailure) return null;

    // `completed` also fires for delayed payment methods while still unpaid;
    // the async_payment_succeeded event carries the actual capture.
    if (isCompleted && session.payment_status !== "paid") return null;
    if (typeof session.amount_total !== "number") {
      throw new InvalidWebhookPayloadError("Stripe session is missing amount_total");
    }
    const currency = (session.currency ?? STRIPE_CHARGE_CURRENCY).toUpperCase();

    return {
      type: isFailure ? "payment.failed" : "payment.succeeded",
      provider: "stripe",
      providerReference: session.id,
      amount: stripeDecimalAmount(session.amount_total, currency),
      currency,
    };
  },

  async verifyTransaction(reference) {
    let session: Stripe.Checkout.Session;
    try {
      session = await stripeClient().checkout.sessions.retrieve(reference);
    } catch (error) {
      throw new PaymentProviderRequestError(
        `Stripe could not verify ${reference}: ${error instanceof Error ? error.message : "unknown error"}`,
      );
    }
    if (typeof session.amount_total !== "number") {
      throw new PaymentProviderRequestError("Stripe session has no amount_total");
    }
    const currency = (session.currency ?? STRIPE_CHARGE_CURRENCY).toUpperCase();
    const status: VerifiedPayment["status"] =
      session.payment_status === "paid"
        ? "succeeded"
        : session.status === "expired"
          ? "failed"
          : "pending";
    return {
      status,
      amount: stripeDecimalAmount(session.amount_total, currency),
      currency,
    };
  },

  signWebhookEvent(event) {
    // Only used by local tooling; Stripe signs its own webhooks.
    const rawBody = JSON.stringify(event);
    const signature = createHmac("sha256", getStripeWebhookSecret()).update(rawBody, "utf8").digest("hex");
    return { rawBody, signature };
  },
};

// ---------------------------------------------------------------------------
// Registry
// ---------------------------------------------------------------------------

const REGISTRY: Record<string, PaymentProvider> = {
  [mockProvider.id]: mockProvider,
  [paystackProvider.id]: paystackProvider,
  [stripeProvider.id]: stripeProvider,
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
