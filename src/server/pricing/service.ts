import { prisma } from "@/lib/prisma";
import { Prisma, BookingStatus, PromotionType, RecordStatus } from "@/generated/prisma/client";
import {
  CANCELLATION_WINDOW_HOURS,
  MAX_ROOMS_PER_BOOKING,
  SERVICE_FEE,
  TAX_RATE_PERCENT,
} from "@/config/booking";
import {
  AvailabilityConflictError,
  capacityFits,
  normalizeRequest,
} from "@/server/availability/service";
import { addDays, nightsCount, toUtcDateOnly } from "@/server/availability/overlap";
import { loadHotelContext, type HotelContext } from "@/server/pricing/context";
import {
  money,
  moneyString,
  type Money,
  type MoneyBreakdown,
  type PricingSnapshot,
} from "@/server/pricing/model";

/**
 * P5 server-side pricing — the only place a price is derived.
 *
 *   nightly rate = the ACTIVE `rates` row whose window covers the night
 *                → fallback `room_types.base_price` (docs/OPEN_QUESTIONS.md #12:
 *                  no special-date pricing exists yet, so the window rule is the
 *                  whole rule)
 *   room total   = sum of its nights
 *   subtotal     = sum of the room totals
 *   discount     = promotion applied to the subtotal (capped at the subtotal)
 *   taxes        = (subtotal − discount) × TAX_RATE_PERCENT
 *   fees         = SERVICE_FEE, once per booking
 *   total        = subtotal − discount + taxes + fees
 *
 * The same function runs twice per checkout: once to quote the guest, once
 * inside the booking transaction (`priceCheck`) where it must agree bit for bit.
 */

type Db = Prisma.TransactionClient | typeof prisma;

/** The quote cannot be produced (bad rooms or a promotion that does not qualify). */
export type QuoteErrorCode =
  | "promotion_not_found"
  | "promotion_inactive"
  | "promotion_expired"
  | "promotion_exhausted"
  | "too_many_rooms";

export class QuoteError extends Error {
  readonly code: QuoteErrorCode;
  constructor(code: QuoteErrorCode, message: string) {
    super(message);
    this.name = "QuoteError";
    this.code = code;
  }
}

export type QuoteRequest = {
  checkIn: Date;
  checkOut: Date;
  adults: number;
  children: number;
  roomIds: string[];
  /** Promotion code the guest supplied; null/absent means no discount. */
  promotionCode?: string | null;
  /**
   * Lock the promotion row while validating `maxUses` — set inside the booking
   * transaction so two checkouts cannot both claim the last redemption.
   */
  lockPromotion?: boolean;
  now?: Date;
};

export type QuoteLine = {
  roomId: string;
  roomNumber: string;
  floor: number | null;
  roomTypeId: string;
  roomTypeName: string;
  roomTypeSlug: string;
  /** Exact rate of every charged night — the evidence behind `roomTotal`. */
  perNight: string[];
  /** Snapshot average (roomTotal ÷ nights) stored in `booking_rooms.nightly_rate`. */
  nightlyRate: string;
  nights: number;
  roomTotal: string;
};

export type QuoteResult = {
  checkIn: string;
  checkOut: string;
  nights: number;
  adults: number;
  children: number;
  currency: string;
  hotel: { name: string; timezone: string; checkInTime: string; checkOutTime: string };
  lines: QuoteLine[];
  promotion: { code: string; type: PromotionType; value: string; discount: string } | null;
  breakdown: {
    subtotal: string;
    taxes: string;
    fees: string;
    discount: string;
    total: string;
  };
  /** Echoed so the UI can state the cancellation policy without hardcoding it. */
  policy: { cancellationWindowHours: number };
};

type AppliedPromotion = {
  id: string;
  code: string;
  type: PromotionType;
  value: Money;
};

type ComputedQuote = {
  snapshot: PricingSnapshot;
  lines: QuoteLine[];
  promotion: AppliedPromotion | null;
  currency: string;
  hotel: HotelContext;
  checkIn: Date;
  checkOut: Date;
  nights: number;
  adults: number;
  children: number;
};


/**
 * Resolves the promotion a code refers to. Throws `QuoteError` for every way a
 * code can fail to qualify: unknown, disabled, outside its window, or already
 * redeemed `maxUses` times (cancelled bookings do not consume a redemption).
 */
async function evaluatePromotion(
  client: Db,
  rawCode: string,
  now: Date,
  lock: boolean,
): Promise<AppliedPromotion> {
  const found = await client.promotion.findFirst({
    where: { code: { equals: rawCode, mode: "insensitive" } },
  });
  if (!found) {
    throw new QuoteError("promotion_not_found", `no promotion matches code "${rawCode}"`);
  }

  if (lock) {
    await client.$queryRaw`SELECT "id" FROM "promotions" WHERE "id" = ${found.id} FOR UPDATE`;
  }
  const promo = lock
    ? await client.promotion.findUniqueOrThrow({ where: { id: found.id } })
    : found;

  if (promo.status !== RecordStatus.ACTIVE) {
    throw new QuoteError("promotion_inactive", `promotion "${promo.code}" is not active`);
  }
  if (now < promo.startAt || now > promo.endAt) {
    throw new QuoteError(
      "promotion_expired",
      `promotion "${promo.code}" is not valid on ${now.toISOString().slice(0, 10)}`,
    );
  }
  if (promo.maxUses !== null) {
    const used = await client.booking.count({
      where: { promotionId: promo.id, bookingStatus: { not: BookingStatus.CANCELLED } },
    });
    if (used >= promo.maxUses) {
      throw new QuoteError("promotion_exhausted", `promotion "${promo.code}" is fully redeemed`);
    }
  }

  return { id: promo.id, code: promo.code, type: promo.type, value: money(promo.value) };
}

/** Discount a promotion yields against the room subtotal (never more than it). */
function promotionDiscount(promo: AppliedPromotion, subtotal: Money): Money {
  if (promo.type === PromotionType.PERCENTAGE) {
    const percent = Prisma.Decimal.min(promo.value, new Prisma.Decimal(100));
    return money(subtotal.mul(percent).div(100));
  }
  return money(Prisma.Decimal.min(promo.value, subtotal));
}

type RateRow = {
  id: string;
  startDate: Date;
  endDate: Date;
  amount: Prisma.Decimal;
};

/**
 * Rate of every charged night: the covering ACTIVE rate with the most specific
 * (latest-starting) window wins; nights outside every window fall back to
 * `room_types.base_price`.
 */
function nightlyAmounts(
  rates: RateRow[],
  basePrice: Prisma.Decimal,
  checkIn: Date,
  nights: number,
): Money[] {
  const amounts: Money[] = [];
  for (let index = 0; index < nights; index += 1) {
    const night = addDays(checkIn, index).getTime();
    let chosen: RateRow | null = null;
    for (const rate of rates) {
      if (rate.startDate.getTime() > night || rate.endDate.getTime() < night) continue;
      if (
        !chosen ||
        rate.startDate.getTime() > chosen.startDate.getTime() ||
        (rate.startDate.getTime() === chosen.startDate.getTime() && rate.id > chosen.id)
      ) {
        chosen = rate;
      }
    }
    amounts.push(chosen ? money(chosen.amount) : money(basePrice));
  }
  return amounts;
}

async function loadRatesForTypes(client: Db, typeIds: string[], checkIn: Date, checkOut: Date) {
  if (typeIds.length === 0) return [];
  const firstNight = toUtcDateOnly(checkIn);
  const lastNight = addDays(toUtcDateOnly(checkOut), -1);
  return client.rate.findMany({
    where: {
      roomTypeId: { in: typeIds },
      status: RecordStatus.ACTIVE,
      startDate: { lte: lastNight },
      endDate: { gte: firstNight },
    },
    select: { id: true, roomTypeId: true, startDate: true, endDate: true, amount: true },
    orderBy: [{ startDate: "asc" }, { id: "asc" }],
  });
}

/**
 * The authoritative quote for a concrete room allocation. Validates that the
 * rooms exist, are in an ACTIVE type and together fit the party — the same
 * rules `assertRoomsAvailable` enforces under lock — then prices the stay.
 */
export async function computeQuote(request: QuoteRequest, client: Db = prisma): Promise<ComputedQuote> {
  const stay = normalizeRequest(request);
  const { checkIn, checkOut, adults, children, nights } = stay;
  const now = request.now ?? new Date();

  const roomIds = [...new Set(request.roomIds)];
  if (roomIds.length === 0) {
    throw new AvailabilityConflictError("room_not_found", [], "at least one room is required");
  }
  if (roomIds.length > MAX_ROOMS_PER_BOOKING) {
    throw new QuoteError(
      "too_many_rooms",
      `a reservation may hold at most ${MAX_ROOMS_PER_BOOKING} rooms`,
    );
  }

  const rooms = await client.room.findMany({
    where: { id: { in: roomIds } },
    include: { roomType: true },
    orderBy: { roomNumber: "asc" },
  });
  const foundIds = new Set(rooms.map((room) => room.id));
  const missing = roomIds.filter((id) => !foundIds.has(id));
  if (missing.length > 0) {
    throw new AvailabilityConflictError("room_not_found", missing);
  }

  const inactive = rooms.filter((room) => room.roomType.status !== RecordStatus.ACTIVE);
  if (inactive.length > 0) {
    throw new AvailabilityConflictError(
      "room_type_inactive",
      inactive.map((room) => room.id),
    );
  }

  const combinedCapacity = rooms.reduce(
    (sum, room) => ({
      maxAdults: sum.maxAdults + room.roomType.maxAdults,
      maxChildren: sum.maxChildren + room.roomType.maxChildren,
    }),
    { maxAdults: 0, maxChildren: 0 },
  );
  if (!capacityFits(combinedCapacity, adults, children)) {
    throw new AvailabilityConflictError("capacity_exceeded", roomIds);
  }

  const hotel = await loadHotelContext(client);
  const typeIds = [...new Set(rooms.map((room) => room.roomTypeId))];
  const rates = await loadRatesForTypes(client, typeIds, checkIn, checkOut);
  const ratesByType = new Map<string, RateRow[]>();
  for (const rate of rates) {
    const list = ratesByType.get(rate.roomTypeId) ?? [];
    list.push(rate);
    ratesByType.set(rate.roomTypeId, list);
  }

  const lines: QuoteLine[] = [];
  const roomLines: PricingSnapshot["rooms"] = [];
  let subtotal = money(0);

  for (const room of rooms) {
    const perNight = nightlyAmounts(
      ratesByType.get(room.roomTypeId) ?? [],
      room.roomType.basePrice,
      checkIn,
      nights,
    );
    const roomTotal = money(perNight.reduce((sum, amount) => sum.add(amount), money(0)));
    const nightlyRate = money(roomTotal.div(nights));
    subtotal = money(subtotal.add(roomTotal));

    lines.push({
      roomId: room.id,
      roomNumber: room.roomNumber,
      floor: room.floor,
      roomTypeId: room.roomType.id,
      roomTypeName: room.roomType.name,
      roomTypeSlug: room.roomType.slug,
      perNight: perNight.map(moneyString),
      nightlyRate: moneyString(nightlyRate),
      nights,
      roomTotal: moneyString(roomTotal),
    });
    roomLines.push({ roomId: room.id, nightlyRate, roomTotal });
  }

  let promotion: AppliedPromotion | null = null;
  let discount = money(0);
  const code = request.promotionCode?.trim();
  if (code) {
    promotion = await evaluatePromotion(client, code, now, request.lockPromotion ?? false);
    discount = promotionDiscount(promotion, subtotal);
  }

  const discounted = money(subtotal.sub(discount));
  const taxes = money(discounted.mul(TAX_RATE_PERCENT).div(100));
  const fees = money(SERVICE_FEE);
  const total = money(discounted.add(taxes).add(fees));

  const breakdown: MoneyBreakdown = { subtotal, taxes, fees, discount, total };

  return {
    snapshot: { breakdown, rooms: roomLines, promotion },
    lines,
    promotion,
    currency: hotel.currency,
    hotel,
    checkIn,
    checkOut,
    nights,
    adults,
    children,
  };
}

/** JSON-safe quote for API responses and pages (decimals as `450.00` strings). */
export function toQuoteResult(computed: ComputedQuote): QuoteResult {
  return {
    checkIn: computed.checkIn.toISOString().slice(0, 10),
    checkOut: computed.checkOut.toISOString().slice(0, 10),
    nights: computed.nights,
    adults: computed.adults,
    children: computed.children,
    currency: computed.currency,
    hotel: {
      name: computed.hotel.name,
      timezone: computed.hotel.timezone,
      checkInTime: computed.hotel.checkInTime,
      checkOutTime: computed.hotel.checkOutTime,
    },
    lines: computed.lines,
    promotion: computed.promotion
      ? {
          code: computed.promotion.code,
          type: computed.promotion.type,
          value: moneyString(computed.promotion.value),
          discount: moneyString(computed.snapshot.breakdown.discount),
        }
      : null,
    breakdown: {
      subtotal: moneyString(computed.snapshot.breakdown.subtotal),
      taxes: moneyString(computed.snapshot.breakdown.taxes),
      fees: moneyString(computed.snapshot.breakdown.fees),
      discount: moneyString(computed.snapshot.breakdown.discount),
      total: moneyString(computed.snapshot.breakdown.total),
    },
    policy: { cancellationWindowHours: CANCELLATION_WINDOW_HOURS },
  };
}

/** Convenience wrapper: price a stay against the shared client. */
export async function buildQuote(
  request: QuoteRequest,
  client: Db = prisma,
): Promise<QuoteResult> {
  return toQuoteResult(await computeQuote(request, client));
}

export type RoomTypePrice = {
  perNight: string[];
  nightlyRate: string;
  stayTotal: string;
  currency: string;
};

/**
 * "From" prices for the search results page: the stay total of an arbitrary
 * room of each type, priced by the same rule as a real quote.
 */
export async function computeTypePrices(
  roomTypeIds: string[],
  checkIn: Date,
  checkOut: Date,
  client: Db = prisma,
): Promise<Map<string, RoomTypePrice>> {
  const prices = new Map<string, RoomTypePrice>();
  const from = toUtcDateOnly(checkIn);
  const to = toUtcDateOnly(checkOut);
  const nights = nightsCount(from, to);
  if (roomTypeIds.length === 0 || nights < 1) return prices;

  const types = await client.roomType.findMany({
    where: { id: { in: roomTypeIds }, status: RecordStatus.ACTIVE },
    select: { id: true, basePrice: true },
  });
  const rates = await loadRatesForTypes(client, roomTypeIds, from, to);
  const ratesByType = new Map<string, RateRow[]>();
  for (const rate of rates) {
    const list = ratesByType.get(rate.roomTypeId) ?? [];
    list.push(rate);
    ratesByType.set(rate.roomTypeId, list);
  }
  const hotel = await loadHotelContext(client);

  for (const type of types) {
    const perNight = nightlyAmounts(
      ratesByType.get(type.id) ?? [],
      type.basePrice,
      from,
      nights,
    );
    const stayTotal = money(perNight.reduce((sum, amount) => sum.add(amount), money(0)));
    prices.set(type.id, {
      perNight: perNight.map(moneyString),
      nightlyRate: moneyString(money(stayTotal.div(nights))),
      stayTotal: moneyString(stayTotal),
      currency: hotel.currency,
    });
  }
  return prices;
}
