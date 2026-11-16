import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { handlePaymentCallback, PaymentError } from "@/server/payments/service";

/**
 * Paystack post-checkout callback.
 *
 *   GET /api/public/payments/callback?reference=...&trxref=...
 *
 * Paystack redirects the guest here after the hosted page. The reference is
 * verified **server-side** with Paystack before anything is recorded; the
 * webhook remains the primary source of truth, so this is safe to hit twice.
 * The guest then lands on the normal confirmation page, which reflects the
 * payment status (and offers a retry link when the charge did not settle).
 */
function redirectTo(request: Request, path: string) {
  return NextResponse.redirect(new URL(path, request.url));
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const reference = url.searchParams.get("reference") ?? url.searchParams.get("trxref");
  if (!reference) return redirectTo(request, "/");

  const payment = await prisma.payment.findUnique({
    where: { providerReference: reference },
    select: {
      booking: { select: { bookingReference: true } },
    },
  });
  if (!payment) return redirectTo(request, "/");

  try {
    // Verify with Paystack and apply the same state machine as a webhook.
    await handlePaymentCallback(reference);
  } catch (error) {
    if (error instanceof PaymentError) {
      console.error("payment callback failed", { code: error.code, message: error.message });
    } else {
      console.error("payment callback failed", error);
    }
  }

  return redirectTo(
    request,
    `/booking/confirmation?ref=${encodeURIComponent(payment.booking.bookingReference)}`,
  );
}
