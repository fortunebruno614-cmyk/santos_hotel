import { prisma } from "@/lib/prisma";
import { BookingStatus, PromotionType, RecordStatus } from "@/generated/prisma/client";
import { GUEST_ACCOUNTS_ENABLED } from "@/config/auth";
import { auditSignup } from "@/server/audit/write";
import { createGuestAccount } from "@/server/auth/service";
import { signSession } from "@/server/auth/session";
import { SignupSchema, normalizeEmail } from "@/server/auth/validation";
import {
  AvailabilityConflictError,
  findAvailability,
  StayValidationError,
} from "@/server/availability/service";
import { nightsCount, parseDateOnly } from "@/server/availability/overlap";
import {
  BookingError,
  createBooking,
  guestSelfCheckOut,
  getBookingDetailByReference,
  transitionBooking,
  type BookingActor,
} from "@/server/booking/service";
import { TransitionError } from "@/server/booking/policy";
import { BOOKING_REFERENCE_REGEX } from "@/server/booking/reference";
import {
  QuoteError,
  buildQuote,
  computeTypePrices,
  inspectPromotion,
} from "@/server/pricing/service";
import { hotelToday, type HotelContext } from "@/server/pricing/context";
import { loadPublicRoomTypes } from "@/server/public/catalog";
import type { PublicRoomType } from "@/lib/hotel";
import type { ToolDefinition } from "@/server/ai/groq";

/**
 * The concierge's hands: every capability the chat exposes to the model is a
 * tool defined and executed here, against the *same* services the public API
 * and the staff console use — availability, pricing, booking, auth. The model
 * never touches the database directly and never invents a number: if a tool
 * cannot answer, the model is told so and must say "I don't know".
 *
 * Two kinds of output leave an executor:
 *   - `data`    JSON shown to the model, which turns it into prose;
 *   - `detail`  a one-line human label the widget shows as activity
 *               ("12 rooms free", "Reserved · SH-2026-000123");
 * and, for sign-up only, an `effect` — something that must be applied to the
 * HTTP response *outside* the stream (a session cookie cannot be set once
 * streaming has started), carried to the client as an out-of-band event.
 */

// ---------------------------------------------------------------------------
// Context & result shapes
// ---------------------------------------------------------------------------

export type ChatPrincipal =
  | { kind: "guest"; guestId: string; firstName: string; email: string | null }
  | { kind: "staff"; userId: string; email: string | null; organizationId: string }
  | { kind: "anonymous" };

export type ChatEffect = { type: "set_session"; token: string };

export type ConciergeContext = {
  hotel: HotelContext;
  principal: ChatPrincipal;
  /** Signed booking claim (anonymous guest who just booked) — proves ownership. */
  claim: { reference: string; guestId: string } | null;
  /** Guest's chosen display currency (from the cookie); amounts stay in hotel currency. */
  displayCurrency: string;
};

export type ToolOutcome = {
  data: Record<string, unknown>;
  detail?: string;
  effects?: ChatEffect[];
};

/** Bad arguments from the model — reported back so it can correct itself. */
export class ToolInputError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ToolInputError";
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function money(amount: string | number | null | undefined, currency: string): string {
  const value = typeof amount === "string" ? Number(amount) : amount;
  if (value == null || !Number.isFinite(value)) return `${currency} 0`;
  const hasCents = Math.round(value * 100) % 100 !== 0;
  return `${currency} ${value.toLocaleString("en-US", {
    minimumFractionDigits: hasCents ? 2 : 0,
    maximumFractionDigits: 2,
  })}`;
}

function requireDate(value: unknown, label: string): string {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value) || !parseDateOnly(value)) {
    throw new ToolInputError(`${label} must be a valid date in YYYY-MM-DD format`);
  }
  return value;
}

function occupancy(args: Record<string, unknown>): { adults: number; children: number } {
  const adults = Math.min(20, Math.max(1, Number(args.adults ?? 2) || 2));
  const children = Math.min(20, Math.max(0, Number(args.children ?? 0) || 0));
  return { adults, children };
}

function asString(value: unknown, label: string, max = 120): string {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new ToolInputError(`${label} is required`);
  }
  const trimmed = value.trim();
  if (trimmed.length > max) throw new ToolInputError(`${label} is too long`);
  return trimmed;
}

function optionalString(value: unknown, label: string, max = 500): string | null {
  if (value == null || value === "") return null;
  if (typeof value !== "string") throw new ToolInputError(`${label} must be text`);
  const trimmed = value.trim();
  if (trimmed.length > max) throw new ToolInputError(`${label} is too long`);
  return trimmed || null;
}

function roomTypeUrl(slug: string): string {
  return `/rooms/${slug}`;
}

// ---------------------------------------------------------------------------
// Tool definitions (what the model sees)
// ---------------------------------------------------------------------------

const dateProperty = (description: string) => ({
  type: "string",
  description: `${description} (YYYY-MM-DD)`,
});

export const CONCIERGE_TOOLS: ToolDefinition[] = [
  {
    type: "function",
    function: {
      name: "suggest_rooms",
      description:
        "Recommend room types for a guest. With dates it checks live availability and returns the real price for those nights; without dates it returns the standard rate card. Use for 'what rooms do you have', 'suggest a room for 2', 'any suites free'.",
      parameters: {
        type: "object",
        properties: {
          checkIn: dateProperty("Arrival date — include when the guest has dates"),
          checkOut: dateProperty("Departure date — include when the guest has dates"),
          adults: { type: "integer", description: "Adults, 1-20 (default 2)" },
          children: { type: "integer", description: "Children, 0-20 (default 0)" },
          suiteOnly: { type: "boolean", description: "Only suites" },
          maxPricePerNight: {
            type: "number",
            description: "Budget ceiling per night in the hotel currency",
          },
          keywords: {
            type: "array",
            items: { type: "string" },
            description: "Amenities the room must match, e.g. ['wifi','pool','balcony']",
          },
        },
      },
    },
  },
  {
    type: "function",
    function: {
      name: "check_availability",
      description:
        "Exact availability for a date range: which room types have rooms free, how many, and the price for the stay. Requires both dates.",
      parameters: {
        type: "object",
        properties: {
          checkIn: dateProperty("Arrival date"),
          checkOut: dateProperty("Departure date"),
          adults: { type: "integer", description: "Adults, 1-20 (default 2)" },
          children: { type: "integer", description: "Children, 0-20 (default 0)" },
        },
        required: ["checkIn", "checkOut"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "check_discount",
      description:
        "Discounts and promo codes. With a promotionCode it verifies the code and estimates the saving for given dates; with no code it lists every discount currently running.",
      parameters: {
        type: "object",
        properties: {
          promotionCode: { type: "string", description: "The code to verify, e.g. SAVE10" },
          checkIn: dateProperty("Arrival date — improves the saving estimate"),
          checkOut: dateProperty("Departure date — improves the saving estimate"),
          roomTypeSlug: {
            type: "string",
            description: "Room to price the estimate against; defaults to the cheapest",
          },
        },
      },
    },
  },
  {
    type: "function",
    function: {
      name: "best_selling_rooms",
      description:
        "Best-selling rooms: the room types with the most confirmed reservations, nights sold and revenue. Use for 'what is your most popular room', 'best selling', 'what do most guests book'.",
      parameters: {
        type: "object",
        properties: {
          limit: { type: "integer", description: "How many to return, 1-10 (default 3)" },
          days: {
            type: "integer",
            description: "Look-back window in days; omit for all time",
          },
        },
      },
    },
  },
  {
    type: "function",
    function: {
      name: "create_reservation",
      description:
        "Create a real reservation: locks the rooms, prices the stay server-side and returns a booking reference plus a payment link. ONLY call this after the guest has explicitly confirmed every detail (dates, guests, room, name, email). Never call it to 'check' a price — use check_availability first.",
      parameters: {
        type: "object",
        properties: {
          checkIn: dateProperty("Arrival date"),
          checkOut: dateProperty("Departure date"),
          adults: { type: "integer", description: "Adults, 1-20 (default 2)" },
          children: { type: "integer", description: "Children, 0-20 (default 0)" },
          quantity: { type: "integer", description: "Number of rooms (default 1)" },
          roomTypeSlug: {
            type: "string",
            description: "Preferred room type; omit to take the cheapest suitable one",
          },
          promotionCode: { type: "string", description: "Promo code the guest wants applied" },
          notes: { type: "string", description: "Special requests for the hotel" },
          guest: {
            type: "object",
            description: "Lead guest details",
            properties: {
              firstName: { type: "string" },
              lastName: { type: "string" },
              email: { type: "string", description: "Required — the reservation is emailed here" },
              phone: { type: "string" },
            },
            required: ["firstName", "lastName", "email"],
          },
        },
        required: ["checkIn", "checkOut", "guest"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "signup_user",
      description:
        "Create a guest account and sign them in (first name, last name, email, password). Use when the guest asks to sign up or register. If they already have an account, tell them to log in instead.",
      parameters: {
        type: "object",
        properties: {
          firstName: { type: "string" },
          lastName: { type: "string" },
          email: { type: "string" },
          password: {
            type: "string",
            description: "At least 8 characters with a letter and a digit",
          },
        },
        required: ["firstName", "lastName", "email", "password"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "lookup_booking",
      description:
        "Look up a reservation by its reference (SH-YYYY-NNNNNN) — status, dates, rooms, amounts due and cancellation eligibility. Only the signed-in guest's own booking, or any booking for staff.",
      parameters: {
        type: "object",
        properties: {
          bookingReference: { type: "string", description: "e.g. SH-2026-000123" },
        },
        required: ["bookingReference"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "check_out_stay",
      description:
        "Check a guest out of their stay: verifies the booking, settles the check-out and releases the room. The guest must be checked in (staff can check out any in-house stay). Without a reference it finds the guest's current stay. Returns the final folio.",
      parameters: {
        type: "object",
        properties: {
          bookingReference: { type: "string", description: "e.g. SH-2026-000123" },
          note: { type: "string", description: "Optional note to attach to the stay" },
        },
      },
    },
  },
];

// ---------------------------------------------------------------------------
// Executors
// ---------------------------------------------------------------------------

async function handleSuggestRooms(
  ctx: ConciergeContext,
  args: Record<string, unknown>,
): Promise<ToolOutcome> {
  const { adults, children } = occupancy(args);
  const suiteOnly = args.suiteOnly === true;
  const maxPrice =
    typeof args.maxPricePerNight === "number" && Number.isFinite(args.maxPricePerNight)
      ? args.maxPricePerNight
      : null;
  const keywords = Array.isArray(args.keywords)
    ? args.keywords.filter((k): k is string => typeof k === "string").map((k) => k.toLowerCase())
    : [];

  let catalog = await loadPublicRoomTypes(ctx.hotel.id);
  if (suiteOnly) catalog = catalog.filter((room) => room.isSuite);
  if (maxPrice != null) {
    catalog = catalog.filter((room) => Number(room.basePrice) <= maxPrice);
  }
  if (keywords.length > 0) {
    catalog = catalog.filter((room) => {
      const haystack = `${room.name} ${room.description} ${room.amenities.join(" ")}`.toLowerCase();
      return keywords.every((word) => haystack.includes(word));
    });
  }
  if (catalog.length === 0) {
    return {
      data: {
        ok: true,
        stay: null,
        currency: ctx.hotel.currency,
        suggestions: [],
        note: "No room type matches those filters — suggest loosening the budget or the amenities.",
      },
      detail: "No rooms match those filters",
    };
  }

  const hasDates = Boolean(args.checkIn || args.checkOut);
  if (hasDates) {
    const checkIn = requireDate(args.checkIn, "checkIn");
    const checkOut = requireDate(args.checkOut, "checkOut");
    const from = parseDateOnly(checkIn)!;
    const to = parseDateOnly(checkOut)!;
    if (to.getTime() <= from.getTime()) {
      throw new ToolInputError("checkOut must be after checkIn");
    }
    const availability = await findAvailability({
      hotelId: ctx.hotel.id,
      checkIn: from,
      checkOut: to,
      adults,
      children,
    });
    const prices = await computeTypePrices(
      ctx.hotel.id,
      availability.roomTypes.map((type) => type.id),
      from,
      to,
    );

    const suggestions = availability.roomTypes
      .filter((type) => type.availableCount > 0 && catalog.some((room) => room.id === type.id))
      .map((type) => {
        const catalogRow = catalog.find((room) => room.id === type.id);
        const price = prices.get(type.id);
        return {
          value: price ? Number(price.stayTotal) : Number.POSITIVE_INFINITY,
          row: {
            name: type.name,
            slug: type.slug,
            url: roomTypeUrl(type.slug),
            sleeps: `${type.maxAdults} adult${type.maxAdults === 1 ? "" : "s"}`,
            available: type.availableCount,
            perNight: price ? money(price.nightlyRate, price.currency) : null,
            stayTotal: price ? money(price.stayTotal, price.currency) : null,
            amenities: (catalogRow?.amenities ?? []).slice(0, 6),
            image: catalogRow?.images[0] ?? null,
          },
        };
      })
      .sort((a, b) => a.value - b.value)
      .map((item) => item.row);

    return {
      data: {
        ok: true,
        stay: {
          checkIn,
          checkOut,
          nights: nightsCount(from, to),
          adults,
          children,
        },
        currency: ctx.hotel.currency,
        suggestions,
        note:
          suggestions.length > 0
            ? "Prices are live for these dates and include the room only."
            : "No room type is free for those dates with that occupancy.",
      },
      detail:
        suggestions.length > 0
          ? `${suggestions.length} room type${suggestions.length === 1 ? "" : "s"} free`
          : "No rooms free for those dates",
    };
  }

  const suggestions = catalog.map((room: PublicRoomType) => ({
    name: room.name,
    slug: room.slug,
    url: roomTypeUrl(room.slug),
    sleeps: `${room.maxAdults} adult${room.maxAdults === 1 ? "" : "s"}`,
    perNight: money(room.basePrice, ctx.hotel.currency),
    amenities: room.amenities.slice(0, 6),
    image: room.images[0] ?? null,
    available: room.totalRooms,
  }));

  return {
    data: {
      ok: true,
      stay: null,
      currency: ctx.hotel.currency,
      suggestions,
      note: "No dates given — these are standard nightly rates from the rate card.",
    },
    detail: `${suggestions.length} room type${suggestions.length === 1 ? "" : "s"} on offer`,
  };
}

async function handleCheckAvailability(
  ctx: ConciergeContext,
  args: Record<string, unknown>,
): Promise<ToolOutcome> {
  const checkIn = requireDate(args.checkIn, "checkIn");
  const checkOut = requireDate(args.checkOut, "checkOut");
  const { adults, children } = occupancy(args);
  const from = parseDateOnly(checkIn)!;
  const to = parseDateOnly(checkOut)!;
  if (to.getTime() <= from.getTime()) throw new ToolInputError("checkOut must be after checkIn");

  const availability = await findAvailability({
    hotelId: ctx.hotel.id,
    checkIn: from,
    checkOut: to,
    adults,
    children,
  });
  const prices = await computeTypePrices(
    ctx.hotel.id,
    availability.roomTypes.map((type) => type.id),
    from,
    to,
  );

  const types = availability.roomTypes.map((type) => {
    const price = prices.get(type.id);
    return {
      name: type.name,
      slug: type.slug,
      url: roomTypeUrl(type.slug),
      available: type.availableCount,
      total: type.totalRooms,
      sleeps: `${type.maxAdults} adult${type.maxAdults === 1 ? "" : "s"}`,
      perNight: price ? money(price.nightlyRate, price.currency) : null,
      stayTotal: price ? money(price.stayTotal, price.currency) : null,
    };
  });

  return {
    data: {
      ok: true,
      checkIn,
      checkOut,
      nights: nightsCount(from, to),
      adults,
      children,
      currency: ctx.hotel.currency,
      availableRoomCount: availability.availableRoomCount,
      hasAvailability: availability.hasAvailability,
      roomTypes: types,
    },
    detail: availability.hasAvailability
      ? `${availability.availableRoomCount} room${availability.availableRoomCount === 1 ? "" : "s"} free`
      : "No rooms free",
  };
}

async function handleCheckDiscount(
  ctx: ConciergeContext,
  args: Record<string, unknown>,
): Promise<ToolOutcome> {
  const now = new Date();

  // No code → everything currently running.
  if (typeof args.promotionCode !== "string" || args.promotionCode.trim() === "") {
    const active = await prisma.promotion.findMany({
      where: {
        hotelId: ctx.hotel.id,
        status: RecordStatus.ACTIVE,
        startAt: { lte: now },
        endAt: { gte: now },
      },
      orderBy: { endAt: "asc" },
      take: 10,
    });
    const redemptions = active.length
      ? await prisma.booking.groupBy({
          by: ["promotionId"],
          where: {
            promotionId: { in: active.map((row) => row.id) },
            bookingStatus: { not: BookingStatus.CANCELLED },
          },
          _count: { _all: true },
        })
      : [];
    const usedById = new Map(redemptions.map((row) => [row.promotionId, row._count._all]));

    const discounts = active.map((row) => ({
      code: row.code,
      type:
        row.type === PromotionType.PERCENTAGE
          ? `${Number(row.value)}% off`
          : `${money(Number(row.value), ctx.hotel.currency)} off`,
      endsAt: row.endAt.toISOString().slice(0, 10),
      remainingUses: row.maxUses === null ? null : Math.max(0, row.maxUses - (usedById.get(row.id) ?? 0)),
    }));

    return {
      data: {
        ok: true,
        currency: ctx.hotel.currency,
        discounts,
        note: discounts.length
          ? "Codes apply to the room subtotal before taxes and fees."
          : "No discounts are running right now.",
      },
      detail: discounts.length ? `${discounts.length} discount${discounts.length === 1 ? "" : "s"} running` : "No discounts running",
    };
  }

  const code = asString(args.promotionCode, "promotionCode", 40);
  const inspection = await inspectPromotion(ctx.hotel.id, code, now);
  if (!inspection.valid) {
    return {
      data: {
        ok: false,
        code,
        reason: inspection.reason,
        message: inspection.message,
      },
      detail: `Code ${code} not valid`,
    };
  }

  const discount = {
    code: inspection.code,
    type: inspection.type === PromotionType.PERCENTAGE ? "percentage" : "fixed",
    value: inspection.value,
  };

  // Estimate the saving against real nightly rates when dates are available.
  let estimate: Record<string, unknown> | null = null;
  if (args.checkIn && args.checkOut) {
    const checkIn = requireDate(args.checkIn, "checkIn");
    const checkOut = requireDate(args.checkOut, "checkOut");
    const from = parseDateOnly(checkIn)!;
    const to = parseDateOnly(checkOut)!;
    if (to.getTime() <= from.getTime()) throw new ToolInputError("checkOut must be after checkIn");

    const availability = await findAvailability({
      hotelId: ctx.hotel.id,
      checkIn: from,
      checkOut: to,
      adults: occupancy(args).adults,
      children: occupancy(args).children,
    });
    const preferred =
      typeof args.roomTypeSlug === "string"
        ? availability.roomTypes.find((type) => type.slug === args.roomTypeSlug)
        : undefined;
    const type =
      preferred ??
      [...availability.roomTypes]
        .filter((row) => row.availableCount > 0)
        .sort((a, b) => Number(a.basePrice) - Number(b.basePrice))[0];

    if (type) {
      const prices = await computeTypePrices(ctx.hotel.id, [type.id], from, to);
      const price = prices.get(type.id);
      if (price) {
        const subtotal = Number(price.stayTotal);
        const rawDiscount =
          inspection.type === PromotionType.PERCENTAGE
            ? (subtotal * Math.min(100, Number(inspection.value))) / 100
            : Math.min(subtotal, Number(inspection.value));
        const discounted = Math.max(0, subtotal - rawDiscount);
        const taxes = (discounted * ctx.hotel.taxRatePercent) / 100;
        estimate = {
          roomType: type.name,
          checkIn,
          checkOut,
          nights: nightsCount(from, to),
          subtotal: money(subtotal, ctx.hotel.currency),
          discount: money(rawDiscount, ctx.hotel.currency),
          taxesAndFees: money(taxes + ctx.hotel.serviceFee, ctx.hotel.currency),
          total: money(discounted + taxes + ctx.hotel.serviceFee, ctx.hotel.currency),
          available: type.availableCount,
        };
      }
    }
  }

  return {
    data: { ok: true, currency: ctx.hotel.currency, discount, estimate },
    detail: `Code ${inspection.code} valid — ${discount.type === "percentage" ? `${inspection.value}% off` : `${money(inspection.value, ctx.hotel.currency)} off`}`,
  };
}

async function handleBestSelling(
  ctx: ConciergeContext,
  args: Record<string, unknown>,
): Promise<ToolOutcome> {
  const limit = Math.min(10, Math.max(1, Number(args.limit ?? 3) || 3));
  const days = args.days != null ? Math.min(365, Math.max(1, Number(args.days) || 0)) : null;
  const since = days ? new Date(Date.now() - days * 86_400_000) : null;

  const grouped = await prisma.bookingRoom.groupBy({
    by: ["roomId"],
    where: {
      booking: {
        bookingStatus: {
          in: [BookingStatus.CONFIRMED, BookingStatus.CHECKED_IN, BookingStatus.CHECKED_OUT],
        },
        ...(since ? { createdAt: { gte: since } } : {}),
      },
    },
    _count: { _all: true },
    _sum: { nights: true, roomTotal: true },
  });
  if (grouped.length === 0) {
    return {
      data: {
        ok: true,
        window: days ? `last ${days} days` : "all time",
        ranking: [],
        note: "No completed reservations yet — nothing to rank.",
      },
      detail: "No booking history yet",
    };
  }

  const rooms = await prisma.room.findMany({
    where: { id: { in: grouped.map((row) => row.roomId) } },
    select: {
      id: true,
      roomType: { select: { name: true, slug: true } },
    },
  });
  const roomById = new Map(rooms.map((room) => [room.id, room]));

  const byType = new Map<
    string,
    { name: string; slug: string; reservations: number; nights: number; revenue: number }
  >();
  for (const row of grouped) {
    const room = roomById.get(row.roomId);
    if (!room) continue;
    const bucket =
      byType.get(room.roomType.slug) ??
      { name: room.roomType.name, slug: room.roomType.slug, reservations: 0, nights: 0, revenue: 0 };
    bucket.reservations += row._count._all;
    bucket.nights += row._sum.nights ?? 0;
    bucket.revenue += Number(row._sum.roomTotal ?? 0);
    byType.set(room.roomType.slug, bucket);
  }

  const ranking = [...byType.values()]
    .sort((a, b) => b.nights - a.nights || b.reservations - a.reservations)
    .slice(0, limit)
    .map((row, index) => ({
      rank: index + 1,
      roomType: row.name,
      url: roomTypeUrl(row.slug),
      reservations: row.reservations,
      nightsSold: row.nights,
      revenue: money(row.revenue, ctx.hotel.currency),
    }));

  return {
    data: {
      ok: true,
      window: days ? `last ${days} days` : "all time",
      currency: ctx.hotel.currency,
      ranking,
      note: "Ranked by nights sold across confirmed, in-house and completed stays.",
    },
    detail: `Top: ${ranking[0]?.roomType ?? "—"}`,
  };
}

async function handleCreateReservation(
  ctx: ConciergeContext,
  args: Record<string, unknown>,
): Promise<ToolOutcome> {
  const checkIn = requireDate(args.checkIn, "checkIn");
  const checkOut = requireDate(args.checkOut, "checkOut");
  const { adults, children } = occupancy(args);
  const from = parseDateOnly(checkIn)!;
  const to = parseDateOnly(checkOut)!;
  if (to.getTime() <= from.getTime()) throw new ToolInputError("checkOut must be after checkIn");

  const guestRaw = (args.guest ?? {}) as Record<string, unknown>;
  const guest = {
    firstName: asString(guestRaw.firstName, "guest.firstName", 80),
    lastName: asString(guestRaw.lastName, "guest.lastName", 80),
    email: normalizeEmail(asString(guestRaw.email, "guest.email", 254)),
    phone: optionalString(guestRaw.phone, "guest.phone", 40) ?? undefined,
  };
  const quantity = Math.min(
    ctx.hotel.maxRoomsPerBooking,
    Math.max(1, Number(args.quantity ?? 1) || 1),
  );
  const promotionCode = optionalString(args.promotionCode, "promotionCode", 40);
  const notes = optionalString(args.notes, "notes", 500);

  // 1) What is actually free right now.
  const availability = await findAvailability({
    hotelId: ctx.hotel.id,
    checkIn: from,
    checkOut: to,
    adults,
    children,
  });
  if (!availability.hasAvailability) {
    return {
      data: {
        ok: false,
        reason: "no_availability",
        message: `Nothing is free from ${checkIn} to ${checkOut} for ${adults} guest${adults === 1 ? "" : "s"}. Offer other dates.`,
      },
      detail: "Nothing free for those dates",
    };
  }

  const requested =
    typeof args.roomTypeSlug === "string" && args.roomTypeSlug
      ? availability.roomTypes.find((type) => type.slug === args.roomTypeSlug)
      : undefined;
  if (typeof args.roomTypeSlug === "string" && args.roomTypeSlug && !requested) {
    throw new ToolInputError(`no room type matches "${args.roomTypeSlug}"`);
  }
  const chosen =
    requested ??
    [...availability.roomTypes]
      .filter((type) => type.availableCount >= quantity)
      .sort((a, b) => Number(a.basePrice) - Number(b.basePrice))[0];

  if (!chosen || chosen.availableCount < quantity) {
    return {
      data: {
        ok: false,
        reason: "not_enough_rooms",
        message: `Only ${chosen?.availableCount ?? 0} room(s) of ${chosen?.name ?? "that type"} are free — reduce the number of rooms or offer another type.`,
      },
      detail: "Not enough rooms of that type",
    };
  }

  const roomIds = chosen.availableRooms.slice(0, quantity).map((room) => room.id);

  // 2) Price it server-side, then let createBooking re-price inside its own
  //    transaction — `expectedTotal` makes any drift abort instead of charge.
  const quote = await buildQuote({
    hotelId: ctx.hotel.id,
    checkIn: from,
    checkOut: to,
    adults,
    children,
    roomIds,
    promotionCode,
  });

  const actor: BookingActor =
    ctx.principal.kind === "guest"
      ? { kind: "guest", guestId: ctx.principal.guestId }
      : ctx.principal.kind === "staff"
        ? {
            kind: "staff",
            userId: ctx.principal.userId,
            email: ctx.principal.email,
            organizationId: ctx.principal.organizationId,
          }
        : { kind: "anonymous" };

  const booking = await createBooking(
    {
      hotelId: ctx.hotel.id,
      checkIn,
      checkOut,
      adults,
      children,
      roomIds,
      guest,
      promotionCode,
      notes,
      expectedTotal: quote.breakdown.total,
    },
    actor,
  );

  return {
    data: {
      ok: true,
      reference: booking.bookingReference,
      status: booking.bookingStatus,
      paymentStatus: booking.paymentStatus,
      roomType: chosen.name,
      rooms: booking.rooms.length,
      checkIn,
      checkOut,
      nights: booking.nights,
      currency: booking.currency,
      total: money(booking.breakdown.total, booking.currency),
      discount: Number(booking.breakdown.discount) > 0 ? money(booking.breakdown.discount, booking.currency) : null,
      paymentUrl: `/pay/${booking.bookingReference}`,
      confirmationUrl: `/booking/confirmation?reference=${booking.bookingReference}`,
    },
    detail: `Reserved · ${booking.bookingReference}`,
  };
}

async function handleSignup(
  ctx: ConciergeContext,
  args: Record<string, unknown>,
): Promise<ToolOutcome> {
  if (ctx.principal.kind !== "anonymous") {
    return {
      data: {
        ok: false,
        reason: "already_signed_in",
        message: "They already have a session — no sign-up needed.",
      },
      detail: "Already signed in",
    };
  }
  if (!GUEST_ACCOUNTS_ENABLED) {
    return {
      data: { ok: false, reason: "disabled", message: "Guest accounts are turned off for this hotel." },
      detail: "Sign-up disabled",
    };
  }

  const parsed = SignupSchema.safeParse({
    firstName: asString(args.firstName, "firstName", 80),
    lastName: asString(args.lastName, "lastName", 80),
    email: normalizeEmail(asString(args.email, "email", 254)),
    password: asString(args.password, "password", 200),
  });
  if (!parsed.success) {
    const issues = parsed.error.flatten().fieldErrors;
    const first = Object.values(issues).flat()[0];
    return {
      data: { ok: false, reason: "invalid", message: first ?? "Those details are not valid." },
      detail: "Details not accepted",
    };
  }

  const result = await createGuestAccount(parsed.data);
  if (!result) {
    return {
      data: {
        ok: false,
        reason: "email_taken",
        message: "An account already exists for that email — offer the login page instead.",
      },
      detail: "Email already registered",
    };
  }

  await auditSignup({ guestId: result.guest.id }, result.guest.email);

  // The cookie cannot be set once the SSE stream has started, so the session
  // travels as a short-lived signed token the client redeems on a plain
  // request (POST /api/auth/session) — same JWT, same secret, one handshake.
  const token = await signSession(result.payload, "15m");

  return {
    data: {
      ok: true,
      signedIn: true,
      email: result.guest.email,
      firstName: result.guest.firstName,
      message: "Account created and signed in.",
    },
    detail: `Signed up · ${result.guest.email}`,
    effects: [{ type: "set_session", token }],
  };
}

/** Whom a lookup/check-out is allowed to see: session first, claim second. */
function viewerFor(
  ctx: ConciergeContext,
  reference: string,
): { kind: "guest"; guestId: string } | { kind: "staff" } | null {
  if (ctx.principal.kind === "guest") return { kind: "guest", guestId: ctx.principal.guestId };
  if (ctx.principal.kind === "staff") return { kind: "staff" };
  if (ctx.claim && ctx.claim.reference === reference) {
    return { kind: "guest", guestId: ctx.claim.guestId };
  }
  return null;
}

function referenceFrom(args: Record<string, unknown>): string | null {
  const raw = typeof args.bookingReference === "string" ? args.bookingReference.trim().toUpperCase() : "";
  if (!raw) return null;
  if (!BOOKING_REFERENCE_REGEX.test(raw)) {
    throw new ToolInputError("bookingReference must look like SH-2026-000123");
  }
  return raw;
}

async function handleLookupBooking(
  ctx: ConciergeContext,
  args: Record<string, unknown>,
): Promise<ToolOutcome> {
  const reference = referenceFrom(args);
  if (!reference) {
    if (ctx.principal.kind === "staff") {
      throw new ToolInputError("bookingReference is required");
    }
    return {
      data: {
        ok: false,
        reason: "reference_required",
        message: "Ask for the reservation reference (SH-YYYY-NNNNNN) — or have them sign in.",
      },
      detail: "Reference needed",
    };
  }

  const viewer = viewerFor(ctx, reference);
  if (!viewer) {
    return {
      data: {
        ok: false,
        reason: "not_authorized",
        message:
          "That reservation can only be shown to the signed-in guest who owns it (or to staff). Offer login.",
      },
      detail: "Sign in to view that reservation",
    };
  }

  try {
    const detail = await getBookingDetailByReference(reference, viewer);
    return {
      data: {
        ok: true,
        reference: detail.bookingReference,
        status: detail.bookingStatus,
        paymentStatus: detail.paymentStatus,
        checkIn: detail.checkIn,
        checkOut: detail.checkOut,
        nights: detail.nights,
        adults: detail.adults,
        children: detail.children,
        guest: `${detail.guest.firstName} ${detail.guest.lastName}`,
        currency: detail.currency,
        total: money(detail.breakdown.total, detail.currency),
        paid: detail.payments
          .filter((payment) => payment.status === "PAID")
          .reduce((sum, payment) => sum + Number(payment.amount), 0),
        rooms: detail.rooms.map((room) => ({
          roomNumber: room.roomNumber,
          type: room.roomTypeName,
          nights: room.nights,
          total: money(room.roomTotal, detail.currency),
        })),
        cancellation: detail.cancellation,
        paymentUrl: `/pay/${detail.bookingReference}`,
      },
      detail: `${detail.bookingReference} · ${detail.bookingStatus}`,
    };
  } catch (error) {
    if (error instanceof BookingError && error.code === "booking_not_found") {
      return {
        data: { ok: false, reason: "not_found", message: `No reservation matches ${reference}.` },
        detail: "Reservation not found",
      };
    }
    throw error;
  }
}

async function handleCheckOutStay(
  ctx: ConciergeContext,
  args: Record<string, unknown>,
): Promise<ToolOutcome> {
  const note = optionalString(args.note, "note", 500);
  const reference = referenceFrom(args);
  const now = new Date();
  const today = hotelToday(now, ctx.hotel.timezone);

  // Resolve the booking: explicit reference, or the guest's current stay.
  let bookingRow: {
    id: string;
    bookingReference: string;
    guestId: string;
    bookingStatus: BookingStatus;
    checkIn: Date;
    checkOut: Date;
  } | null = null;

  if (reference) {
    bookingRow = await prisma.booking.findUnique({
      where: { bookingReference: reference },
      select: {
        id: true,
        bookingReference: true,
        guestId: true,
        bookingStatus: true,
        checkIn: true,
        checkOut: true,
      },
    });
    if (!bookingRow) {
      return {
        data: { ok: false, reason: "not_found", message: `No reservation matches ${reference}.` },
        detail: "Reservation not found",
      };
    }
    const viewer = viewerFor(ctx, bookingRow.bookingReference);
    if (!viewer || (viewer.kind === "guest" && viewer.guestId !== bookingRow.guestId)) {
      return {
        data: {
          ok: false,
          reason: "not_authorized",
          message: "Only the guest who owns that reservation (or staff) can check it out.",
        },
        detail: "Not your reservation",
      };
    }
  } else {
    if (ctx.principal.kind !== "guest") {
      return {
        data: {
          ok: false,
          reason: "reference_required",
          message: "Ask for the reservation reference (SH-YYYY-NNNNNN) to check a stay out.",
        },
        detail: "Reference needed",
      };
    }
    bookingRow = await prisma.booking.findFirst({
      where: {
        guestId: ctx.principal.guestId,
        bookingStatus: { in: [BookingStatus.CONFIRMED, BookingStatus.CHECKED_IN] },
        checkOut: { gte: today },
      },
      orderBy: { checkIn: "desc" },
      select: {
        id: true,
        bookingReference: true,
        guestId: true,
        bookingStatus: true,
        checkIn: true,
        checkOut: true,
      },
    });
    if (!bookingRow) {
      return {
        data: {
          ok: false,
          reason: "no_active_stay",
          message: "There is no in-house or upcoming stay to check out right now.",
        },
        detail: "No active stay",
      };
    }
  }

  // Not in house yet → explain instead of failing loudly.
  if (bookingRow.bookingStatus !== BookingStatus.CHECKED_IN) {
    const arrives = bookingRow.checkIn.toISOString().slice(0, 10);
    return {
      data: {
        ok: false,
        reason: bookingRow.bookingStatus === BookingStatus.CONFIRMED ? "not_checked_in" : `status_${bookingRow.bookingStatus}`,
        reference: bookingRow.bookingReference,
        status: bookingRow.bookingStatus,
        message:
          bookingRow.bookingStatus === BookingStatus.CONFIRMED
            ? `This stay is confirmed but has not started — check-in opens on ${arrives}.`
            : `This reservation is ${bookingRow.bookingStatus} and cannot be checked out.`,
        checkIn: arrives,
      },
      detail: `${bookingRow.bookingReference} · ${bookingRow.bookingStatus}`,
    };
  }

  // Settle the check-out through the same services the console uses.
  if (ctx.principal.kind === "staff") {
    const summary = await transitionBooking(
      { bookingId: bookingRow.id, to: BookingStatus.CHECKED_OUT, note },
      {
        kind: "staff",
        userId: ctx.principal.userId,
        email: ctx.principal.email,
        organizationId: ctx.principal.organizationId,
      },
    );
    return {
      data: { ok: true, ...folio(summary) },
      detail: `Checked out · ${summary.bookingReference}`,
    };
  }

  const guestId =
    ctx.principal.kind === "guest"
      ? ctx.principal.guestId
      : ctx.claim?.reference === bookingRow.bookingReference
        ? ctx.claim.guestId
        : null;
  if (!guestId) {
    return {
      data: {
        ok: false,
        reason: "not_authorized",
        message: "Sign in as the guest who owns this reservation to check out.",
      },
      detail: "Sign in to check out",
    };
  }

  const summary = await guestSelfCheckOut({ bookingId: bookingRow.id, guestId, note });
  return {
    data: { ok: true, ...folio(summary) },
    detail: `Checked out · ${summary.bookingReference}`,
  };
}

type SummaryLike = Awaited<ReturnType<typeof createBooking>>;

function folio(summary: SummaryLike) {
  return {
    reference: summary.bookingReference,
    status: summary.bookingStatus,
    paymentStatus: summary.paymentStatus,
    checkIn: summary.checkIn,
    checkOut: summary.checkOut,
    nights: summary.nights,
    currency: summary.currency,
    total: money(summary.breakdown.total, summary.currency),
    paid: summary.paymentStatus === "PAID",
    rooms: summary.rooms.map((room) => `${room.roomNumber} (${room.roomTypeName})`),
  };
}

// ---------------------------------------------------------------------------
// Dispatch
// ---------------------------------------------------------------------------

function messageFor(error: unknown): string | null {
  if (error instanceof ToolInputError) return error.message;
  if (error instanceof StayValidationError) return error.message;
  if (error instanceof QuoteError) return error.message;
  if (error instanceof AvailabilityConflictError) {
    return "Those rooms were just taken — offer different dates or another room type.";
  }
  if (error instanceof BookingError) {
    switch (error.code) {
      case "account_required":
        return "This reservation needs an account — offer sign-up first.";
      case "price_changed":
        return "The price moved while we were booking — re-check the quote and tell the guest.";
      case "balance_due":
        return error.message;
      default:
        return error.message;
    }
  }
  if (error instanceof TransitionError) return error.message;
  return null;
}

/**
 * Runs one tool call. Every failure becomes `{ ok: false, message }` in the
 * tool result — the model reads it and explains it — instead of an exception
 * that would abort the whole turn.
 */
export async function executeConciergeTool(
  name: string,
  rawArgs: string,
  ctx: ConciergeContext,
): Promise<ToolOutcome> {
  let args: Record<string, unknown> = {};
  if (rawArgs.trim()) {
    try {
      const parsed: unknown = JSON.parse(rawArgs);
      if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
        args = parsed as Record<string, unknown>;
      } else {
        throw new ToolInputError("tool arguments must be a JSON object");
      }
    } catch (error) {
      if (error instanceof ToolInputError) throw error;
      throw new ToolInputError("tool arguments were not valid JSON");
    }
  }

  try {
    switch (name) {
      case "suggest_rooms":
        return await handleSuggestRooms(ctx, args);
      case "check_availability":
        return await handleCheckAvailability(ctx, args);
      case "check_discount":
        return await handleCheckDiscount(ctx, args);
      case "best_selling_rooms":
        return await handleBestSelling(ctx, args);
      case "create_reservation":
        return await handleCreateReservation(ctx, args);
      case "signup_user":
        return await handleSignup(ctx, args);
      case "lookup_booking":
        return await handleLookupBooking(ctx, args);
      case "check_out_stay":
        return await handleCheckOutStay(ctx, args);
      default:
        throw new ToolInputError(`unknown tool "${name}"`);
    }
  } catch (error) {
    const message = messageFor(error);
    if (message === null) {
      console.error(`concierge tool ${name} failed`, error);
      return {
        data: { ok: false, reason: "internal", message: "That action failed — tell the guest to try again." },
        detail: "Something went wrong",
      };
    }
    return { data: { ok: false, reason: "rejected", message }, detail: "Could not complete that" };
  }
}
