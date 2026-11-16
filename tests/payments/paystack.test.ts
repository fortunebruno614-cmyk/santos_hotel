import "../../scripts/load-env";
import { createHmac } from "node:crypto";
import { after, before, describe, it } from "node:test";
import assert from "node:assert/strict";
import { paystackProvider } from "../../src/server/payments/provider";
import { getPaystackSecretKey } from "../../src/config/payments";

/** P6 Paystack provider: signature verification, payload normalization, keys. */

const UNIT_SECRET = "sk_test_unit_secret";
const originalSecret = process.env.PAYSTACK_SECRET_KEY;
const originalWebhookSecret = process.env.PAYSTACK_WEBHOOK_SECRET;

describe("P6 Paystack provider", () => {
  before(() => {
    process.env.PAYSTACK_SECRET_KEY = UNIT_SECRET;
    delete process.env.PAYSTACK_WEBHOOK_SECRET;
  });

  after(() => {
    if (originalSecret === undefined) delete process.env.PAYSTACK_SECRET_KEY;
    else process.env.PAYSTACK_SECRET_KEY = originalSecret;
    if (originalWebhookSecret === undefined) delete process.env.PAYSTACK_WEBHOOK_SECRET;
    else process.env.PAYSTACK_WEBHOOK_SECRET = originalWebhookSecret;
  });

  it("verifies x-paystack-signature as HMAC-SHA512 over the raw body", () => {
    const rawBody = JSON.stringify({
      event: "charge.success",
      data: { reference: "ref", amount: 10000, currency: "NGN", status: "success" },
    });
    const signature = createHmac("sha512", UNIT_SECRET).update(rawBody, "utf8").digest("hex");

    assert.equal(paystackProvider.verifyWebhookSignature(rawBody, signature), true);
    assert.equal(paystackProvider.verifyWebhookSignature(rawBody + " ", signature), false);
    assert.equal(paystackProvider.verifyWebhookSignature(rawBody, null), false);
    assert.equal(paystackProvider.verifyWebhookSignature(rawBody, "deadbeef"), false);
  });

  it("normalizes charge.success with kobo converted to Naira", () => {
    const event = paystackProvider.parseWebhookEvent(
      JSON.stringify({
        event: "charge.success",
        data: {
          reference: "SH-2026-000123-abc",
          amount: 14_400_000,
          currency: "NGN",
          status: "success",
        },
      }),
    );

    assert.deepEqual(event, {
      type: "payment.succeeded",
      provider: "paystack",
      providerReference: "SH-2026-000123-abc",
      amount: "144000.00",
      currency: "NGN",
    });
  });

  it("normalizes charge.failed and ignores unrelated events", () => {
    const failed = paystackProvider.parseWebhookEvent(
      JSON.stringify({
        event: "charge.failed",
        data: { reference: "ref_failed", amount: 5000, currency: "NGN", status: "failed" },
      }),
    );
    assert.equal(failed?.type, "payment.failed");
    assert.equal(failed?.amount, "50.00");

    const unrelated = paystackProvider.parseWebhookEvent(
      JSON.stringify({ event: "transfer.success", data: { reference: "trf" } }),
    );
    assert.equal(unrelated, null);
  });

  it("rejects malformed payloads instead of treating them as payments", () => {
    assert.throws(() => paystackProvider.parseWebhookEvent("not json"));
    assert.throws(() =>
      paystackProvider.parseWebhookEvent(JSON.stringify({ event: "charge.success", data: {} })),
    );
  });

  it("refuses a publishable key for server-side calls", () => {
    process.env.PAYSTACK_SECRET_KEY = "pk_test_publishable";
    assert.throws(() => getPaystackSecretKey(), /publishable/);
  });
});
