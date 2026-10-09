import { prisma } from "@/lib/prisma";
import {
  BookingStatus,
  PaymentStatus,
  Prisma,
  RoomStatus,
} from "@/generated/prisma/client";
import { GUEST_BOOKING_REQUIRES_ACCOUNT } from "@/config/auth";
import { ALLOW_SAME_DAY_TURNOVER } from "@/config/availability";
import { BOOKING_REFERENCE_ATTEMPTS } from "@/config/booking";
import {
  AvailabilityConflictError,
  assertRoomsAvailable,
  createPendingBooking,
  isRoomNightsViolation,
  normalizeRequest,
  releaseExpiredHolds,
  StayValidationError,
} from "@/server/availability/service";
import { expandNights, nightsCount, parseDateOnly } from "@/server/availability/overlap";
import {
  computeQuote,
  QuoteError,
  type QuoteRequest,
} from "@/server/pricing/service";
import { hotelToday, loadHotelContext, type HotelContext } from "@/server/pricing/context";
import {
  moneyEquals,
  moneyString,
  parseMoney,
  PriceChangedError,
} from "@/server/pricing/model";
import { isBookingReferenceConflict, nextBookingReference } from "@/server/booking/reference";
import {
  allowedRoomTransitions,
  allowedTransitions,
  assertBookingTransition,
  assertRoomTransition,
  assertTransitionTiming,
  cancellationDeadline,
  evaluateCancellation,
  TransitionError,
  UNUSABLE_ROOM_STATUSES,
  type CancellationDenialReason,
} from "@/server/booking/policy";
import type { GuestDetails } from "@/server/booking/validation";
import { normalizeEmail } from "@/server/auth/validation";
import { writeAuditLog } from "@/server/audit/write";

/**
 * P5 booking service — every way a reservation can come into being or change.
 *
 * Rules this module owns (the gate in docs/DEVELOPMENT_PLAN.md):
 *
 *  - **No booking bypasses the availability re-check.** Both guest checkout and
 *    staff walk-ins funnel through `createPendingBooking`, which locks the rooms,
 *    re-runs `assertRoomsAvailable` and inserts the `room_nights` rows that the
 *    database itself rejects as duplicates.
 *  - **The stored price is the quoted price.** `createBooking` quotes, compares
 *    against what the client was shown (`expectedTotal`), then re-prices inside
 *    the transaction (`priceCheck`) and aborts on any drift.
 *  - **Status changes are guarded server-side** by `policy.ts`: the transition
 *    table, the arrival-date timing rules and the config-driven cancellation
 *    window. The UI only ever offers what the service will accept.
 */

type Db = Prisma.TransactionClient | typeof prisma;

export type BookingErrorCode =
  | "account_required"
  | "price_changed"
  | "check_in_past"
  | "guest_inactive"
  | "booking_not_found"
  | "room_not_found"
  | "not_modifiable"
  | "not_cancellable"
  | "guest_cancellation_disabled"
  | "too_late_to_cancel";

export class BookingError extends Error {
  readonly code: BookingErrorCode;
  constructor(code: BookingErrorCode, message: string) {
    super(message);
    this.name = "BookingError";
    this.code = code;
  }
}

export type StaffActor = { kind: "staff"; userId: string; email?: string | null };
export type GuestActor = { kind: "guest"; guestId: string };
export type BookingActor = StaffActor | GuestActor | { kind: "anonymous" };

export type BookingViewer = { kind: "staff" } | { kind: "guest"; guestId: string };

function actorLabel(actor: BookingActor): string {
  if (actor.kind === "staff") return actor.email ?? actor.userId;
  if (actor.kind === "guest") return "guest";
  return "online";
}

/** Appends a timestamped, attributed line (operational notes are never lost). */
function appendNote(existing: string | null, note: string, label: string): string {
  const stamp = new Date().toISOString().replace(/\.\d{3}Z$/, "Z");
  const line = `[${stamp} ${label}] ${note.trim()}`;
  return existing ? `${existing}\n${line}` : line;
}

// ---------------------------------------------------------------------------
// Guest resolution (open question #13: booking without an account)
// ---------------------------------------------------------------------------

/**
 * Finds or creates the guest a reservation belongs to.
 *
 *  - A signed-in guest always books as themselves — the id comes from the
 *    session, never from the payload.
 *  - Otherwise the email is matched to an existing guest row. Attaching a
 *    booking to that row does **not** grant access to the account (the password
 *    still gates it); it only means the reservation shows up in their history
 *    when they next sign in.
 *  - No email (staff walk-in) creates a fresh passwordless guest record.
 */
async function resolveGuestId(client: Db, details: GuestDetails, actor: BookingActor): Promise<string> {
  if (actor.kind === "guest") {
    const guest = await client.guest.findUnique({
      where: { id: actor.guestId },
      select: { id: true, isActive: true },
    });
    if (!guest) throw new BookingError("guest_inactive", "this guest account no longer exists");
    if (!guest.isActive) throw new BookingError("guest_inactive", "this guest account is deactivated");
    return guest.id;
  }

  const email = details.email ? normalizeEmail(details.email) : null;
  if (email) {
    const existing = await client.guest.findUnique({
      where: { email },
      select: { id: true, isActive: true },
    });
    if (existing) {
      if (!existing.isActive) {
        throw new BookingError("guest_inactive", "this guest account is deactivated");
      }
      return existing.id;
    }
  }

  const created = await client.guest.create({
    data: {
      firstName: details.firstName,
      lastName: details.lastName,
      email,
      phone: details.phone ?? null,
      idType: details.idType ?? null,
      idNumber: details.idNumber ?? null,
    },
    select: { id: true },
  });
  return created.id;
}

// ---------------------------------------------------------------------------
// Read models
// ---------------------------------------------------------------------------

type BookingRow = Prisma.BookingGetPayload<{
  include: {
    rooms: { include: { room: { include: { roomType: true } } } };
    guest: true;
  };
}>;

const bookingInclude = {
  rooms: { include: { room: { include: { roomType: true } } } },
  guest: true,
} as const;

async function loadBookingRow(client: Db, id: string): Promise<BookingRow | null> {
  return client.booking.findUnique({ where: { id }, include: bookingInclude });
}

export type BookingSummary = {
  id: string;
  bookingReference: string;
  guestId: string;
  guestName: string;
  checkIn: string;
  checkOut: string;
  nights: number;
  adults: number;
  children: number;
  bookingStatus: BookingStatus;
  paymentStatus: PaymentStatus;
  currency: string;
  breakdown: { subtotal: string; taxes: string; fees: string; discount: string; total: string };
  promotionCode: string | null;
  notes: string | null;
  createdByUserId: string | null;
  createdAt: string;
  rooms: Array<{
    roomId: string;
    roomNumber: string;
    roomTypeName: string;
    nightlyRate: string;
    nights: number;
    roomTotal: string;
  }>;
};

function toSummary(row: BookingRow, currency: string): BookingSummary {
  return {
    id: row.id,
    bookingReference: row.bookingReference,
    guestId: row.guestId,
    guestName: `${row.guest.firstName} ${row.guest.lastName}`,
    checkIn: row.checkIn.toISOString().slice(0, 10),
    checkOut: row.checkOut.toISOString().slice(0, 10),
    nights: nightsCount(row.checkIn, row.checkOut),
    adults: row.adults,
    children: row.children,
    bookingStatus: row.bookingStatus,
    paymentStatus: row.paymentStatus,
    currency,
    breakdown: {
      subtotal: moneyString(row.subtotal),
      taxes: moneyString(row.taxes),
      fees: moneyString(row.fees),
      discount: moneyString(row.discount),
      total: moneyString(row.total),
    },
    promotionCode: row.promotionCode,
    notes: row.notes,
    createdByUserId: row.createdByUserId,
    createdAt: row.createdAt.toISOString(),
    rooms: row.rooms.map((line) => ({
      roomId: line.roomId,
      roomNumber: line.room.roomNumber,
      roomTypeName: line.room.roomType.name,
      nightlyRate: moneyString(line.nightlyRate),
      nights: line.nights,
      roomTotal: moneyString(line.roomTotal),
    })),
  };
}

export type CancellationInfo = {
  deadline: string | null;
  guestAllowed: boolean;
  staffAllowed: boolean;
  reason: CancellationDenialReason | null;
};

/** Cancellation eligibility for one booking, given an already-loaded hotel. */
export function cancellationInfoFor(
  booking: { bookingStatus: BookingStatus; checkIn: Date },
  hotel: HotelContext,
  now: Date = new Date(),
  options: { windowHours?: number; guestCancellationEnabled?: boolean } = {},
): CancellationInfo {
  const guest = evaluateCancellation(booking, "guest", now, hotel.timezone, options);
  const staff = evaluateCancellation(booking, "staff", now, hotel.timezone, options);
  const denied = guest.allowed ? null : guest.reason;
  const deadline = guest.deadline ?? staff.deadline;
  return {
    deadline: deadline ? deadline.toISOString() : null,
    guestAllowed: guest.allowed,
    staffAllowed: staff.allowed,
    reason: denied,
  };
}

export type BookingDetail = BookingSummary & {
  guest: {
    id: string;
    firstName: string;
    lastName: string;
    email: string | null;
    phone: string | null;
    idType: string | null;
    idNumber: string | null;
  };
  allowedTransitions: BookingStatus[];
  cancellation: CancellationInfo;
  activity: Array<{ id: string; action: string; createdAt: string; userId: string | null }>;
  createdByName: string | null;
};

/** Full reservation view. A guest only ever sees their own booking (else 404). */
export async function getBookingDetail(
  bookingId: string,
  viewer: BookingViewer,
): Promise<BookingDetail> {
  const row = await loadBookingRow(prisma, bookingId);
  if (!row) throw new BookingError("booking_not_found", "reservation not found");
  if (viewer.kind === "guest" && row.guestId !== viewer.guestId) {
    throw new BookingError("booking_not_found", "reservation not found");
  }

  const hotel = await loadHotelContext();
  const activity = await prisma.auditLog.findMany({
    where: { entityType: "booking", entityId: row.id },
    orderBy: { createdAt: "desc" },
    take: 30,
    select: { id: true, action: true, createdAt: true, userId: true },
  });
  const creator = row.createdByUserId
    ? await prisma.user.findUnique({
        where: { id: row.createdByUserId },
        select: { name: true, email: true },
      })
    : null;

  return {
    ...toSummary(row, hotel.currency),
    guest: {
      id: row.guest.id,
      firstName: row.guest.firstName,
      lastName: row.guest.lastName,
      email: row.guest.email,
      phone: row.guest.phone,
      idType: row.guest.idType,
      idNumber: row.guest.idNumber,
    },
    allowedTransitions: allowedTransitions(row.bookingStatus),
    cancellation: cancellationInfoFor(row, hotel),
    activity: activity.map((entry) => ({
      id: entry.id,
      action: entry.action,
      createdAt: entry.createdAt.toISOString(),
      userId: entry.userId,
    })),
    createdByName: creator ? `${creator.name} (${creator.email})` : null,
  };
}

/** Same detail view addressed by the human-readable `SH-YYYY-NNNNNN` reference. */
export async function getBookingDetailByReference(
  reference: string,
  viewer: BookingViewer,
): Promise<BookingDetail> {
  const found = await prisma.booking.findUnique({
    where: { bookingReference: reference },
    select: { id: true },
  });
  if (!found) throw new BookingError("booking_not_found", "reservation not found");
  return getBookingDetail(found.id, viewer);
}

// ---------------------------------------------------------------------------
// Checkout — guest, walk-in, anonymous (the P5 gate)
// ---------------------------------------------------------------------------

export type CreateBookingInput = {
  checkIn: string;
  checkOut: string;
  adults: number;
  children: number;
  roomIds: string[];
  guest: GuestDetails;
  promotionCode?: string | null;
  notes?: string | null;
  /** Total the client was shown — any drift aborts with `price_changed`. */
  expectedTotal?: string | null;
  /** Staff only: create CONFIRMED (walk-in paying at the desk). */
  confirm?: boolean;
};

export async function createBooking(
  input: CreateBookingInput,
  actor: BookingActor,
): Promise<BookingSummary> {
  const checkIn = parseDateOnly(input.checkIn);
  const checkOut = parseDateOnly(input.checkOut);
  if (!checkIn || !checkOut) {
    throw new StayValidationError("invalid_date_range", "checkIn/checkOut must be YYYY-MM-DD");
  }
  const stay = normalizeRequest({
    checkIn,
    checkOut,
    adults: input.adults,
    children: input.children,
  });

  const hotel = await loadHotelContext();
  const today = hotelToday(new Date(), hotel.timezone);
  if (stay.checkIn.getTime() < today.getTime()) {
    throw new BookingError("check_in_past", "this stay would start in the past");
  }

  if (actor.kind === "anonymous" && GUEST_BOOKING_REQUIRES_ACCOUNT) {
    throw new BookingError("account_required", "an account is required to book online");
  }

  const guestId = await resolveGuestId(prisma, input.guest, actor);
  const initialStatus: "PENDING" | "CONFIRMED" =
    actor.kind === "staff" && input.confirm ? BookingStatus.CONFIRMED : BookingStatus.PENDING;

  const promotionCode = input.promotionCode?.trim() || null;
  const request: QuoteRequest = {
    ...stay,
    roomIds: input.roomIds,
    promotionCode,
    lockPromotion: false,
  };

  // 1) Quote (validates rooms/capacity/promotion and prices the stay).
  const computed = await computeQuote(request);

  // 2) Price re-validation against what the client was shown.
  if (input.expectedTotal != null && input.expectedTotal !== "") {
    const expected = parseMoney(input.expectedTotal);
    if (!expected || !moneyEquals(expected, computed.snapshot.breakdown.total)) {
      throw new BookingError(
        "price_changed",
        `the price changed: quoted ${input.expectedTotal}, now ${moneyString(computed.snapshot.breakdown.total)}`,
      );
    }
  }

  const rooms = computed.snapshot.rooms.map((line) => ({
    roomId: line.roomId,
    nightlyRate: line.nightlyRate,
    roomTotal: line.roomTotal,
  }));

  // 3) Allocate: lock → availability re-check → re-price → insert. The unique
  //    constraint on booking_reference turns a race into a retry, never a
  //    duplicate reference.
  let result: Awaited<ReturnType<typeof createPendingBooking>> | null = null;
  for (let attempt = 0; attempt < BOOKING_REFERENCE_ATTEMPTS; attempt += 1) {
    const bookingReference = await nextBookingReference(prisma);
    try {
      result = await createPendingBooking({
        guestId,
        bookingReference,
        checkIn: stay.checkIn,
        checkOut: stay.checkOut,
        adults: stay.adults,
        children: stay.children,
        rooms,
        notes: input.notes?.trim() || undefined,
        createdByUserId: actor.kind === "staff" ? actor.userId : undefined,
        initialStatus,
        priceCheck: {
          expected: computed.snapshot,
          compute: (tx) =>
            computeQuote({ ...request, lockPromotion: true }, tx).then((quoteInTx) => quoteInTx.snapshot),
        },
      });
      break;
    } catch (error) {
      if (
        error instanceof PriceChangedError ||
        error instanceof AvailabilityConflictError ||
        error instanceof QuoteError ||
        error instanceof StayValidationError
      ) {
        throw error;
      }
      if (isBookingReferenceConflict(error) && attempt < BOOKING_REFERENCE_ATTEMPTS - 1) {
        continue; // lost a reference race → re-read the sequence and try again
      }
      throw error;
    }
  }
  if (!result) {
    throw new Error("could not allocate a unique booking reference");
  }

  await writeAuditLog({
    userId: actor.kind === "staff" ? actor.userId : null,
    action: "booking.create",
    entityType: "booking",
    entityId: result.booking.id,
    newValues: {
      bookingReference: result.booking.bookingReference,
      bookingStatus: result.booking.bookingStatus,
      guestId,
      total: moneyString(computed.snapshot.breakdown.total),
      createdBy: actor.kind === "staff" ? "staff" : actor.kind,
    },
  });

  const row = await loadBookingRow(prisma, result.booking.id);
  if (!row) throw new BookingError("booking_not_found", "reservation vanished after creation");
  return toSummary(row, hotel.currency);
}

// ---------------------------------------------------------------------------
// Cancellation
// ---------------------------------------------------------------------------

async function doCancel(
  bookingId: string,
  actor: BookingActor,
  note?: string | null,
): Promise<BookingSummary> {
  const hotel = await loadHotelContext();
  const now = new Date();

  const existing = await prisma.booking.findUnique({
    where: { id: bookingId },
    select: { id: true, bookingStatus: true, checkIn: true, guestId: true },
  });
  if (!existing) throw new BookingError("booking_not_found", "reservation not found");
  if (actor.kind === "guest" && existing.guestId !== actor.guestId) {
    // Same answer as "does not exist": a guest id must never confirm another
    // guest's reservation.
    throw new BookingError("booking_not_found", "reservation not found");
  }

  const evaluation = evaluateCancellation(
    existing,
    actor.kind === "staff" ? "staff" : "guest",
    now,
    hotel.timezone,
  );
  if (!evaluation.allowed) {
    throw new BookingError(evaluation.reason, cancellationDenialMessage(evaluation.reason));
  }

  const summary = await prisma.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT "id" FROM "bookings" WHERE "id" = ${bookingId} FOR UPDATE`;
    const fresh = await tx.booking.findUniqueOrThrow({
      where: { id: bookingId },
      select: { id: true, bookingStatus: true, checkIn: true },
    });
    // Re-check under the lock: the status may have moved to CHECKED_IN since.
    const lockedEvaluation = evaluateCancellation(
      fresh,
      actor.kind === "staff" ? "staff" : "guest",
      now,
      hotel.timezone,
    );
    if (!lockedEvaluation.allowed) {
      throw new BookingError(
        lockedEvaluation.reason,
        cancellationDenialMessage(lockedEvaluation.reason),
      );
    }
    assertBookingTransition(fresh.bookingStatus, BookingStatus.CANCELLED);

    const current = await tx.booking.findUniqueOrThrow({ where: { id: bookingId } });
    const notes = note ? appendNote(current.notes, note, actorLabel(actor)) : current.notes;
    // The bookings trigger releases this reservation's room_nights.
    const updated = await tx.booking.update({
      where: { id: bookingId },
      data: { bookingStatus: BookingStatus.CANCELLED, notes },
    });

    const row = await loadBookingRow(tx, updated.id);
    if (!row) throw new BookingError("booking_not_found", "reservation vanished");
    return toSummary(row, hotel.currency);
  }, { maxWait: 10_000, timeout: 15_000 });

  await writeAuditLog({
    userId: actor.kind === "staff" ? actor.userId : null,
    action: "booking.cancel",
    entityType: "booking",
    entityId: bookingId,
    oldValues: { status: existing.bookingStatus },
    newValues: {
      status: BookingStatus.CANCELLED,
      by: actor.kind === "staff" ? "staff" : "guest",
      deadline: evaluation.deadline ? evaluation.deadline.toISOString() : null,
    },
  });

  return summary;
}

function cancellationDenialMessage(reason: CancellationDenialReason): string {
  switch (reason) {
    case "guest_cancellation_disabled":
      return "online cancellation is disabled — please contact the hotel";
    case "too_late_to_cancel":
      return "the free cancellation window has passed";
    default:
      return "this reservation can no longer be cancelled";
  }
}

/** Guest or staff cancels by reservation id (ownership checked inside). */
export async function cancelBooking(
  input: { bookingId: string; note?: string | null },
  actor: BookingActor,
): Promise<BookingSummary> {
  return doCancel(input.bookingId, actor, input.note);
}

/**
 * Cancel via a booking claim (the anonymous confirmation page): the claim must
 * name both the reference and the guest the reservation belongs to.
 */
export async function cancelBookingByClaim(
  input: { reference: string; guestId: string; note?: string | null },
): Promise<BookingSummary> {
  const booking = await prisma.booking.findUnique({
    where: { bookingReference: input.reference },
    select: { id: true, guestId: true },
  });
  if (!booking || booking.guestId !== input.guestId) {
    throw new BookingError("booking_not_found", "reservation not found");
  }
  return doCancel(booking.id, { kind: "guest", guestId: input.guestId }, input.note);
}

// ---------------------------------------------------------------------------
// Staff: status transitions (confirm / check-in / check-out / no-show / cancel)
// ---------------------------------------------------------------------------

export async function transitionBooking(
  input: { bookingId: string; to: BookingStatus; note?: string | null },
  actor: StaffActor,
): Promise<BookingSummary> {
  const hotel = await loadHotelContext();
  const today = hotelToday(new Date(), hotel.timezone);

  const existing = await prisma.booking.findUnique({
    where: { id: input.bookingId },
    select: { id: true, bookingStatus: true, checkIn: true },
  });
  if (!existing) throw new BookingError("booking_not_found", "reservation not found");

  assertBookingTransition(existing.bookingStatus, input.to);
  assertTransitionTiming(existing.bookingStatus, existing, input.to, today);
  if (input.to === BookingStatus.CANCELLED) {
    const evaluation = evaluateCancellation(existing, "staff", new Date(), hotel.timezone);
    if (!evaluation.allowed) {
      throw new BookingError(evaluation.reason, cancellationDenialMessage(evaluation.reason));
    }
  }

  const summary = await prisma.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT "id" FROM "bookings" WHERE "id" = ${input.bookingId} FOR UPDATE`;
    const fresh = await tx.booking.findUniqueOrThrow({
      where: { id: input.bookingId },
      select: { id: true, bookingStatus: true, checkIn: true },
    });
    assertBookingTransition(fresh.bookingStatus, input.to);
    assertTransitionTiming(fresh.bookingStatus, fresh, input.to, today);

    const current = await tx.booking.findUniqueOrThrow({ where: { id: input.bookingId } });
    const notes = input.note
      ? appendNote(current.notes, input.note, actorLabel(actor))
      : current.notes;

    await tx.booking.update({
      where: { id: input.bookingId },
      data: { bookingStatus: input.to, notes },
    });

    if (input.to === BookingStatus.CHECKED_IN || input.to === BookingStatus.CHECKED_OUT) {
      const allocations = await tx.bookingRoom.findMany({
        where: { bookingId: input.bookingId },
        select: { roomId: true, room: { select: { roomNumber: true, status: true } } },
      });

      if (input.to === BookingStatus.CHECKED_IN) {
        const notReady = allocations.filter((allocation) =>
          UNUSABLE_ROOM_STATUSES.includes(allocation.room.status),
        );
        if (notReady.length > 0) {
          throw new TransitionError(
            "room_not_ready",
            current.bookingStatus,
            input.to,
            `room(s) ${notReady
              .map((allocation) => allocation.room.roomNumber)
              .join(", ")} are not ready for check-in`,
          );
        }
        await tx.room.updateMany({
          where: { id: { in: allocations.map((row) => row.roomId) } },
          data: { status: RoomStatus.OCCUPIED },
        });
      } else {
        // Only rooms this stay actually occupied move on to housekeeping.
        await tx.room.updateMany({
          where: {
            id: { in: allocations.map((row) => row.roomId) },
            status: RoomStatus.OCCUPIED,
          },
          data: { status: RoomStatus.CLEANING },
        });
      }
    }

    const row = await loadBookingRow(tx, input.bookingId);
    if (!row) throw new BookingError("booking_not_found", "reservation vanished");
    return toSummary(row, hotel.currency);
  }, { maxWait: 10_000, timeout: 15_000 });

  await writeAuditLog({
    userId: actor.userId,
    action: input.to === BookingStatus.CANCELLED ? "booking.cancel" : "booking.transition",
    entityType: "booking",
    entityId: input.bookingId,
    oldValues: { status: existing.bookingStatus },
    newValues: {
      status: input.to,
      ...(input.to === BookingStatus.CHECKED_IN || input.to === BookingStatus.CHECKED_OUT
        ? { roomStatus: input.to === BookingStatus.CHECKED_IN ? "OCCUPIED" : "CLEANING" }
        : {}),
    },
  });

  return summary;
}

// ---------------------------------------------------------------------------
// Staff: modify a live reservation
// ---------------------------------------------------------------------------

export type ModifyBookingFields = {
  bookingId: string;
  checkIn?: string;
  checkOut?: string;
  adults?: number;
  children?: number;
  roomIds?: string[];
  notes?: string | null;
  /** undefined = keep, null = remove, string = apply (re-priced). */
  promotionCode?: string | null;
  guest?: Partial<GuestDetails>;
};

const MODIFIABLE_STATUSES: BookingStatus[] = [BookingStatus.PENDING, BookingStatus.CONFIRMED];

export async function modifyBooking(
  input: ModifyBookingFields,
  actor: StaffActor,
): Promise<BookingSummary> {
  const existing = await loadBookingRow(prisma, input.bookingId);
  if (!existing) throw new BookingError("booking_not_found", "reservation not found");
  if (!MODIFIABLE_STATUSES.includes(existing.bookingStatus)) {
    throw new BookingError(
      "not_modifiable",
      `a ${existing.bookingStatus} reservation cannot be modified`,
    );
  }

  const checkIn = input.checkIn ? parseDateOnly(input.checkIn) : existing.checkIn;
  const checkOut = input.checkOut ? parseDateOnly(input.checkOut) : existing.checkOut;
  if (!checkIn || !checkOut) {
    throw new StayValidationError("invalid_date_range", "checkIn/checkOut must be YYYY-MM-DD");
  }
  const stay = normalizeRequest({
    checkIn,
    checkOut,
    adults: input.adults ?? existing.adults,
    children: input.children ?? existing.children,
  });

  const hotel = await loadHotelContext();
  const today = hotelToday(new Date(), hotel.timezone);
  if (stay.checkIn.getTime() < today.getTime()) {
    throw new BookingError("check_in_past", "this stay would start in the past");
  }

  const roomIds = input.roomIds ?? existing.rooms.map((line) => line.roomId);
  const promotionCode =
    input.promotionCode === undefined ? existing.promotionCode : input.promotionCode;

  const sameRoomSet =
    roomIds.length === existing.rooms.length &&
    roomIds.every((id) => existing.rooms.some((line) => line.roomId === id));
  const stayChanged =
    stay.checkIn.getTime() !== existing.checkIn.getTime() ||
    stay.checkOut.getTime() !== existing.checkOut.getTime() ||
    stay.adults !== existing.adults ||
    stay.children !== existing.children ||
    !sameRoomSet;
  const promotionChanged = input.promotionCode !== undefined;

  if (input.guest && Object.keys(input.guest).length > 0) {
    await prisma.guest.update({
      where: { id: existing.guestId },
      data: {
        ...(input.guest.firstName ? { firstName: input.guest.firstName } : {}),
        ...(input.guest.lastName ? { lastName: input.guest.lastName } : {}),
        ...(input.guest.phone !== undefined ? { phone: input.guest.phone ?? null } : {}),
        ...(input.guest.idType !== undefined ? { idType: input.guest.idType ?? null } : {}),
        ...(input.guest.idNumber !== undefined ? { idNumber: input.guest.idNumber ?? null } : {}),
      },
    });
  }

  if (!stayChanged && !promotionChanged) {
    if (input.notes !== undefined) {
      await prisma.booking.update({
        where: { id: existing.id },
        data: { notes: input.notes || null },
      });
    }
    await writeAuditLog({
      userId: actor.userId,
      action: "booking.modify",
      entityType: "booking",
      entityId: existing.id,
      newValues: {
        fields: [
          ...(input.notes !== undefined ? ["notes"] : []),
          ...(input.guest && Object.keys(input.guest).length > 0 ? ["guest"] : []),
        ],
      },
    });
    const row = await loadBookingRow(prisma, existing.id);
    if (!row) throw new BookingError("booking_not_found", "reservation not found");
    return toSummary(row, hotel.currency);
  }

  const summary = await prisma.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT "id" FROM "bookings" WHERE "id" = ${existing.id} FOR UPDATE`;
    const fresh = await tx.booking.findUniqueOrThrow({
      where: { id: existing.id },
      select: { id: true, bookingStatus: true },
    });
    if (!MODIFIABLE_STATUSES.includes(fresh.bookingStatus)) {
      throw new BookingError(
        "not_modifiable",
        `a ${fresh.bookingStatus} reservation cannot be modified`,
      );
    }

    // Lock old and new rooms together (sorted ⇒ same order as every allocator).
    const lockOrder = [
      ...new Set([...existing.rooms.map((line) => line.roomId), ...roomIds]),
    ].sort();
    await tx.$queryRaw`SELECT "id" FROM "rooms" WHERE "id" IN (${Prisma.join(
      lockOrder,
    )}) ORDER BY "id" FOR UPDATE`;

    // Drop this booking's own allocation, then re-check as if it were new.
    await tx.roomNight.deleteMany({ where: { bookingId: existing.id } });
    await tx.bookingRoom.deleteMany({ where: { bookingId: existing.id } });

    await releaseExpiredHolds(tx, { checkIn: stay.checkIn, checkOut: stay.checkOut });
    await assertRoomsAvailable(tx, stay, roomIds, { excludeBookingId: existing.id });

    const computed = await computeQuote(
      { ...stay, roomIds, promotionCode, lockPromotion: true },
      tx,
    );

    for (const line of computed.lines) {
      await tx.bookingRoom.create({
        data: {
          bookingId: existing.id,
          roomId: line.roomId,
          nightlyRate: line.nightlyRate,
          nights: line.nights,
          roomTotal: line.roomTotal,
        },
      });
    }
    try {
      await tx.roomNight.createMany({
        data: expandNights(stay.checkIn, stay.checkOut, ALLOW_SAME_DAY_TURNOVER).flatMap(
          (night) => roomIds.map((roomId) => ({ night, roomId, bookingId: existing.id })),
        ),
      });
    } catch (error) {
      if (isRoomNightsViolation(error)) {
        throw new AvailabilityConflictError(
          "stay_overlap",
          roomIds,
          "the requested dates are no longer free",
        );
      }
      throw error;
    }

    const breakdown = computed.snapshot.breakdown;
    await tx.booking.update({
      where: { id: existing.id },
      data: {
        checkIn: stay.checkIn,
        checkOut: stay.checkOut,
        adults: stay.adults,
        children: stay.children,
        subtotal: breakdown.subtotal,
        taxes: breakdown.taxes,
        fees: breakdown.fees,
        discount: breakdown.discount,
        total: breakdown.total,
        promotionId: computed.snapshot.promotion?.id ?? null,
        promotionCode: computed.snapshot.promotion?.code ?? null,
        ...(input.notes !== undefined ? { notes: input.notes || null } : {}),
      },
    });

    const row = await loadBookingRow(tx, existing.id);
    if (!row) throw new BookingError("booking_not_found", "reservation vanished");
    return toSummary(row, computed.currency);
  }, { maxWait: 10_000, timeout: 20_000 });

  await writeAuditLog({
    userId: actor.userId,
    action: "booking.modify",
    entityType: "booking",
    entityId: existing.id,
    oldValues: {
      checkIn: existing.checkIn.toISOString().slice(0, 10),
      checkOut: existing.checkOut.toISOString().slice(0, 10),
      total: moneyString(existing.total),
      rooms: existing.rooms.map((line) => line.roomId),
    },
    newValues: {
      checkIn: summary.checkIn,
      checkOut: summary.checkOut,
      total: summary.breakdown.total,
      rooms: summary.rooms.map((line) => line.roomId),
    },
  });

  return summary;
}

// ---------------------------------------------------------------------------
// Staff: operational notes
// ---------------------------------------------------------------------------

export async function addBookingNote(
  input: { bookingId: string; note: string },
  actor: StaffActor,
): Promise<{ notes: string }> {
  const existing = await prisma.booking.findUnique({
    where: { id: input.bookingId },
    select: { id: true, notes: true },
  });
  if (!existing) throw new BookingError("booking_not_found", "reservation not found");

  const notes = appendNote(existing.notes, input.note, actorLabel(actor));
  await prisma.booking.update({ where: { id: existing.id }, data: { notes } });

  await writeAuditLog({
    userId: actor.userId,
    action: "booking.note",
    entityType: "booking",
    entityId: existing.id,
    newValues: { note: input.note },
  });
  return { notes };
}

// ---------------------------------------------------------------------------
// Staff: room status transitions (CheckedOut → Cleaning → Available)
// ---------------------------------------------------------------------------

export async function updateRoomStatus(
  input: { roomId: string; status: RoomStatus; note?: string | null },
  actor: StaffActor,
): Promise<{ roomId: string; roomNumber: string; previous: RoomStatus; status: RoomStatus }> {
  const result = await prisma.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT "id" FROM "rooms" WHERE "id" = ${input.roomId} FOR UPDATE`;
    const room = await tx.room.findUnique({ where: { id: input.roomId } });
    if (!room) throw new BookingError("room_not_found", "room not found");
    assertRoomTransition(room.status, input.status);

    const notes = input.note ? appendNote(room.notes, input.note, actorLabel(actor)) : room.notes;
    await tx.room.update({ where: { id: room.id }, data: { status: input.status, notes } });
    return { roomId: room.id, roomNumber: room.roomNumber, previous: room.status, status: input.status };
  }, { maxWait: 10_000, timeout: 15_000 });

  await writeAuditLog({
    userId: actor.userId,
    action: "room.status",
    entityType: "room",
    entityId: result.roomId,
    oldValues: { status: result.previous },
    newValues: { status: result.status, roomNumber: result.roomNumber },
  });

  return result;
}

export { allowedRoomTransitions, allowedTransitions, cancellationDeadline, evaluateCancellation };
