import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentSession } from "@/server/auth/dal";
import { verifyBookingClaim, BOOKING_CLAIM_COOKIE } from "@/server/booking/claim";
import { cookies } from "next/headers";
import { InitiatePaymentSchema } from "@/server/booking/validation";
import { initiatePayment } from "@/server/payments/service";
import { bookingErrorResponse, invalidBody } from "@/server/booking/http";

/**
 * Public payment initiation (guest *or* claim holder — under `/api/public`).
 *
 *   POST /api/public/payments/initiate
 *   { bookingId }
 *
 * Returns the pending `Payment` plus the `checkoutPath` the guest should be
 * sent to. Idempotent: refreshing the pay page reuses the same intent (same
 * `providerReference`) — it never creates a second live payment.
 *
 * Authorization: a signed-in guest who owns the reservation, or the signed
 * `booking_claim` cookie minted at checkout for that exact reference. Anything
 * else is 404 (never 403 — a stranger must not learn a booking exists).
 */
export async function POST(request: Request) {
  const parsed = InitiatePaymentSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return invalidBody(parsed.error.flatten().fieldErrors);
  const { bookingId } = parsed.data;

  const booking = await prisma.booking.findUnique({
    where: { id: bookingId },
    select: { id: true, bookingReference: true, guestId: true },
  });
  if (!booking) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  const session = await getCurrentSession();
  const cookieStore = await cookies();
  const claim = await verifyBookingClaim(cookieStore.get(BOOKING_CLAIM_COOKIE)?.value);

  const ownsBySession = session?.kind === "guest" && session.guestId === booking.guestId;
  const ownsByClaim = claim !== null && claim.reference === booking.bookingReference;
  if (!ownsBySession && !ownsByClaim) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  try {
    const result = await initiatePayment(bookingId, {
      guestId: session?.kind === "guest" ? session.guestId : claim?.guestId ?? null,
    });
    return NextResponse.json(result, { status: result.created ? 201 : 200 });
  } catch (error) {
    return bookingErrorResponse(error);
  }
}
