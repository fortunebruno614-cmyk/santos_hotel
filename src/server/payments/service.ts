import { randomBytes } from "node:crypto";
import { prisma } from "@/lib/prisma";
import { PaymentStatus, BookingStatus, Prisma } from "@/generated/prisma/client";
import { REFUND_ON_CANCELLATION } from "@/config/payments";
import {
  getPaymentProvider,
  PaymentProviderNotConfiguredError,
  SIGNATURE_HEADER,
  WebhookEventSchema,
  type PaymentProvider,
} from "@/server/payments/provider";
import { loadHotelContext } from "@/server/pricing/context";
import {
  moneyEquals,
  moneyString,
  parseMoney,
  type Money,
} from "@/server/pricing/model";
import { assertBookingTransition } from "@/server/booking/policy";
import { writeAuditLog } from "@/server/audit/write";

/**
 * P6 payment service — every way money moves against a reservation.
 *
 * Rules this module owns (the gate in docs/DEVELOPMENT_PLAN.md):
 *
 *  - **A booking only counts as paid when the provider says so.** The service
 *    records `Payment` rows from signed webhooks (or an explicit desk capture);
 *    nothing else sets `paymentStatus=PAID`.
 *  - **Initiating twice must not double-charge.** `initiatePayment` is
 *    find-or-create under a booking lock: a refreshed pay page reuses the same
 *    pending intent (same `providerReference`).
 *  - **Webhook replays must not double-record.** `handleWebhook` locks the
 *    payment row and treats an already-applied event as a no-op.
 *  - **A failed payment never confirms a booking** — the booking stays
 *    PENDING/unpaid. A success on a CANCELLED booking records the money but
 *    never resurrects the reservation (staff refund it).
 *  - **Cancellations refund captured money** when `REFUND_ON_CANCELLATION`
 *    (docs/OPEN_QUESTIONS.md #6, default on) — partial refunds included.
 */

type Db = Prisma.TransactionClient | typeof prisma;

export type PaymentErrorCode =
  | "booking_not_found"
  | "payment_not_found"
  | "booking_not_payable"
  | "already_paid"
  | "not_refundable"
  | "refund_exceeds_paid"
  | "refund_refused"
  | "invalid_signature"
  | "invalid_webhook"
  | "invalid_provider"
  | "amount_mismatch";

export class PaymentError extends Error {
  readonly code: PaymentErrorCode;
  constructor(code: PaymentErrorCode, message: string) {
    super(message);
    this.name = "PaymentError";
    this.code = code;
  }
}

export { PaymentProviderNotConfiguredError, SIGNATURE_HEADER };

/** Statuses a guest/staff may start a payment for. */
const PAYABLE_BOOKING_STATUSES: BookingStatus[] = [BookingStatus.PENDING, BookingStatus.CONFIRMED];

/** Statuses whose remaining balance can still be refunded. */
const REFUNDABLE_STATUSES: PaymentStatus[] = [PaymentStatus.PAID, PaymentStatus.PARTIALLY_REFUNDED];

// ---------------------------------------------------------------------------
// Read model
// ---------------------------------------------------------------------------

export type PaymentSummary = {
  id: string;
  provider: string;
  providerReference: string | null;
  amount: string;
  currency: string;
  status: PaymentStatus;
  refundedAmount: string;
  paidAt: string | null;
  refundedAt: string | null;
  createdAt: string;
};

function toPaymentSummary(row: {
  id: string;
  provider: string;
  providerReference: string | null;
  amount: Prisma.Decimal;
  currency: string;
  status: PaymentStatus;
  refundedAmount: Prisma.Decimal;
  paidAt: Date | null;
  refundedAt: Date | null;
  createdAt: Date;
}): PaymentSummary {
  return {
    id: row.id,
    provider: row.provider,
    providerReference: row.providerReference,
    amount: moneyString(row.amount),
    currency: row.currency,
    status: row.status,
    refundedAmount: moneyString(row.refundedAmount),
    paidAt: row.paidAt ? row.paidAt.toISOString() : null,
    refundedAt: row.refundedAt ? row.refundedAt.toISOString() : null,
    createdAt: row.createdAt.toISOString(),
  };
}

/**
 * Booking.paymentStatus derived from its payments — one payment may be retried
 * or partially refunded, and the booking must always mirror reality:
 *   any captured & unrefunded  → PAID
 *   only partially refunded    → PARTIALLY_REFUNDED
 *   all captured fully refunded→ REFUNDED
 *   nothing captured, an attempt failed → FAILED
 *   otherwise                  → PENDING
 */
export function computeBookingPaymentStatus(
  payments: Array<{ status: PaymentStatus }>,
): PaymentStatus {
  if (payments.length === 0) return PaymentStatus.PENDING;
  const capturedStatuses: PaymentStatus[] = [
    PaymentStatus.PAID,
    PaymentStatus.PARTIALLY_REFUNDED,
    PaymentStatus.REFUNDED,
  ];
  const captured = payments.filter((p) => capturedStatuses.includes(p.status));
  if (captured.length === 0) {
    return payments.some((p) => p.status === PaymentStatus.FAILED)
      ? PaymentStatus.FAILED
      : PaymentStatus.PENDING;
  }
  if (captured.some((p) => p.status === PaymentStatus.PAID)) return PaymentStatus.PAID;
  if (captured.some((p) => p.status === PaymentStatus.PARTIALLY_REFUNDED)) {
    return PaymentStatus.PARTIALLY_REFUNDED;
  }
  return PaymentStatus.REFUNDED;
}

async function refreshBookingPaymentStatus(client: Db, bookingId: string): Promise<void> {
  const payments = await client.payment.findMany({
    where: { bookingId },
    select: { status: true },
  });
  await client.booking.update({
    where: { id: bookingId },
    data: { paymentStatus: computeBookingPaymentStatus(payments) },
  });
}

export async function getPaymentsForBooking(bookingId: string): Promise<PaymentSummary[]> {
  const rows = await prisma.payment.findMany({
    where: { bookingId },
    orderBy: { createdAt: "asc" },
  });
  return rows.map(toPaymentSummary);
}

// ---------------------------------------------------------------------------
// Initiate (guest pay page / staff preparing an online payment)
// ---------------------------------------------------------------------------

export type InitiatePaymentResult = {
  payment: PaymentSummary;
  /** Where the guest completes the payment (mock: the /pay page). */
  checkoutPath: string;
  /** False when an existing pending intent was reused (page refresh). */
  created: boolean;
};

/**
 * Find-or-create the pending payment for a booking, under a booking lock so
 * two refreshes cannot produce two live intents. The amount always follows the
 * booking's current total; stale pending intents (booking re-priced since) are
 * retired to FAILED so they can never be captured at an old price.
 */
export async function initiatePayment(
  bookingId: string,
  actor: { userId?: string | null; guestId?: string | null } = {},
): Promise<InitiatePaymentResult> {
  const hotel = await loadHotelContext();
  const provider = getPaymentProvider();

  const result = await prisma.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT "id" FROM "bookings" WHERE "id" = ${bookingId} FOR UPDATE`;
    const booking = await tx.booking.findUnique({
      where: { id: bookingId },
      select: { id: true, bookingReference: true, bookingStatus: true, total: true },
    });
    if (!booking) throw new PaymentError("booking_not_found", "reservation not found");
    if (!PAYABLE_BOOKING_STATUSES.includes(booking.bookingStatus)) {
      throw new PaymentError(
        "booking_not_payable",
        `a ${booking.bookingStatus} reservation cannot take payments`,
      );
    }

    const existing = await tx.payment.findMany({
      where: { bookingId },
      orderBy: { createdAt: "asc" },
    });
    if (existing.some((p) => p.status === PaymentStatus.PAID)) {
      throw new PaymentError("already_paid", "this reservation is already paid");
    }

    const pendingMatch = existing.find(
      (p) => p.status === PaymentStatus.PENDING && moneyEquals(p.amount, booking.total),
    );
    if (pendingMatch) {
      return { payment: pendingMatch, created: false, checkoutPath: checkoutPathFor(provider, booking.bookingReference) };
    }

    // Re-priced since the last attempt: retire stale intents so they can never
    // be captured at an old amount.
    for (const stale of existing.filter((p) => p.status === PaymentStatus.PENDING)) {
      await tx.payment.update({
        where: { id: stale.id },
        data: { status: PaymentStatus.FAILED },
      });
    }

    const intent = await provider.createIntent({
      amount: booking.total,
      currency: hotel.currency,
      bookingReference: booking.bookingReference,
    });
    const created = await tx.payment.create({
      data: {
        bookingId,
        provider: provider.id,
        providerReference: intent.providerReference,
        amount: booking.total,
        currency: hotel.currency,
        status: PaymentStatus.PENDING,
      },
    });
    return { payment: created, created: true, checkoutPath: intent.checkoutPath };
  }, { maxWait: 10_000, timeout: 15_000 });

  if (result.created) {
    await writeAuditLog({
      userId: actor.userId ?? null,
      action: "payment.initiate",
      entityType: "payment",
      entityId: result.payment.id,
      newValues: {
        bookingId,
        provider: result.payment.provider,
        amount: moneyString(result.payment.amount),
        currency: result.payment.currency,
      },
    });
  }

  return {
    payment: toPaymentSummary(result.payment),
    checkoutPath: result.checkoutPath,
    created: result.created,
  };
}

function checkoutPathFor(provider: PaymentProvider, bookingReference: string): string {
  return `/pay/${encodeURIComponent(bookingReference)}`;
}

// ---------------------------------------------------------------------------
// Webhook (the only path to PAID for online payments)
// ---------------------------------------------------------------------------

export type WebhookOutcome =
  | { ok: true; outcome: "applied"; paymentId: string; bookingId: string; bookingStatus: BookingStatus }
  | { ok: true; outcome: "replay"; paymentId: string }
  | { ok: true; outcome: "ignored"; paymentId: string; reason: string }
  | { ok: true; outcome: "orphaned"; providerReference: string };

/**
 * Verifies, correlates and applies one webhook event. The signature is checked
 * against the **raw body** before any parsing; correlation is by the unique
 * `providerReference`; the payment row is locked so a replay racing a live
 * event cannot double-apply.
 */
export async function handleWebhook(
  rawBody: string,
  signature: string | null | undefined,
): Promise<WebhookOutcome> {
  const provider = getPaymentProvider();

  if (!provider.verifyWebhookSignature(rawBody, signature)) {
    throw new PaymentError("invalid_signature", "webhook signature verification failed");
  }

  let parsedJson: unknown;
  try {
    parsedJson = JSON.parse(rawBody);
  } catch {
    throw new PaymentError("invalid_webhook", "webhook body is not valid JSON");
  }
  const parsed = WebhookEventSchema.safeParse(parsedJson);
  if (!parsed.success) {
    throw new PaymentError("invalid_webhook", "webhook payload failed validation");
  }
  const event = parsed.data;
  if (event.provider !== provider.id) {
    throw new PaymentError(
      "invalid_provider",
      `event is for provider "${event.provider}" but "${provider.id}" is configured`,
    );
  }

  const payment = await prisma.payment.findUnique({
    where: { providerReference: event.providerReference },
    select: { id: true, bookingId: true },
  });
  if (!payment) {
    // Reconciliation path: money may have moved with no local intent (e.g. a
    // booking whose creation failed after the gateway was paid). Accept the
    // event so the provider stops retrying, and leave an audit trail.
    await writeAuditLog({
      userId: null,
      action: "payment.orphaned",
      entityType: "payment",
      entityId: event.providerReference,
      newValues: { type: event.type, amount: event.amount, currency: event.currency },
    });
    return { ok: true, outcome: "orphaned", providerReference: event.providerReference };
  }

  const applied = await prisma.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT "id" FROM "payments" WHERE "id" = ${payment.id} FOR UPDATE`;
    const fresh = await tx.payment.findUniqueOrThrow({ where: { id: payment.id } });

    if (!moneyEquals(parseMoney(event.amount) ?? new Prisma.Decimal(-1), fresh.amount)) {
      throw new PaymentError(
        "amount_mismatch",
        `webhook amount ${event.amount} does not match payment ${moneyString(fresh.amount)}`,
      );
    }
    if (event.currency.toUpperCase() !== fresh.currency.toUpperCase()) {
      throw new PaymentError(
        "amount_mismatch",
        `webhook currency ${event.currency} does not match payment ${fresh.currency}`,
      );
    }

    const booking = await tx.booking.findUniqueOrThrow({
      where: { id: fresh.bookingId },
      select: { id: true, bookingStatus: true },
    });

    if (event.type === "payment.succeeded") {
      if (fresh.status !== PaymentStatus.PENDING) {
        // Already captured (replay) — never apply twice.
        return { kind: "replay" as const, paymentId: fresh.id };
      }

      await tx.payment.update({
        where: { id: fresh.id },
        data: { status: PaymentStatus.PAID, paidAt: new Date() },
      });

      // Confirm a PENDING booking; never resurrect a cancelled one.
      let bookingStatus = booking.bookingStatus;
      if (booking.bookingStatus === BookingStatus.PENDING) {
        assertBookingTransition(booking.bookingStatus, BookingStatus.CONFIRMED);
        bookingStatus = BookingStatus.CONFIRMED;
        await tx.booking.update({
          where: { id: booking.id },
          data: { bookingStatus },
        });
      }
      await refreshBookingPaymentStatus(tx, booking.id);
      return { kind: "applied" as const, paymentId: fresh.id, bookingId: booking.id, bookingStatus };
    }

    // payment.failed
    if (fresh.status !== PaymentStatus.PENDING) {
      // A late failure after capture (or a replay) never un-pays anything.
      return {
        kind: "ignored" as const,
        paymentId: fresh.id,
        reason: `payment already ${fresh.status}`,
      };
    }
    await tx.payment.update({
      where: { id: fresh.id },
      data: { status: PaymentStatus.FAILED },
    });
    await refreshBookingPaymentStatus(tx, booking.id);
    // The booking deliberately stays PENDING — a failed payment never confirms.
    return {
      kind: "applied" as const,
      paymentId: fresh.id,
      bookingId: booking.id,
      bookingStatus: booking.bookingStatus,
    };
  }, { maxWait: 10_000, timeout: 15_000 });

  if (applied.kind === "replay") {
    return { ok: true, outcome: "replay", paymentId: applied.paymentId };
  }
  if (applied.kind === "ignored") {
    return { ok: true, outcome: "ignored", paymentId: applied.paymentId, reason: applied.reason };
  }

  await writeAuditLog({
    userId: null,
    action: event.type === "payment.succeeded" ? "payment.succeeded" : "payment.failed",
    entityType: "payment",
    entityId: applied.paymentId,
    newValues: {
      bookingId: applied.bookingId,
      bookingStatus: applied.bookingStatus,
      amount: event.amount,
      currency: event.currency,
    },
  });

  return {
    ok: true,
    outcome: "applied",
    paymentId: applied.paymentId,
    bookingId: applied.bookingId,
    bookingStatus: applied.bookingStatus,
  };
}

// ---------------------------------------------------------------------------
// Refunds
// ---------------------------------------------------------------------------

async function applyRefund(
  tx: Prisma.TransactionClient,
  paymentId: string,
  refundAmount: Money,
): Promise<{ paymentId: string; bookingId: string; status: PaymentStatus }> {
  const fresh = await tx.payment.findUniqueOrThrow({ where: { id: paymentId } });
  if (!REFUNDABLE_STATUSES.includes(fresh.status)) {
    throw new PaymentError(
      "not_refundable",
      `a ${fresh.status} payment cannot be refunded`,
    );
  }
  const remaining = fresh.amount.minus(fresh.refundedAmount);
  if (refundAmount.lte(0) || refundAmount.gt(remaining)) {
    throw new PaymentError(
      "refund_exceeds_paid",
      `refund ${moneyString(refundAmount)} exceeds the remaining ${moneyString(remaining)}`,
    );
  }

  const newRefunded = fresh.refundedAmount.plus(refundAmount);
  const fullyRefunded = newRefunded.equals(fresh.amount);
  const updated = await tx.payment.update({
    where: { id: fresh.id },
    data: {
      refundedAmount: newRefunded,
      refundedAt: new Date(),
      status: fullyRefunded ? PaymentStatus.REFUNDED : PaymentStatus.PARTIALLY_REFUNDED,
    },
  });
  await refreshBookingPaymentStatus(tx, fresh.bookingId);
  return { paymentId: updated.id, bookingId: fresh.bookingId, status: updated.status };
}

/**
 * Staff refund (full or partial). The provider is called first; the row is
 * only updated when the provider confirms, and the booking's paymentStatus is
 * re-derived from all of its payments in the same transaction.
 */
export async function refundPayment(
  input: { paymentId: string; amount?: string | null },
  actor: { userId: string | null },
): Promise<PaymentSummary> {
  const provider = getPaymentProvider();
  const payment = await prisma.payment.findUnique({ where: { id: input.paymentId } });
  if (!payment) throw new PaymentError("payment_not_found", "payment not found");
  if (!REFUNDABLE_STATUSES.includes(payment.status)) {
    throw new PaymentError("not_refundable", `a ${payment.status} payment cannot be refunded`);
  }

  const remaining = payment.amount.minus(payment.refundedAmount);
  const refundAmount = input.amount == null || input.amount === "" ? remaining : parseMoney(input.amount);
  if (!refundAmount || refundAmount.lte(0) || refundAmount.gt(remaining)) {
    throw new PaymentError(
      "refund_exceeds_paid",
      `refund must be between 0.01 and ${moneyString(remaining)}`,
    );
  }

  const accepted = await provider.refund({
    providerReference: payment.providerReference ?? "",
    amount: refundAmount,
  });
  if (!accepted) {
    throw new PaymentError("refund_refused", "the payment provider refused the refund");
  }

  const result = await prisma.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT "id" FROM "payments" WHERE "id" = ${payment.id} FOR UPDATE`;
    return applyRefund(tx, payment.id, refundAmount);
  }, { maxWait: 10_000, timeout: 15_000 });

  await writeAuditLog({
    userId: actor.userId,
    action: "payment.refund",
    entityType: "payment",
    entityId: result.paymentId,
    oldValues: { status: payment.status, refundedAmount: moneyString(payment.refundedAmount) },
    newValues: {
      status: result.status,
      refundedAmount: moneyString(payment.refundedAmount.plus(refundAmount)),
      amount: moneyString(refundAmount),
      bookingId: result.bookingId,
    },
  });

  const fresh = await prisma.payment.findUnique({ where: { id: result.paymentId } });
  if (!fresh) throw new PaymentError("payment_not_found", "payment vanished during refund");
  return toPaymentSummary(fresh);
}

/**
 * Refunds every captured payment on a booking (remaining balance each).
 * Called after a cancellation commits; a provider failure never blocks the
 * cancellation — it is audited and staff retry from the reservation page.
 */
export async function refundCapturedPayments(
  bookingId: string,
  actor: { userId: string | null },
): Promise<{ refunded: number }> {
  const captured = await prisma.payment.findMany({
    where: { bookingId, status: { in: REFUNDABLE_STATUSES } },
  });
  let refunded = 0;
  for (const payment of captured) {
    try {
      await refundPayment({ paymentId: payment.id }, actor);
      refunded += 1;
    } catch (error) {
      if (error instanceof PaymentError && error.code === "not_refundable") continue;
      await writeAuditLog({
        userId: actor.userId,
        action: "payment.refund_failed",
        entityType: "payment",
        entityId: payment.id,
        newValues: {
          bookingId,
          reason: error instanceof Error ? error.message : "unknown refund failure",
        },
      });
    }
  }
  return { refunded };
}

/**
 * P6 hook for the booking service: after a cancellation commits, refund
 * captured money when the config allows it (docs/OPEN_QUESTIONS.md #6).
 */
export async function settleCancellationPayments(
  bookingId: string,
  actor: { userId: string | null },
): Promise<void> {
  if (!REFUND_ON_CANCELLATION) return;
  try {
    await refundCapturedPayments(bookingId, actor);
  } catch (error) {
    console.error("refund on cancellation failed", error);
  }
}

// ---------------------------------------------------------------------------
// Desk capture (walk-in cash/card — no gateway round-trip)
// ---------------------------------------------------------------------------

/**
 * Records money taken at the desk: a PAID payment with a locally minted
 * `desk_…` reference, and the booking confirmed if it was still PENDING.
 * Idempotent under the booking lock — a double-click cannot capture twice.
 */
export async function recordDeskPayment(
  bookingId: string,
  actor: { userId: string | null },
): Promise<PaymentSummary> {
  const hotel = await loadHotelContext();

  const result = await prisma.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT "id" FROM "bookings" WHERE "id" = ${bookingId} FOR UPDATE`;
    const booking = await tx.booking.findUnique({
      where: { id: bookingId },
      select: { id: true, bookingStatus: true, total: true },
    });
    if (!booking) throw new PaymentError("booking_not_found", "reservation not found");
    if (!PAYABLE_BOOKING_STATUSES.includes(booking.bookingStatus)) {
      throw new PaymentError(
        "booking_not_payable",
        `a ${booking.bookingStatus} reservation cannot take payments`,
      );
    }
    const existing = await tx.payment.findMany({ where: { bookingId }, select: { status: true } });
    if (computeBookingPaymentStatus(existing) === PaymentStatus.PAID) {
      throw new PaymentError("already_paid", "this reservation is already paid");
    }

    const created = await tx.payment.create({
      data: {
        bookingId,
        provider: "desk",
        providerReference: `desk_${randomBytes(10).toString("hex")}`,
        amount: booking.total,
        currency: hotel.currency,
        status: PaymentStatus.PAID,
        paidAt: new Date(),
      },
    });

    if (booking.bookingStatus === BookingStatus.PENDING) {
      assertBookingTransition(booking.bookingStatus, BookingStatus.CONFIRMED);
      await tx.booking.update({
        where: { id: booking.id },
        data: { bookingStatus: BookingStatus.CONFIRMED },
      });
    }
    await refreshBookingPaymentStatus(tx, booking.id);
    return created;
  }, { maxWait: 10_000, timeout: 15_000 });

  await writeAuditLog({
    userId: actor.userId,
    action: "payment.desk_capture",
    entityType: "payment",
    entityId: result.id,
    newValues: {
      bookingId,
      amount: moneyString(result.amount),
      currency: result.currency,
    },
  });

  return toPaymentSummary(result);
}
