import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { prisma } from "@/lib/prisma";
import { getCurrentSession } from "@/server/auth/dal";
import { verifyBookingClaim, BOOKING_CLAIM_COOKIE } from "@/server/booking/claim";
import { MockCompleteSchema } from "@/server/booking/validation";
import { handleWebhook, initiatePayment, PaymentError } from "@/server/payments/service";
import { getPaymentProvider } from "@/server/payments/provider";
import { bookingErrorResponse, invalidBody } from "@/server/booking/http";

/**
 * Mock-gateway completion (public, claim/session gated).
 *
 *   POST /api/public/payments/mock/complete
 *   { bookingId, outcome: "succeeded" | "failed" }
 *
 * Stands in for the redirect back from a real hosted payment page: it ensures a
 * pending intent exists, then signs a genuine webhook event with the provider's
 * secret and feeds it through `handleWebhook` — the exact code path a real
 * gateway's POST to /api/public/payments/webhook takes, signature verification
 * included. When a real gateway replaces the mock (docs/OPEN_QUESTIONS.md #4),
 * this route disappears and only the hosted page changes.
 */
export async function POST(request: Request) {
  const parsed = MockCompleteSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return invalidBody(parsed.error.flatten().fieldErrors);
  const { bookingId, outcome } = parsed.data;

  const booking = await prisma.booking.findUnique({
    where: { id: bookingId },
    select: { id: true, bookingReference: true, guestId: true, paymentStatus: true },
  });
  if (!booking) return NextResponse.json({ error: "not_found" }, { status: 404 });

  const session = await getCurrentSession();
  const cookieStore = await cookies();
  const claim = await verifyBookingClaim(cookieStore.get(BOOKING_CLAIM_COOKIE)?.value);
  const ownsBySession = session?.kind === "guest" && session.guestId === booking.guestId;
  const ownsByClaim = claim !== null && claim.reference === booking.bookingReference;
  if (!ownsBySession && !ownsByClaim) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  try {
    // Ensure a pending intent (idempotent — a refreshed page reuses it).
    const initiated = await initiatePayment(bookingId, {
      guestId: session?.kind === "guest" ? session.guestId : claim?.guestId ?? null,
    });

    const provider = getPaymentProvider();
    const reference = initiated.payment.providerReference;
    if (!reference) {
      return NextResponse.json({ error: "internal" }, { status: 500 });
    }
    const { rawBody, signature } = provider.signWebhookEvent({
      type: outcome === "succeeded" ? "payment.succeeded" : "payment.failed",
      provider: provider.id,
      providerReference: reference,
      amount: initiated.payment.amount,
      currency: initiated.payment.currency,
    });

    const result = await handleWebhook(rawBody, signature);
    return NextResponse.json({ ...result, bookingId }, { status: 200 });
  } catch (error) {
    if (error instanceof PaymentError && error.code === "already_paid") {
      return NextResponse.json({ ok: true, outcome: "replay", bookingId }, { status: 200 });
    }
    return bookingErrorResponse(error);
  }
}
