import "../../scripts/load-env";
import { after, before, describe, it } from "node:test";
import assert from "node:assert/strict";
import Stripe from "stripe";
import { Prisma } from "../../src/generated/prisma/client";
import { stripeProvider } from "../../src/server/payments/provider";
import {
  STRIPE_CHARGE_CURRENCY,
  getStripeSecretKey,
} from "../../src/config/payments";

/** P6 Stripe provider: currency conversion, webhook normalization, signatures. */

const UNIT_SECRET = "sk_test_unit_secret";
const UNIT_WEBHOOK_SECRET = "whsec_unit_test";
const originalSecret = process.env.STRIPE_SECRET_KEY;
const originalWebhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

function sessionEvent(
  type: string,
  session: Record<string, unknown>,
): string {
  return JSON.stringify({
    id: "evt_test",
    type,
    data: { object: session },
  });
}

describe("P6 Stripe provider", () => {
  before(() => {
    process.env.STRIPE_SECRET_KEY = UNIT_SECRET;
    process.env.STRIPE_WEBHOOK_SECRET = UNIT_WEBHOOK_SECRET;
  });

  after(() => {
    if (originalSecret === undefined) delete process.env.STRIPE_SECRET_KEY;
    else process.env.STRIPE_SECRET_KEY = originalSecret;
    if (originalWebhookSecret === undefined) delete process.env.STRIPE_WEBHOOK_SECRET;
    else process.env.STRIPE_WEBHOOK_SECRET = originalWebhookSecret;
  });

  it("converts an NGN booking total to the Stripe charge currency", () => {
    const charge = stripeProvider.chargeAmount!({
      amount: new Prisma.Decimal("144000.00"),
      currency: "NGN",
    });

    if (STRIPE_CHARGE_CURRENCY === "USD") {
      assert.equal(charge.amount.toFixed(2), "96.00");
      assert.equal(charge.currency, "USD");
    } else {
      // The default is USD; a deployment may pin another supported currency.
      assert.equal(charge.currency, STRIPE_CHARGE_CURRENCY);
    }

    const same = stripeProvider.chargeAmount!({
      amount: new Prisma.Decimal("96.00"),
      currency: STRIPE_CHARGE_CURRENCY,
    });
    assert.equal(same.amount.toFixed(2), "96.00");
    assert.equal(same.currency, STRIPE_CHARGE_CURRENCY);
  });

  it("normalizes a paid checkout session with cents converted to dollars", () => {
    const event = stripeProvider.parseWebhookEvent(
      sessionEvent("checkout.session.completed", {
        id: "cs_test_paid",
        payment_status: "paid",
        status: "complete",
        amount_total: 9600,
        currency: "usd",
      }),
    );

    assert.deepEqual(event, {
      type: "payment.succeeded",
      provider: "stripe",
      providerReference: "cs_test_paid",
      amount: "96.00",
      currency: "USD",
    });
  });

  it("ignores completed sessions that are not yet paid", () => {
    const event = stripeProvider.parseWebhookEvent(
      sessionEvent("checkout.session.completed", {
        id: "cs_test_delayed",
        payment_status: "unpaid",
        status: "complete",
        amount_total: 9600,
        currency: "usd",
      }),
    );
    assert.equal(event, null);
  });

  it("normalizes expiry as a failed payment and ignores unrelated events", () => {
    const failed = stripeProvider.parseWebhookEvent(
      sessionEvent("checkout.session.expired", {
        id: "cs_test_expired",
        payment_status: "unpaid",
        status: "expired",
        amount_total: 9600,
        currency: "usd",
      }),
    );
    assert.equal(failed?.type, "payment.failed");
    assert.equal(failed?.amount, "96.00");

    const unrelated = stripeProvider.parseWebhookEvent(
      JSON.stringify({
        id: "evt_other",
        type: "payment_intent.succeeded",
        data: { object: { id: "pi_test" } },
      }),
    );
    assert.equal(unrelated, null);
  });

  it("rejects malformed payloads instead of treating them as payments", () => {
    assert.throws(() => stripeProvider.parseWebhookEvent("not json"));
    assert.throws(() => stripeProvider.parseWebhookEvent(JSON.stringify({ type: "x" })));
  });

  it("verifies Stripe-Signature over the raw body", () => {
    const rawBody = sessionEvent("checkout.session.completed", {
      id: "cs_test_signed",
      payment_status: "paid",
      status: "complete",
      amount_total: 500,
      currency: "usd",
    });
    const signature = new Stripe(UNIT_SECRET).webhooks.generateTestHeaderString({
      payload: rawBody,
      secret: UNIT_WEBHOOK_SECRET,
    });

    assert.equal(stripeProvider.verifyWebhookSignature(rawBody, signature), true);
    assert.equal(stripeProvider.verifyWebhookSignature(rawBody + " ", signature), false);
    assert.equal(stripeProvider.verifyWebhookSignature(rawBody, null), false);
    assert.equal(stripeProvider.verifyWebhookSignature(rawBody, "deadbeef"), false);
  });

  it("refuses a publishable key for server-side calls", () => {
    process.env.STRIPE_SECRET_KEY = "pk_test_publishable";
    assert.throws(() => getStripeSecretKey(), /publishable/);
  });
});
