import { NextResponse } from "next/server";
import { handleWebhook, PaymentError, SIGNATURE_HEADER } from "@/server/payments/service";
import { bookingErrorResponse } from "@/server/booking/http";

/**
 * Payment provider webhook (public — authenticated by signature, not session).
 *
 *   POST /api/public/payments/webhook
 *   headers: x-payment-signature: <HMAC-SHA256 hex of the raw body>
 *   body:    { type, provider, providerReference, amount, currency }
 *
 * The signature is verified against the **raw body** before any parsing
 * (src/server/payments/provider.ts). The handler then correlates by the unique
 * `providerReference`, locks the payment row and applies the event idempotently
 * — a replayed delivery is a no-op, never a double-charge or double-refund.
 *
 * A success confirms a PENDING booking; a failure leaves it PENDING/unpaid; a
 * success on a CANCELLED booking records the money but never resurrects the
 * reservation (staff refund it). Events for unknown references are accepted
 * (200) and audited as `payment.orphaned` so reconciliation is possible.
 */
export async function POST(request: Request) {
  const rawBody = await request.text();
  const signature = request.headers.get(SIGNATURE_HEADER);

  try {
    const outcome = await handleWebhook(rawBody, signature);
    return NextResponse.json(outcome, { status: 200 });
  } catch (error) {
    if (error instanceof PaymentError) {
      return bookingErrorResponse(error);
    }
    console.error("payment webhook failed", error);
    return NextResponse.json({ error: "internal" }, { status: 500 });
  }
}
