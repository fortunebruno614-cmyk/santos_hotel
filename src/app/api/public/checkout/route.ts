import { NextResponse } from "next/server";
import { getCurrentSession } from "@/server/auth/dal";
import { CheckoutSchema } from "@/server/booking/validation";
import { createBooking, type BookingActor } from "@/server/booking/service";
import { BOOKING_CLAIM_COOKIE, signBookingClaim } from "@/server/booking/claim";
import { bookingErrorResponse, invalidBody } from "@/server/booking/http";

/**
 * Public checkout (anonymous *or* signed-in guest — under `/api/public`).
 *
 *   POST /api/public/checkout
 *   { checkIn, checkOut, adults, children, roomIds[], guest{…},
 *     promotionCode?, notes?, expectedTotal? }
 *
 * Flow inside `createBooking`: resolve the guest (session id wins; never taken
 * from the body) → quote on the server → compare with `expectedTotal` →
 * `createPendingBooking` re-locks the rooms, re-checks availability and
 * re-prices in one transaction → `Booking` + `BookingRoom` + `room_nights` land
 * as PENDING with a fresh `SH-YYYY-NNNNNN` reference.
 *
 * On success a signed, httpOnly `booking_claim` cookie is set so a guest who
 * booked without an account can still reach the confirmation page and an
 * eligible cancellation.
 */
export async function POST(request: Request) {
  const session = await getCurrentSession();
  const actor: BookingActor =
    session?.kind === "guest" && session.guestId
      ? { kind: "guest", guestId: session.guestId }
      : { kind: "anonymous" };

  const parsed = CheckoutSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return invalidBody(parsed.error.flatten().fieldErrors);

  try {
    const booking = await createBooking(parsed.data, actor);
    const claim = await signBookingClaim({
      reference: booking.bookingReference,
      guestId: booking.guestId,
    });

    const response = NextResponse.json({ booking }, { status: 201 });
    response.cookies.set(BOOKING_CLAIM_COOKIE, claim, {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: 60 * 60 * 24,
    });
    return response;
  } catch (error) {
    return bookingErrorResponse(error);
  }
}
