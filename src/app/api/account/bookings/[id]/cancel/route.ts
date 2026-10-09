import { NextResponse } from "next/server";
import { guardGuestApi } from "@/server/auth/api";
import { cancelBooking } from "@/server/booking/service";
import { CancellationRequestSchema } from "@/server/booking/validation";
import { bookingErrorResponse, invalidBody } from "@/server/booking/http";

/**
 * Guest cancellation (guest-only — `/api/account` in the access map).
 * The guest id comes from the session and is re-checked against the booking
 * inside the service; ownership failures answer 404, never 403.
 *
 *   POST /api/account/bookings/{id}/cancel
 */
export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const auth = await guardGuestApi("/api/account/bookings/[id]/cancel");
  if (auth instanceof NextResponse) return auth;
  const { id } = await context.params;

  const parsed = CancellationRequestSchema.safeParse(await request.json().catch(() => ({})) ?? {});
  if (!parsed.success) return invalidBody(parsed.error.flatten().fieldErrors);

  try {
    const booking = await cancelBooking(
      { bookingId: id, note: parsed.data.note ?? null },
      { kind: "guest", guestId: auth.guestId! },
    );
    return NextResponse.json({ booking });
  } catch (error) {
    return bookingErrorResponse(error);
  }
}
