import "../../scripts/load-env";
import { describe, it, before, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { BookingStatus, PaymentStatus } from "../../src/generated/prisma/enums";
import {
  cancelBooking,
  createBooking,
  transitionBooking,
} from "../../src/server/booking/service";
import { computeQuote } from "../../src/server/pricing/service";
import { moneyString } from "../../src/server/pricing/model";
import {
  getPaymentProvider,
  mockProvider,
} from "../../src/server/payments/provider";
import {
  handleWebhook,
  initiatePayment,
  PaymentError,
  recordDeskPayment,
  refundPayment,
} from "../../src/server/payments/service";
import {
  PAYMENT_TEST_SUFFIX,
  dateOnly,
  deleteTestPaymentGuests,
  ensureTestPaymentStaffUser,
  loadInventory,
  prisma,
} from "../helpers";

/** P6 payments gate: initiate, webhook, replay, failure, refund, reconcile. */

let inventory: Awaited<ReturnType<typeof loadInventory>>;
let staffId = "";
const guestEmail = `payments${PAYMENT_TEST_SUFFIX}`;

async function ensureGuest(email: string): Promise<string> {
  const existing = await prisma.guest.findUnique({ where: { email } });
  if (existing) return existing.id;
  const created = await prisma.guest.create({
    data: { firstName: "P6", lastName: "Payments", email },
  });
  return created.id;
}

async function quotedTotal(roomIds: string[], checkIn: string, checkOut: string): Promise<string> {
  const quote = await computeQuote({
    checkIn: dateOnly(checkIn),
    checkOut: dateOnly(checkOut),
    adults: 2,
    children: 0,
    roomIds,
  });
  return moneyString(quote.snapshot.breakdown.total);
}

async function createTestBooking(
  checkIn: string,
  checkOut: string,
  email = guestEmail,
): Promise<{ id: string; bookingReference: string; guestId: string; total: string }> {
  const guestId = await ensureGuest(email);
  const room = inventory.bySlug.get("deluxe-king")!.rooms[0];
  const total = await quotedTotal([room.id], checkIn, checkOut);
  const booking = await createBooking(
    {
      checkIn,
      checkOut,
      adults: 2,
      children: 0,
      roomIds: [room.id],
      guest: { firstName: "P6", lastName: "Payments", email },
      expectedTotal: total,
    },
    { kind: "guest", guestId },
  );
  return {
    id: booking.id,
    bookingReference: booking.bookingReference,
    guestId,
    total: booking.breakdown.total,
  };
}

function signedEvent(
  type: "payment.succeeded" | "payment.failed",
  providerReference: string,
  amount: string,
  currency = "MYR",
) {
  return mockProvider.signWebhookEvent({
    type,
    provider: "mock",
    providerReference,
    amount,
    currency,
  });
}

describe("P6 payments", () => {
  before(async () => {
    inventory = await loadInventory();
    staffId = await ensureTestPaymentStaffUser();
  });

  beforeEach(async () => {
    await deleteTestPaymentGuests();
  });

  it("initiate creates a PENDING payment; a refreshed pay page reuses the same intent", async () => {
    const booking = await createTestBooking("2027-09-01", "2027-09-03");

    const first = await initiatePayment(booking.id, { guestId: booking.guestId });
    assert.equal(first.created, true);
    assert.equal(first.payment.status, PaymentStatus.PENDING);
    assert.equal(first.payment.amount, booking.total);
    assert.match(first.payment.providerReference ?? "", /^mock_[0-9a-f]{24}$/);
    assert.equal(first.checkoutPath, `/pay/${encodeURIComponent(booking.bookingReference)}`);

    const second = await initiatePayment(booking.id, { guestId: booking.guestId });
    assert.equal(second.created, false, "refresh must not create a second intent");
    assert.equal(second.payment.id, first.payment.id);
    assert.equal(
      second.payment.providerReference,
      first.payment.providerReference,
      "same provider reference — the gateway cannot be double-charged",
    );

    const rows = await prisma.payment.count({ where: { bookingId: booking.id } });
    assert.equal(rows, 1);
  });

  it("a signed success webhook captures the payment and confirms the booking", async () => {
    const booking = await createTestBooking("2027-09-05", "2027-09-07");
    const { payment } = await initiatePayment(booking.id, { guestId: booking.guestId });

    const { rawBody, signature } = signedEvent(
      "payment.succeeded",
      payment.providerReference!,
      booking.total,
    );
    const outcome = await handleWebhook(rawBody, signature);
    assert.equal(outcome.ok, true);
    assert.equal(outcome.outcome, "applied");
    if (outcome.outcome === "applied") {
      assert.equal(outcome.bookingStatus, BookingStatus.CONFIRMED);
    }

    const stored = await prisma.payment.findUniqueOrThrow({ where: { id: payment.id } });
    assert.equal(stored.status, PaymentStatus.PAID);
    assert.ok(stored.paidAt, "paidAt is recorded");

    const row = await prisma.booking.findUniqueOrThrow({ where: { id: booking.id } });
    assert.equal(row.bookingStatus, BookingStatus.CONFIRMED);
    assert.equal(row.paymentStatus, PaymentStatus.PAID);
  });

  it("a replayed webhook is a no-op — never a double capture", async () => {
    const booking = await createTestBooking("2027-09-09", "2027-09-11");
    const { payment } = await initiatePayment(booking.id, { guestId: booking.guestId });

    const event = signedEvent("payment.succeeded", payment.providerReference!, booking.total);
    const first = await handleWebhook(event.rawBody, event.signature);
    assert.equal(first.outcome, "applied");

    const replay = await handleWebhook(event.rawBody, event.signature);
    assert.equal(replay.ok, true);
    assert.equal(replay.outcome, "replay");

    const stored = await prisma.payment.findUniqueOrThrow({ where: { id: payment.id } });
    assert.equal(stored.status, PaymentStatus.PAID);
    const succeededAudits = await prisma.auditLog.count({
      where: { action: "payment.succeeded", entityId: payment.id },
    });
    assert.equal(succeededAudits, 1, "the replay must not write a second capture audit");
  });

  it("a failed payment leaves the booking PENDING and unpaid — never Confirmed", async () => {
    const booking = await createTestBooking("2027-09-13", "2027-09-15");
    const { payment } = await initiatePayment(booking.id, { guestId: booking.guestId });

    const { rawBody, signature } = signedEvent(
      "payment.failed",
      payment.providerReference!,
      booking.total,
    );
    const outcome = await handleWebhook(rawBody, signature);
    assert.equal(outcome.outcome, "applied");

    const stored = await prisma.payment.findUniqueOrThrow({ where: { id: payment.id } });
    assert.equal(stored.status, PaymentStatus.FAILED);

    const row = await prisma.booking.findUniqueOrThrow({ where: { id: booking.id } });
    assert.equal(row.bookingStatus, BookingStatus.PENDING, "a failed payment never confirms");
    assert.notEqual(row.paymentStatus, PaymentStatus.PAID);
  });

  it("an unsigned or badly signed webhook is rejected before any write", async () => {
    const booking = await createTestBooking("2027-09-17", "2027-09-19");
    const { payment } = await initiatePayment(booking.id, { guestId: booking.guestId });
    const event = signedEvent("payment.succeeded", payment.providerReference!, booking.total);

    await assert.rejects(
      handleWebhook(event.rawBody, null),
      (error: unknown) => error instanceof PaymentError && error.code === "invalid_signature",
    );
    await assert.rejects(
      handleWebhook(event.rawBody, "deadbeef".repeat(8)),
      (error: unknown) => error instanceof PaymentError && error.code === "invalid_signature",
    );

    const stored = await prisma.payment.findUniqueOrThrow({ where: { id: payment.id } });
    assert.equal(stored.status, PaymentStatus.PENDING, "nothing was captured");
  });

  it("a webhook whose amount does not match the payment is refused", async () => {
    const booking = await createTestBooking("2027-09-21", "2027-09-23");
    const { payment } = await initiatePayment(booking.id, { guestId: booking.guestId });

    const wrongAmount = (
      Math.round((parseFloat(booking.total) + 1) * 100) / 100
    ).toFixed(2);
    const { rawBody, signature } = signedEvent(
      "payment.succeeded",
      payment.providerReference!,
      wrongAmount,
    );
    await assert.rejects(
      handleWebhook(rawBody, signature),
      (error: unknown) => error instanceof PaymentError && error.code === "amount_mismatch",
    );

    const stored = await prisma.payment.findUniqueOrThrow({ where: { id: payment.id } });
    assert.equal(stored.status, PaymentStatus.PENDING);
  });

  it("an event for an unknown reference is accepted (200) and audited for reconciliation", async () => {
    const { rawBody, signature } = signedEvent(
      "payment.succeeded",
      "mock_does_not_exist_000000000000",
      "100.00",
    );
    const outcome = await handleWebhook(rawBody, signature);
    assert.equal(outcome.ok, true);
    assert.equal(outcome.outcome, "orphaned");

    const audit = await prisma.auditLog.findFirst({
      where: { action: "payment.orphaned", entityId: "mock_does_not_exist_000000000000" },
    });
    assert.ok(audit, "reconciliation leaves an audit trail");
  });

  it("a success webhook on a CANCELLED booking records the money but never resurrects it", async () => {
    const booking = await createTestBooking("2027-09-25", "2027-09-27");
    const { payment } = await initiatePayment(booking.id, { guestId: booking.guestId });

    // Guest cancels while the payment is still pending (free window).
    await cancelBooking(
      { bookingId: booking.id },
      { kind: "guest", guestId: booking.guestId },
    );

    // A late success arrives (e.g. the card settled after cancellation).
    const { rawBody, signature } = signedEvent(
      "payment.succeeded",
      payment.providerReference!,
      booking.total,
    );
    await handleWebhook(rawBody, signature);

    const row = await prisma.booking.findUniqueOrThrow({ where: { id: booking.id } });
    assert.equal(row.bookingStatus, BookingStatus.CANCELLED, "the booking stays cancelled");

    const stored = await prisma.payment.findUniqueOrThrow({ where: { id: payment.id } });
    // The pending intent was retired by... no — it was still PENDING, so the
    // capture applies; staff refund it (asserted in the refund tests).
    assert.equal(stored.status, PaymentStatus.PAID);
  });

  it("desk capture records a PAID payment and confirms the booking; a double-click cannot capture twice", async () => {
    const booking = await createTestBooking("2027-09-29", "2027-10-01");

    const payment = await recordDeskPayment(booking.id, { userId: staffId });
    assert.equal(payment.status, PaymentStatus.PAID);
    assert.equal(payment.provider, "desk");
    assert.match(payment.providerReference ?? "", /^desk_/);

    const row = await prisma.booking.findUniqueOrThrow({ where: { id: booking.id } });
    assert.equal(row.bookingStatus, BookingStatus.CONFIRMED);
    assert.equal(row.paymentStatus, PaymentStatus.PAID);

    await assert.rejects(
      recordDeskPayment(booking.id, { userId: staffId }),
      (error: unknown) => error instanceof PaymentError && error.code === "already_paid",
    );
    const rows = await prisma.payment.count({ where: { bookingId: booking.id } });
    assert.equal(rows, 1);
  });

  it("a full refund moves the payment and the booking to REFUNDED", async () => {
    const booking = await createTestBooking("2027-10-03", "2027-10-05");
    const { payment } = await initiatePayment(booking.id, { guestId: booking.guestId });
    const event = signedEvent("payment.succeeded", payment.providerReference!, booking.total);
    await handleWebhook(event.rawBody, event.signature);

    const refunded = await refundPayment({ paymentId: payment.id }, { userId: staffId });
    assert.equal(refunded.status, PaymentStatus.REFUNDED);
    assert.equal(refunded.refundedAmount, booking.total);

    const row = await prisma.booking.findUniqueOrThrow({ where: { id: booking.id } });
    assert.equal(row.paymentStatus, PaymentStatus.REFUNDED);
  });

  it("a partial refund moves the payment to PARTIALLY_REFUNDED and leaves a balance", async () => {
    const booking = await createTestBooking("2027-10-07", "2027-10-09");
    const { payment } = await initiatePayment(booking.id, { guestId: booking.guestId });
    const event = signedEvent("payment.succeeded", payment.providerReference!, booking.total);
    await handleWebhook(event.rawBody, event.signature);

    const half = (Math.round((parseFloat(booking.total) / 2) * 100) / 100).toFixed(2);
    const partial = await refundPayment({ paymentId: payment.id, amount: half }, { userId: staffId });
    assert.equal(partial.status, PaymentStatus.PARTIALLY_REFUNDED);
    assert.equal(partial.refundedAmount, half);

    const row = await prisma.booking.findUniqueOrThrow({ where: { id: booking.id } });
    assert.equal(row.paymentStatus, PaymentStatus.PARTIALLY_REFUNDED);

    // The remaining balance can still be refunded to finish the job.
    const rest = await refundPayment({ paymentId: payment.id }, { userId: staffId });
    assert.equal(rest.status, PaymentStatus.REFUNDED);
  });

  it("refunding more than the captured amount is refused", async () => {
    const booking = await createTestBooking("2027-10-11", "2027-10-13");
    const { payment } = await initiatePayment(booking.id, { guestId: booking.guestId });
    const event = signedEvent("payment.succeeded", payment.providerReference!, booking.total);
    await handleWebhook(event.rawBody, event.signature);

    const over = (
      Math.round((parseFloat(booking.total) + 10) * 100) / 100
    ).toFixed(2);
    await assert.rejects(
      refundPayment({ paymentId: payment.id, amount: over }, { userId: staffId }),
      (error: unknown) => error instanceof PaymentError && error.code === "refund_exceeds_paid",
    );

    const stored = await prisma.payment.findUniqueOrThrow({ where: { id: payment.id } });
    assert.equal(stored.status, PaymentStatus.PAID, "a refused refund changes nothing");
  });

  it("cancelling a paid booking refunds it (REFUND_ON_CANCELLATION default on)", async () => {
    const booking = await createTestBooking("2027-10-15", "2027-10-17");
    const { payment } = await initiatePayment(booking.id, { guestId: booking.guestId });
    const event = signedEvent("payment.succeeded", payment.providerReference!, booking.total);
    await handleWebhook(event.rawBody, event.signature);

    // Staff cancels (bypasses any window).
    await transitionBooking(
      { bookingId: booking.id, to: BookingStatus.CANCELLED },
      { kind: "staff", userId: staffId, email: "p6-staff" + PAYMENT_TEST_SUFFIX },
    );

    const stored = await prisma.payment.findUniqueOrThrow({ where: { id: payment.id } });
    assert.equal(stored.status, PaymentStatus.REFUNDED, "cancellation refunds captured money");

    const row = await prisma.booking.findUniqueOrThrow({ where: { id: booking.id } });
    assert.equal(row.bookingStatus, BookingStatus.CANCELLED);
    assert.equal(row.paymentStatus, PaymentStatus.REFUNDED);
  });

  it("the configured provider is the one that signs and verifies", () => {
    const provider = getPaymentProvider();
    assert.equal(provider.id, "mock", "default provider while #4 is open");
    const event = provider.signWebhookEvent({
      type: "payment.succeeded",
      provider: provider.id,
      providerReference: "mock_x",
      amount: "10.00",
      currency: "MYR",
    });
    assert.equal(provider.verifyWebhookSignature(event.rawBody, event.signature), true);
    assert.equal(provider.verifyWebhookSignature(event.rawBody + "tampered", event.signature), false);
  });
});
