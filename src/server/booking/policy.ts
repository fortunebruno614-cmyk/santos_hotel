import { BookingStatus, RoomStatus } from "@/generated/prisma/client";
import {
  CANCELLATION_WINDOW_HOURS,
  CHECK_IN_TIME,
  GUEST_CANCELLATION_ENABLED,
} from "@/config/booking";
import { zonedToUtc } from "@/server/pricing/context";

/**
 * P5 server-side guards — the only place a status change is allowed to happen.
 *
 * Two independent rules, both enforced in the service (never in the UI):
 *
 *  1. The transition table: which status may follow which. Terminal statuses
 *     (`CHECKED_OUT`, `CANCELLED`, `NO_SHOW`) have no outgoing edges, a status
 *     never transitions to itself, and `CHECKED_IN` may only be checked out —
 *     a stay that happened is not un-happened by another status change.
 *  2. Timing: a booking can only be checked in / marked no-show / checked out
 *     on or after its arrival date ("today" in the *hotel's* timezone).
 *
 * Cancellation is a transition to `CANCELLED` plus a policy evaluation
 * (docs/OPEN_QUESTIONS.md #9, window comes from config — never hardcoded):
 * guests are bound by `CANCELLATION_WINDOW_HOURS` before check-in; staff hold
 * `MANAGE_RESERVATIONS` and may cancel any cancellable booking regardless of
 * the window (operational necessity — walk-ins, overbooks, guest requests).
 */

export type TransitionErrorCode =
  | "invalid_transition"
  | "check_in_not_allowed"
  | "check_out_not_allowed"
  | "no_show_not_allowed"
  | "invalid_room_transition"
  | "room_not_ready";

export class TransitionError extends Error {
  readonly code: TransitionErrorCode;
  readonly from: string;
  readonly to: string;
  constructor(code: TransitionErrorCode, from: string, to: string, message?: string) {
    super(message ?? `${from} → ${to} is not allowed (${code})`);
    this.name = "TransitionError";
    this.code = code;
    this.from = from;
    this.to = to;
  }
}

const BOOKING_TRANSITIONS: Record<BookingStatus, BookingStatus[]> = {
  [BookingStatus.PENDING]: [BookingStatus.CONFIRMED, BookingStatus.CANCELLED, BookingStatus.NO_SHOW],
  [BookingStatus.CONFIRMED]: [BookingStatus.CHECKED_IN, BookingStatus.CANCELLED, BookingStatus.NO_SHOW],
  [BookingStatus.CHECKED_IN]: [BookingStatus.CHECKED_OUT],
  [BookingStatus.CHECKED_OUT]: [],
  [BookingStatus.CANCELLED]: [],
  [BookingStatus.NO_SHOW]: [],
};

/** Statuses a reservation can still leave (i.e. it is still "live"). */
export const CANCELLABLE_BOOKING_STATUSES: BookingStatus[] = [
  BookingStatus.PENDING,
  BookingStatus.CONFIRMED,
];

export function allowedTransitions(from: BookingStatus): BookingStatus[] {
  return [...(BOOKING_TRANSITIONS[from] ?? [])];
}

export function canTransition(from: BookingStatus, to: BookingStatus): boolean {
  if (from === to) return false;
  return (BOOKING_TRANSITIONS[from] ?? []).includes(to);
}

export function assertBookingTransition(from: BookingStatus, to: BookingStatus): void {
  if (!canTransition(from, to)) {
    throw new TransitionError("invalid_transition", from, to);
  }
}

/**
 * Timing guard: `today` is the hotel's current date (date-only, UTC midnight).
 * Check-in, check-out and no-show all require the arrival date to have arrived.
 */
export function assertTransitionTiming(
  from: BookingStatus,
  booking: { checkIn: Date },
  to: BookingStatus,
  today: Date,
): void {
  const arrival = booking.checkIn.getTime();
  const arrived = today.getTime() >= arrival;
  if (to === BookingStatus.CHECKED_IN && !arrived) {
    throw new TransitionError(
      "check_in_not_allowed",
      from,
      to,
      `check-in opens on the arrival date (${booking.checkIn.toISOString().slice(0, 10)})`,
    );
  }
  if (to === BookingStatus.CHECKED_OUT && !arrived) {
    throw new TransitionError("check_out_not_allowed", from, to, "a stay cannot end before it begins");
  }
  if (to === BookingStatus.NO_SHOW && !arrived) {
    throw new TransitionError(
      "no_show_not_allowed",
      from,
      to,
      "a guest cannot be marked no-show before the arrival date",
    );
  }
}

// ---------------------------------------------------------------------------
// Cancellation policy (docs/OPEN_QUESTIONS.md #9 — config, not hardcoded)
// ---------------------------------------------------------------------------

export type CancellationDenialReason =
  | "not_cancellable"
  | "guest_cancellation_disabled"
  | "too_late_to_cancel";

export type CancellationEvaluation =
  | { allowed: true; deadline: Date }
  | { allowed: false; reason: CancellationDenialReason; deadline: Date | null };

export type CancellationOptions = {
  /** Override `CANCELLATION_WINDOW_HOURS` (tests, per-hotel overrides). */
  windowHours?: number;
  /** Override `GUEST_CANCELLATION_ENABLED`. */
  guestCancellationEnabled?: boolean;
};

/** Moment until which a guest may cancel for free: check-in time − window. */
export function cancellationDeadline(
  checkIn: Date,
  timezone: string,
  windowHours: number = CANCELLATION_WINDOW_HOURS,
): Date {
  const checkInInstant = zonedToUtc(checkIn, CHECK_IN_TIME, timezone);
  return new Date(checkInInstant.getTime() - windowHours * 3_600_000);
}

/**
 * Pure policy evaluation. `actor: "guest"` applies the config window and the
 * guest-cancellation flag; `actor: "staff"` only requires a cancellable status.
 */
export function evaluateCancellation(
  booking: { bookingStatus: BookingStatus; checkIn: Date },
  actor: "guest" | "staff",
  now: Date,
  timezone: string,
  options: CancellationOptions = {},
): CancellationEvaluation {
  const windowHours = options.windowHours ?? CANCELLATION_WINDOW_HOURS;
  const guestEnabled = options.guestCancellationEnabled ?? GUEST_CANCELLATION_ENABLED;
  const deadline = cancellationDeadline(booking.checkIn, timezone, windowHours);

  if (actor === "guest" && !guestEnabled) {
    return { allowed: false, reason: "guest_cancellation_disabled", deadline };
  }
  if (!CANCELLABLE_BOOKING_STATUSES.includes(booking.bookingStatus)) {
    return { allowed: false, reason: "not_cancellable", deadline };
  }
  if (actor === "guest" && now.getTime() > deadline.getTime()) {
    return { allowed: false, reason: "too_late_to_cancel", deadline };
  }
  return { allowed: true, deadline };
}

// ---------------------------------------------------------------------------
// Room (housekeeping) status transitions
// ---------------------------------------------------------------------------

/**
 * `OCCUPIED → AVAILABLE` is deliberately absent: a room that was slept in must
 * pass through `CLEANING` first (docs/DEVELOPMENT_PLAN.md P5 — "room status
 * transitions (CheckedOut → Cleaning → Available)").
 */
const ROOM_TRANSITIONS: Record<RoomStatus, RoomStatus[]> = {
  [RoomStatus.AVAILABLE]: [
    RoomStatus.RESERVED,
    RoomStatus.OCCUPIED,
    RoomStatus.CLEANING,
    RoomStatus.MAINTENANCE,
    RoomStatus.OUT_OF_SERVICE,
  ],
  [RoomStatus.RESERVED]: [
    RoomStatus.OCCUPIED,
    RoomStatus.AVAILABLE,
    RoomStatus.CLEANING,
    RoomStatus.MAINTENANCE,
    RoomStatus.OUT_OF_SERVICE,
  ],
  [RoomStatus.OCCUPIED]: [
    RoomStatus.CLEANING,
    RoomStatus.RESERVED,
    RoomStatus.MAINTENANCE,
    RoomStatus.OUT_OF_SERVICE,
  ],
  [RoomStatus.CLEANING]: [RoomStatus.AVAILABLE, RoomStatus.MAINTENANCE, RoomStatus.OUT_OF_SERVICE],
  [RoomStatus.MAINTENANCE]: [RoomStatus.AVAILABLE, RoomStatus.CLEANING, RoomStatus.OUT_OF_SERVICE],
  [RoomStatus.OUT_OF_SERVICE]: [RoomStatus.AVAILABLE, RoomStatus.CLEANING, RoomStatus.MAINTENANCE],
};

export function allowedRoomTransitions(from: RoomStatus): RoomStatus[] {
  return [...(ROOM_TRANSITIONS[from] ?? [])];
}

export function canRoomTransition(from: RoomStatus, to: RoomStatus): boolean {
  if (from === to) return false;
  return (ROOM_TRANSITIONS[from] ?? []).includes(to);
}

export function assertRoomTransition(from: RoomStatus, to: RoomStatus): void {
  if (!canRoomTransition(from, to)) {
    throw new TransitionError(
      "invalid_room_transition",
      from,
      to,
      `room cannot go ${from} → ${to}${from === RoomStatus.OCCUPIED && to === RoomStatus.AVAILABLE ? " (check-out first, then mark it clean)" : ""}`,
    );
  }
}

/** Housekeeping states that block a check-in of an allocated room. */
export const UNUSABLE_ROOM_STATUSES: RoomStatus[] = [
  RoomStatus.MAINTENANCE,
  RoomStatus.OUT_OF_SERVICE,
];
