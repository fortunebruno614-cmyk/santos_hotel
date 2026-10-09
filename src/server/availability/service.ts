import { prisma } from "@/lib/prisma";
import {
  BookingStatus,
  PaymentStatus,
  Prisma,
  RecordStatus,
  RoomStatus,
} from "@/generated/prisma/client";
import {
  ALLOW_SAME_DAY_TURNOVER,
  CHILDREN_COUNT_AS_ADULTS,
  PENDING_HOLD_MINUTES,
} from "@/config/availability";
import {
  expandNights,
  intervalsOverlap,
  nightsCount,
  toUtcDateOnly,
  type StayWindow,
} from "@/server/availability/overlap";
import { MAX_STAY_NIGHTS } from "@/server/availability/validation";
import {
  PriceChangedError,
  money,
  snapshotsEqual,
  type PricingSnapshot,
} from "@/server/pricing/model";

/**
 * P4 availability engine — the final authority on who may occupy which room.
 *
 * Three layers, weakest to strongest:
 *
 *  1. `findAvailability` — read-only search: active room types that fit the
 *     party, physical rooms that are not Maintenance/Out-Of-Service, minus rooms
 *     allocated to an overlapping booking that currently blocks inventory.
 *  2. `assertRoomsAvailable` — the same rules re-run *inside* the booking
 *     transaction, after the room rows are locked (P5 checkout must call it).
 *  3. `room_nights` — the database's own opinion: one row per room per night,
 *     `PRIMARY KEY (room_id, night)`. Even code that skips layers 1–2 cannot
 *     double-book; the insert itself fails.
 *
 * Blocking rule for existing bookings (single source for search *and* re-check):
 *
 *   bookingStatus <> 'CANCELLED'
 *   AND ( bookingStatus <> 'PENDING'
 *         OR paymentStatus = 'PAID'                      -- committed money
 *         OR createdAt >= now() - PENDING_HOLD_MINUTES ) -- unpaid hold window
 *
 * Unpaid Pending bookings therefore hold rooms for a bounded time and then stop
 * blocking (their nights are released by `releaseExpiredHolds`), so abandoned
 * checkouts cannot leak inventory (docs/OPEN_QUESTIONS.md #20).
 */

/** Operational states in which a physical room cannot take a new stay at all. */
const BLOCKED_ROOM_STATUSES = new Set<string>([RoomStatus.MAINTENANCE, RoomStatus.OUT_OF_SERVICE]);

/** Statuses that block inventory for as long as the booking lives (never "expired"). */
const HARD_BLOCKING_STATUSES: BookingStatus[] = [
  BookingStatus.CONFIRMED,
  BookingStatus.CHECKED_IN,
  BookingStatus.CHECKED_OUT,
  BookingStatus.NO_SHOW,
];

type Db = Prisma.TransactionClient | typeof prisma;

export type AvailabilityRequest = {
  checkIn: Date;
  checkOut: Date;
  adults: number;
  children: number;
};

export type AvailabilityRoom = {
  id: string;
  roomNumber: string;
  floor: number | null;
  status: RoomStatus;
};

export type AvailabilityRoomType = {
  id: string;
  name: string;
  slug: string;
  maxAdults: number;
  maxChildren: number;
  basePrice: string;
  totalRooms: number;
  availableRooms: AvailabilityRoom[];
  availableCount: number;
};

export type AvailabilityResult = {
  checkIn: Date;
  checkOut: Date;
  adults: number;
  children: number;
  nights: number;
  roomTypes: AvailabilityRoomType[];
  availableRoomCount: number;
  hasAvailability: boolean;
};

export type ConflictReason =
  | "room_not_found"
  | "room_type_inactive"
  | "room_unavailable"
  | "capacity_exceeded"
  | "stay_overlap";

/** Input contradicts the stay rules (bad dates/occupancy) — a caller bug, not a conflict. */
export type StayValidationCode = "invalid_date_range" | "stay_too_long" | "invalid_occupancy";

export class StayValidationError extends Error {
  readonly code: StayValidationCode;
  constructor(code: StayValidationCode, message: string) {
    super(message);
    this.name = "StayValidationError";
    this.code = code;
  }
}

/** The requested rooms cannot be given (for the stated reason). */
export class AvailabilityConflictError extends Error {
  readonly reason: ConflictReason;
  readonly roomIds: string[];
  constructor(reason: ConflictReason, roomIds: string[], message?: string) {
    super(message ?? `${reason}: ${roomIds.length} room(s) cannot be allocated`);
    this.name = "AvailabilityConflictError";
    this.reason = reason;
    this.roomIds = roomIds;
  }
}

function holdCutoff(now: Date = new Date()): Date {
  return new Date(now.getTime() - PENDING_HOLD_MINUTES * 60_000);
}

type NormalizedRequest = {
  checkIn: Date;
  checkOut: Date;
  adults: number;
  children: number;
  nights: number;
};

/**
 * Service-level validation: the wire schema (zod) runs first at the edge, but
 * every entry point still normalises dates to UTC midnight and re-checks the
 * invariants — a date with a stray time component must never shift a night row.
 */
export function normalizeRequest(request: AvailabilityRequest): NormalizedRequest {
  const checkIn = toUtcDateOnly(request.checkIn);
  const checkOut = toUtcDateOnly(request.checkOut);

  if (!(checkOut.getTime() > checkIn.getTime())) {
    throw new StayValidationError("invalid_date_range", "checkOut must be after checkIn");
  }
  const nights = nightsCount(checkIn, checkOut);
  if (nights > MAX_STAY_NIGHTS) {
    throw new StayValidationError("stay_too_long", `stay exceeds ${MAX_STAY_NIGHTS} nights`);
  }
  if (!Number.isInteger(request.adults) || request.adults < 1 || request.adults > 20) {
    throw new StayValidationError("invalid_occupancy", "adults must be an integer in 1..20");
  }
  if (!Number.isInteger(request.children) || request.children < 0 || request.children > 20) {
    throw new StayValidationError("invalid_occupancy", "children must be an integer in 0..20");
  }
  return { checkIn, checkOut, adults: request.adults, children: request.children, nights };
}

/**
 * Party fits the room type. Default counting (docs/OPEN_QUESTIONS.md #15, still
 * open): adults against `max_adults`, children against `max_adults`' companion
 * `max_children` — unless `CHILDREN_COUNT_AS_ADULTS=true`.
 */
export function capacityFits(
  type: { maxAdults: number; maxChildren: number },
  adults: number,
  children: number,
  options: { childrenCountAsAdults?: boolean } = {},
): boolean {
  const childrenAsAdults = options.childrenCountAsAdults ?? CHILDREN_COUNT_AS_ADULTS;
  if (childrenAsAdults) return adults + children <= type.maxAdults;
  return adults <= type.maxAdults && children <= type.maxChildren;
}

type BlockingRow = {
  roomId: string;
  booking: { id: string; checkIn: Date; checkOut: Date };
};

/**
 * Bookings that hold inventory for any of `roomIds`, in a coarse date window
 * (`checkIn <= requested.checkOut AND checkOut >= requested.checkIn`) that is a
 * superset of both turnover modes. The *exact* overlap decision is made by
 * `intervalsOverlap`, so search, re-check and the night expansion share one rule.
 */
async function loadBlockingBookings(
  client: Db,
  roomIds: string[],
  window: StayWindow,
): Promise<BlockingRow[]> {
  if (roomIds.length === 0) return [];
  const cutoff = holdCutoff();

  const rows = await client.bookingRoom.findMany({
    where: {
      roomId: { in: roomIds },
      booking: {
        bookingStatus: { not: BookingStatus.CANCELLED },
        checkIn: { lte: window.checkOut },
        checkOut: { gte: window.checkIn },
        OR: [
          { bookingStatus: { in: HARD_BLOCKING_STATUSES } },
          { bookingStatus: BookingStatus.PENDING, paymentStatus: PaymentStatus.PAID },
          { bookingStatus: BookingStatus.PENDING, createdAt: { gte: cutoff } },
        ],
      },
    },
    select: {
      roomId: true,
      booking: { select: { id: true, checkIn: true, checkOut: true } },
    },
  });
  return rows;
}

function overlappingRows(rows: BlockingRow[], window: StayWindow): BlockingRow[] {
  return rows.filter((row) =>
    intervalsOverlap(
      { checkIn: row.booking.checkIn, checkOut: row.booking.checkOut },
      window,
      ALLOW_SAME_DAY_TURNOVER,
    ),
  );
}

/**
 * Given `(check_in, check_out, adults, children)` → eligible room types and the
 * physical rooms still free for those dates.
 *
 * A room type is eligible when it is `ACTIVE` and fits the party; a room is
 * available when its type is eligible, its status is not
 * Maintenance/Out-Of-Service, and no blocking booking overlaps the window.
 * Eligible-but-sold-out types are returned with `availableRooms: []` so callers
 * can tell "no such room type" from "no rooms left".
 */
export async function findAvailability(request: AvailabilityRequest): Promise<AvailabilityResult> {
  const { checkIn, checkOut, adults, children, nights } = normalizeRequest(request);

  const roomTypes = await prisma.roomType.findMany({
    where: { status: RecordStatus.ACTIVE },
    include: { rooms: { orderBy: { roomNumber: "asc" } } },
    orderBy: { name: "asc" },
  });

  const eligible = roomTypes.filter((type) => capacityFits(type, adults, children));
  const candidates = eligible
    .flatMap((type) => type.rooms)
    .filter((room) => !BLOCKED_ROOM_STATUSES.has(room.status));

  const blockingRows = await loadBlockingBookings(
    prisma,
    candidates.map((room) => room.id),
    { checkIn, checkOut },
  );
  const blockedRoomIds = new Set(
    overlappingRows(blockingRows, { checkIn, checkOut }).map((row) => row.roomId),
  );

  const resultTypes: AvailabilityRoomType[] = eligible.map((type) => {
    const available = type.rooms.filter(
      (room) => !BLOCKED_ROOM_STATUSES.has(room.status) && !blockedRoomIds.has(room.id),
    );
    return {
      id: type.id,
      name: type.name,
      slug: type.slug,
      maxAdults: type.maxAdults,
      maxChildren: type.maxChildren,
      basePrice: type.basePrice.toString(),
      totalRooms: type.rooms.length,
      availableRooms: available.map((room) => ({
        id: room.id,
        roomNumber: room.roomNumber,
        floor: room.floor,
        status: room.status,
      })),
      availableCount: available.length,
    };
  });

  const availableRoomCount = resultTypes.reduce((sum, type) => sum + type.availableCount, 0);
  return {
    checkIn,
    checkOut,
    adults,
    children,
    nights,
    roomTypes: resultTypes,
    availableRoomCount,
    hasAvailability: availableRoomCount > 0,
  };
}

/**
 * Authoritative in-transaction re-check (P5 checkout, P7 modifications).
 * Throws `AvailabilityConflictError` naming the offending rooms; succeeds only
 * when every requested room exists, is active, operational, big enough and free.
 *
 * `excludeBookingId` lets a modification re-check against its own booking.
 */
export async function assertRoomsAvailable(
  client: Db,
  request: AvailabilityRequest,
  roomIds: string[],
  options: { excludeBookingId?: string } = {},
): Promise<void> {
  const { checkIn, checkOut, adults, children } = normalizeRequest(request);

  const uniqueIds = [...new Set(roomIds)];
  if (uniqueIds.length === 0) {
    throw new AvailabilityConflictError("room_not_found", [], "no rooms requested");
  }

  const rooms = await client.room.findMany({
    where: { id: { in: uniqueIds } },
    include: { roomType: true },
  });
  const foundIds = new Set(rooms.map((room) => room.id));
  const missing = uniqueIds.filter((id) => !foundIds.has(id));
  if (missing.length > 0) {
    throw new AvailabilityConflictError("room_not_found", missing);
  }

  const inactiveType = rooms.filter((room) => room.roomType.status !== RecordStatus.ACTIVE);
  if (inactiveType.length > 0) {
    throw new AvailabilityConflictError(
      "room_type_inactive",
      inactiveType.map((room) => room.id),
    );
  }

  const blockedStatus = rooms.filter((room) => BLOCKED_ROOM_STATUSES.has(room.status));
  if (blockedStatus.length > 0) {
    throw new AvailabilityConflictError(
      "room_unavailable",
      blockedStatus.map((room) => room.id),
    );
  }

  // Capacity is evaluated across the whole allocation. One room still has to
  // fit the party on its own (identical to the per-room rule when a single room
  // is requested), while a party of four may fill two 2-adult rooms — the
  // multi-room case docs/OPEN_QUESTIONS.md #14 requires.
  const combinedCapacity = rooms.reduce(
    (sum, room) => ({
      maxAdults: sum.maxAdults + room.roomType.maxAdults,
      maxChildren: sum.maxChildren + room.roomType.maxChildren,
    }),
    { maxAdults: 0, maxChildren: 0 },
  );
  if (!capacityFits(combinedCapacity, adults, children)) {
    throw new AvailabilityConflictError("capacity_exceeded", uniqueIds);
  }

  const blockingRows = await loadBlockingBookings(client, uniqueIds, { checkIn, checkOut });
  const conflicts = overlappingRows(blockingRows, { checkIn, checkOut }).filter(
    (row) => options.excludeBookingId !== row.booking.id,
  );
  if (conflicts.length > 0) {
    throw new AvailabilityConflictError(
      "stay_overlap",
      [...new Set(conflicts.map((row) => row.roomId))],
      `stay overlaps booking(s) ${[...new Set(conflicts.map((row) => row.booking.id))].join(", ")}`,
    );
  }
}

/**
 * Releases nights held by expired unpaid Pending bookings (`PENDING_HOLD_MINUTES`
 * past `created_at`, never `PAID`). Scope limits the sweep to the window about to
 * be allocated; omit it for a global sweep (a cron/scheduler can call this too).
 * Returns the number of released nights.
 */
export async function releaseExpiredHolds(client: Db, scope?: StayWindow): Promise<number> {
  const cutoff = holdCutoff();
  const result = await client.roomNight.deleteMany({
    where: {
      booking: {
        bookingStatus: BookingStatus.PENDING,
        paymentStatus: { not: PaymentStatus.PAID },
        createdAt: { lt: cutoff },
        ...(scope
          ? { checkIn: { lte: scope.checkOut }, checkOut: { gte: scope.checkIn } }
          : {}),
      },
    },
  });
  return result.count;
}

export type PendingBookingRoom = {
  roomId: string;
  nightlyRate: number | Prisma.Decimal;
  /**
   * Exact stay total for this room. Defaults to `nightlyRate × nights` (the P4
   * behaviour). P5 passes the priced `room_total` so a stay whose rate changes
   * midway still stores the exact sum of its nights.
   */
  roomTotal?: number | Prisma.Decimal;
};

/** Only a new or desk-confirmed reservation may be *created* in this status. */
export type InitialBookingStatus = Extract<BookingStatus, "PENDING" | "CONFIRMED">;

export type PendingBookingInput = {
  guestId: string;
  /** P5 owns the `SH-YYYY-NNNNNN` generator; callers must pass a unique reference. */
  bookingReference: string;
  checkIn: Date;
  checkOut: Date;
  adults: number;
  children: number;
  /** Room allocation with the nightly rate snapshot (pricing itself is P5). */
  rooms: PendingBookingRoom[];
  notes?: string;
  /**
   * P5 price re-validation: `compute` re-derives the whole quote *inside* the
   * booking transaction — after the rooms are locked and availability re-asserted
   * — and must equal `expected`, the price the caller was shown. Any drift throws
   * `PriceChangedError` and rolls the booking back, so a stored price can never
   * disagree with the quoted price.
   */
  priceCheck?: {
    expected: PricingSnapshot;
    compute: (client: Db) => Promise<PricingSnapshot>;
  };
  /** Staff/walk-in bookings record who created them (`created_by_user_id`). */
  createdByUserId?: string;
  /**
   * Initial reservation status: PENDING (guest checkout, default) or CONFIRMED
   * (walk-in confirmed at the desk). Every other status arrives through a
   * guarded transition (src/server/booking/policy.ts).
   */
  initialStatus?: InitialBookingStatus;
};

export type PendingBookingResult = {
  booking: { id: string; bookingReference: string; bookingStatus: BookingStatus };
  roomIds: string[];
  nights: number;
};

/** True when the `room_nights` primary key (or its unique index) rejected an insert. */
export function isRoomNightsViolation(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;
  const e = error as {
    code?: string;
    message?: string;
    meta?: { target?: unknown; cause?: { originalMessage?: string } };
  };
  const target = e.meta?.target;
  const targetText = Array.isArray(target) ? target.join(",") : String(target ?? "");
  const original = e.meta?.cause?.originalMessage ?? "";
  if (targetText.includes("room_nights") || e.message?.includes("room_nights")) return true;
  if (original.includes("room_nights")) return true;
  // Prisma P2002 reports the columns (`room_id`,`night`), not the table.
  return e.code === "P2002" && (targetText.includes("night") || original.includes("night"));
}

/**
 * Creates a `PENDING` booking with its rooms allocated — the transactional
 * primitive P5 checkout will wrap. The sequence is what makes double-booking
 * impossible under concurrency:
 *
 *  1. `SELECT … FOR UPDATE` the requested room rows **in sorted order** (stable
 *     lock order ⇒ no deadlocks; concurrent allocators of the same room queue).
 *  2. Release expired unpaid holds in the window (so stale nights cannot reject
 *     a stay the policy already treats as free).
 *  3. `assertRoomsAvailable` — the policy re-check, now under the lock, sees
 *     whatever the previous transaction committed.
 *  4. Re-price the stay (`priceCheck`, when given) and require the quote to be
 *     unchanged — the price written to the row is the price that was shown.
 *  5. Insert `bookings` + `booking_rooms` (rate snapshots).
 *  6. Insert `room_nights` — `PRIMARY KEY (room_id, night)`. Even if steps 1–3
 *     were bypassed, the database rejects the second allocation of a night.
 */
export async function createPendingBooking(
  input: PendingBookingInput,
): Promise<PendingBookingResult> {
  const request = normalizeRequest(input);
  const { checkIn, checkOut, adults, children, nights } = request;

  if (input.rooms.length === 0) {
    throw new AvailabilityConflictError("room_not_found", [], "at least one room is required");
  }
  const roomIds = input.rooms.map((room) => room.roomId);
  if (new Set(roomIds).size !== roomIds.length) {
    throw new Error("duplicate room in allocation");
  }
  for (const room of input.rooms) {
    const rate =
      room.nightlyRate instanceof Prisma.Decimal
        ? room.nightlyRate
        : new Prisma.Decimal(room.nightlyRate);
    if (!rate.isFinite() || rate.isNegative()) {
      throw new Error(`invalid nightlyRate for room ${room.roomId}`);
    }
    if (room.roomTotal !== undefined) {
      const total =
        room.roomTotal instanceof Prisma.Decimal
          ? room.roomTotal
          : new Prisma.Decimal(room.roomTotal);
      if (!total.isFinite() || total.isNegative()) {
        throw new Error(`invalid roomTotal for room ${room.roomId}`);
      }
    }
  }

  const lockOrder = [...roomIds].sort();
  const window: StayWindow = { checkIn, checkOut };

  return prisma.$transaction(
    async (tx) => {
      await tx.$queryRaw`SELECT "id" FROM "rooms" WHERE "id" IN (${Prisma.join(
        lockOrder,
      )}) ORDER BY "id" FOR UPDATE`;

      await releaseExpiredHolds(tx, window);
      await assertRoomsAvailable(tx, { checkIn, checkOut, adults, children }, roomIds);

      // P5 price re-validation: re-derive the quote under the lock and refuse
      // to store anything the caller was not quoted.
      let pricing: PricingSnapshot | null = null;
      if (input.priceCheck) {
        const actual = await input.priceCheck.compute(tx);
        const actualIds = actual.rooms.map((line) => line.roomId).sort();
        const requestedIds = [...roomIds].sort();
        if (
          actualIds.length !== requestedIds.length ||
          actualIds.some((id, index) => id !== requestedIds[index])
        ) {
          throw new Error("pricing recompute returned a different room set");
        }
        if (!snapshotsEqual(actual, input.priceCheck.expected)) {
          throw new PriceChangedError(input.priceCheck.expected.breakdown, actual.breakdown);
        }
        pricing = actual;
      }

      const derivedSubtotal = input.rooms.reduce(
        (sum, room) => money(sum.add(new Prisma.Decimal(room.nightlyRate).mul(nights))),
        money(0),
      );
      const breakdown = pricing?.breakdown ?? {
        subtotal: derivedSubtotal,
        taxes: money(0),
        fees: money(0),
        discount: money(0),
        total: derivedSubtotal,
      };

      const booking = await tx.booking.create({
        data: {
          bookingReference: input.bookingReference,
          guestId: input.guestId,
          promotionId: pricing?.promotion?.id ?? null,
          promotionCode: pricing?.promotion?.code ?? null,
          checkIn,
          checkOut,
          adults,
          children,
          subtotal: breakdown.subtotal,
          taxes: breakdown.taxes,
          fees: breakdown.fees,
          discount: breakdown.discount,
          total: breakdown.total,
          bookingStatus: input.initialStatus ?? BookingStatus.PENDING,
          paymentStatus: PaymentStatus.PENDING,
          notes: input.notes,
          createdByUserId: input.createdByUserId ?? null,
        },
      });

      const pricedRooms = new Map((pricing?.rooms ?? []).map((line) => [line.roomId, line]));
      for (const room of input.rooms) {
        const line = pricedRooms.get(room.roomId);
        const nightlyRate = line ? line.nightlyRate : money(room.nightlyRate);
        const roomTotal = line
          ? line.roomTotal
          : room.roomTotal !== undefined
            ? money(room.roomTotal)
            : money(new Prisma.Decimal(room.nightlyRate).mul(nights));
        await tx.bookingRoom.create({
          data: {
            bookingId: booking.id,
            roomId: room.roomId,
            nightlyRate,
            nights,
            roomTotal,
          },
        });
      }

      try {
        await tx.roomNight.createMany({
          data: expandNights(checkIn, checkOut, ALLOW_SAME_DAY_TURNOVER).flatMap((night) =>
            roomIds.map((roomId) => ({ night, roomId, bookingId: booking.id })),
          ),
        });
      } catch (error) {
        if (isRoomNightsViolation(error)) {
          // The DB caught what the layers above missed — the transaction rolls
          // back, so no partial booking survives.
          throw new AvailabilityConflictError(
            "stay_overlap",
            roomIds,
            "room_nights constraint rejected the allocation",
          );
        }
        throw error;
      }

      return {
        booking: {
          id: booking.id,
          bookingReference: booking.bookingReference,
          bookingStatus: booking.bookingStatus,
        },
        roomIds,
        nights,
      };
    },
    { maxWait: 10_000, timeout: 15_000 },
  );
}
