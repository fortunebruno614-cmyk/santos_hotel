import { NextResponse } from "next/server";
import { AvailabilityConflictError, StayValidationError } from "@/server/availability/service";
import { QuoteError } from "@/server/pricing/service";
import { PriceChangedError } from "@/server/pricing/model";
import { TransitionError } from "@/server/booking/policy";
import { BookingError, type BookingErrorCode } from "@/server/booking/service";
import { PaymentError, type PaymentErrorCode } from "@/server/payments/service";

/**
 * One error vocabulary for every booking endpoint, so the client always gets a
 * machine-readable `error` key plus the right status code — and an unexpected
 * failure never leaks internals.
 *
 *   400 invalid_body / invalid_date_range / promotion_* / check_in_past /
 *       invalid_webhook / amount_mismatch / refund_exceeds_paid
 *   401 unauthenticated / invalid_signature
 *   403 account_required / guest_inactive / …
 *   404 not_found                409 price_changed / unavailable / invalid_transition /
 *       already_paid / booking_not_payable / not_refundable / refund_refused
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

const PAYMENT_ERROR_STATUS: Record<PaymentErrorCode, number> = {
  booking_not_found: 404,
  payment_not_found: 404,
  booking_not_payable: 409,
  already_paid: 409,
  not_refundable: 409,
  refund_exceeds_paid: 400,
  refund_refused: 409,
  invalid_signature: 401,
  invalid_webhook: 400,
  invalid_provider: 400,
  amount_mismatch: 400,
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
  if (error instanceof PaymentError) {
    const status = PAYMENT_ERROR_STATUS[error.code] ?? 400;
    if (error.code === "booking_not_found" || error.code === "payment_not_found") {
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
