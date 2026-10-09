import { NextResponse } from "next/server";
import { AvailabilityConflictError, StayValidationError } from "@/server/availability/service";
import { QuoteError } from "@/server/pricing/service";
import { PriceChangedError } from "@/server/pricing/model";
import { TransitionError } from "@/server/booking/policy";
import { BookingError, type BookingErrorCode } from "@/server/booking/service";

/**
 * One error vocabulary for every booking endpoint, so the client always gets a
 * machine-readable `error` key plus the right status code — and an unexpected
 * failure never leaks internals.
 *
 *   400 invalid_body / invalid_date_range / promotion_* / check_in_past
 *   401 unauthenticated          403 account_required / guest_inactive / …
 *   404 not_found                409 price_changed / unavailable / invalid_transition / …
 *   500 internal
 */

const BOOKING_ERROR_STATUS: Record<BookingErrorCode, number> = {
  account_required: 403,
  guest_inactive: 403,
  guest_cancellation_disabled: 403,
  price_changed: 409,
  check_in_past: 400,
  booking_not_found: 404,
  room_not_found: 404,
  not_modifiable: 409,
  not_cancellable: 409,
  too_late_to_cancel: 409,
};

export function invalidBody(issues?: Record<string, string[] | undefined>) {
  return NextResponse.json({ error: "invalid_body", issues }, { status: 400 });
}

export function bookingErrorResponse(error: unknown): NextResponse {
  if (error instanceof StayValidationError) {
    return NextResponse.json({ error: error.code, message: error.message }, { status: 400 });
  }
  if (error instanceof QuoteError) {
    return NextResponse.json({ error: error.code, message: error.message }, { status: 400 });
  }
  if (error instanceof BookingError) {
    const status = BOOKING_ERROR_STATUS[error.code] ?? 400;
    if (error.code === "booking_not_found" || error.code === "room_not_found") {
      return NextResponse.json({ error: "not_found" }, { status });
    }
    return NextResponse.json({ error: error.code, message: error.message }, { status });
  }
  if (error instanceof PriceChangedError) {
    return NextResponse.json({ error: "price_changed", message: error.message }, { status: 409 });
  }
  if (error instanceof TransitionError) {
    return NextResponse.json(
      { error: error.code, message: error.message, from: error.from, to: error.to },
      { status: 409 },
    );
  }
  if (error instanceof AvailabilityConflictError) {
    return NextResponse.json(
      { error: "unavailable", reason: error.reason, roomIds: error.roomIds, message: error.message },
      { status: 409 },
    );
  }
  console.error("booking request failed", error);
  return NextResponse.json({ error: "internal" }, { status: 500 });
}
