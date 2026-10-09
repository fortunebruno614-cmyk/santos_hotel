import "../../scripts/load-env";
import { describe, it } from "node:test";
import assert from "node:assert/strict";

/**
 * Env-flag behaviour of cancellation refunds (docs/OPEN_QUESTIONS.md #6).
 * Each test file runs in its own process, so the flag is set before the first
 * import of `src/config/payments` — which reads `process.env` at module load.
 */

process.env.REFUND_ON_CANCELLATION = "false";

describe("P6 cancellation with REFUND_ON_CANCELLATION=false", () => {
  it("cancels a paid booking but leaves the payment captured for manual refund", async () => {
    const { BookingStatus, PaymentStatus } = await import("../../src/generated/prisma/enums");
    const { REFUND_ON_CANCELLATION } = await import("../../src/config/payments");
    const { createBooking, transitionBooking } = await import("../../src/server/booking/service");
    const { computeQuote } = await import("../../src/server/pricing/service");
    const { moneyString } = await import("../../src/server/pricing/model");
    const { mockProvider } = await import("../../src/server/payments/provider");
    const { handleWebhook, initiatePayment, getPaymentsForBooking } = await import(
      "../../src/server/payments/service"
    );
    const {
      PAYMENT_TEST_SUFFIX,
      dateOnly,
      deleteTestPaymentGuests,
      deleteTestPaymentStaffUser,
      ensureTestPaymentStaffUser,
      loadInventory,
      prisma,
    } = await import("../helpers");

    assert.equal(REFUND_ON_CANCELLATION, false, "flag must be off before config loads");

    const inventory = await loadInventory();
    const staffId = await ensureTestPaymentStaffUser();
    await deleteTestPaymentGuests();

    const email = `no-refund${PAYMENT_TEST_SUFFIX}`;
    const guest = await prisma.guest.create({
      data: { firstName: "P6", lastName: "NoRefund", email },
    });
    const room = inventory.bySlug.get("deluxe-king")!.rooms[0];
    const quote = await computeQuote({
      checkIn: dateOnly("2027-11-01"),
      checkOut: dateOnly("2027-11-03"),
      adults: 2,
      children: 0,
      roomIds: [room.id],
    });
    const total = moneyString(quote.snapshot.breakdown.total);
    const booking = await createBooking(
      {
        checkIn: "2027-11-01",
        checkOut: "2027-11-03",
        adults: 2,
        children: 0,
        roomIds: [room.id],
        guest: { firstName: "P6", lastName: "NoRefund", email },
        expectedTotal: total,
      },
      { kind: "guest", guestId: guest.id },
    );

    const { payment } = await initiatePayment(booking.id, { guestId: guest.id });
    const event = mockProvider.signWebhookEvent({
      type: "payment.succeeded",
      provider: "mock",
      providerReference: payment.providerReference!,
      amount: total,
      currency: payment.currency,
    });
    await handleWebhook(event.rawBody, event.signature);

    await transitionBooking(
      { bookingId: booking.id, to: BookingStatus.CANCELLED },
      { kind: "staff", userId: staffId, email: "p6-staff" + PAYMENT_TEST_SUFFIX },
    );

    const payments = await getPaymentsForBooking(booking.id);
    assert.equal(payments.length, 1);
    assert.equal(payments[0].status, PaymentStatus.PAID, "captured money is not auto-refunded");

    const row = await prisma.booking.findUniqueOrThrow({ where: { id: booking.id } });
    assert.equal(row.bookingStatus, BookingStatus.CANCELLED);
    assert.equal(row.paymentStatus, PaymentStatus.PAID, "staff can still refund manually");

    await deleteTestPaymentGuests();
    await deleteTestPaymentStaffUser();
  });
});
