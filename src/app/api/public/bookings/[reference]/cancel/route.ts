import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { BOOKING_CLAIM_COOKIE, verifyBookingClaim } from "@/server/booking/claim";
import { cancelBookingByClaim } from "@/server/booking/service";
import { CancellationRequestSchema } from "@/server/booking/validation";
import { bookingErrorResponse, invalidBody } from "@/server/booking/http";
import { apiUnauthenticated } from "@/server/auth/api";

/**
 * Cancel a reservation with the checkout claim cookie (public — under
 * `/api/public`). This is the path for guests who booked *without* an account:
 * they have no session, but the signed claim proves they hold that exact
 * reservation. The config cancellation window is still applied inside the
 * service (docs/OPEN_QUESTIONS.md #9).
 *
 *   POST /api/public/bookings/{bookingReference}/cancel
 */
export async function POST(
  request: Request,
  context: { params: Promise<{ reference: string }> },
) {
  const { reference } = await context.params;

  const cookieStore = await cookies();
  const claim = await verifyBookingClaim(cookieStore.get(BOOKING_CLAIM_COOKIE)?.value);
  if (!claim) return apiUnauthenticated("claim_required");
  if (claim.reference !== reference) return apiUnauthenticated("claim_required");

  const body = await request.json().catch(() => ({}));
  const parsed = CancellationRequestSchema.safeParse(body ?? {});
  if (!parsed.success) return invalidBody(parsed.error.flatten().fieldErrors);

  try {
    const booking = await cancelBookingByClaim({
      reference,
      guestId: claim.guestId,
      note: parsed.data.note ?? null,
    });
    return NextResponse.json({ booking });
  } catch (error) {
    return bookingErrorResponse(error);
  }
}
