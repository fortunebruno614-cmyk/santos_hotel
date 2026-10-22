import { conversionRate, convertMoney, isDisplayCurrency, moneyLocale } from "@/lib/currency";

export type PublicRoomType = {
  id: string;
  slug: string;
  name: string;
  description: string;
  maxAdults: number;
  maxChildren: number;
  basePrice: string;
  images: string[];
  amenities: string[];
  totalRooms: number;
  isSuite: boolean;
  bed: string;
};

export type StayQuery = {
  checkIn: string;
  checkOut: string;
  adults: number;
  children: number;
  quantity: number;
};

export type AvailabilityPrice = {
  perNight: string[];
  nightlyRate: string;
  stayTotal: string;
  currency: string;
};

export type ListingRoom = PublicRoomType & {
  availableCount?: number;
  availableRoomIds?: string[];
  price?: AvailabilityPrice;
};

export const FALLBACK_ROOM_IMAGE = "/images/santo-room.jpg";

export const GALLERY_IMAGES = [
  "/images/santo-lobby.jpg",
  "/images/santo-pool.jpg",
  "/images/santo-room.jpg",
] as const;

const SLUG_IMAGES: Record<string, string> = {
  "deluxe-king": "/images/santo-room.jpg",
  "executive-suite": "/images/santo-suite.jpg",
  "family-room": "/images/santo-twin.jpg",
};

export function fallbackImageForSlug(slug: string): string {
  return SLUG_IMAGES[slug] ?? FALLBACK_ROOM_IMAGE;
}

export function bedForRoomType(name: string, description: string): string {
  const text = `${name} ${description}`.toLowerCase();
  if (text.includes("twin")) return "2 twin beds";
  if (text.includes("two queen") || text.includes("2 queen")) return "2 queen beds";
  if (text.includes("queen")) return "1 queen bed";
  if (text.includes("king")) return "1 king bed";
  return "Flexible bedding";
}

export function isSuiteName(name: string): boolean {
  return name.toLowerCase().includes("suite");
}

/**
 * Formats `amount` (already priced in `currency`) for display.
 *
 * `display` is the guest's chosen viewing currency (NGN/USD, from the
 * `santo_currency` cookie — see `@/lib/currency`). It only changes what is
 * rendered: the stored and charged amount stays in `currency`. When the pair
 * has no known rate the amount is shown in `currency` instead of being
 * mislabelled.
 */
export function formatMoney(
  amount: string | number,
  currency: string,
  display?: string,
): string {
  const base = currency?.trim().toUpperCase() || "NGN";
  const wanted = display && isDisplayCurrency(display) ? display : base;
  const target = conversionRate(base, wanted) === null ? base : wanted;
  const value = typeof amount === "string" ? Number(amount) : amount;
  if (!Number.isFinite(value)) return `${target} 0`;
  const converted = convertMoney(value, base, target);
  const hasFraction = Math.round(converted * 100) % 100 !== 0;
  return new Intl.NumberFormat(moneyLocale(target), {
    style: "currency",
    currency: target,
    minimumFractionDigits: hasFraction ? 2 : 0,
    maximumFractionDigits: 2,
  }).format(converted);
}

export function nightsBetween(start: string, end: string): number {
  return Math.max(
    1,
    Math.round((new Date(end).getTime() - new Date(start).getTime()) / 86400000) || 1,
  );
}

export function addDays(date: string, days: number): string {
  const value = new Date(`${date}T00:00:00Z`);
  value.setUTCDate(value.getUTCDate() + days);
  return value.toISOString().slice(0, 10);
}

export function defaultStayDates(): { checkIn: string; checkOut: string } {
  const today = new Date();
  const checkIn = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate() + 7));
  const checkOut = new Date(checkIn.getTime() + 2 * 86400000);
  return { checkIn: checkIn.toISOString().slice(0, 10), checkOut: checkOut.toISOString().slice(0, 10) };
}

export function searchHref(stay: StayQuery, path = "/search"): string {
  const params = new URLSearchParams({
    checkIn: stay.checkIn,
    checkOut: stay.checkOut,
    adults: String(stay.adults),
    children: String(stay.children),
    rooms: String(stay.quantity),
  });
  return `${path}?${params.toString()}`;
}

export function bookingHref(stay: StayQuery, roomIds: string[]): string {
  const params = new URLSearchParams({
    checkIn: stay.checkIn,
    checkOut: stay.checkOut,
    adults: String(stay.adults),
    children: String(stay.children),
    roomIds: roomIds.join(","),
  });
  return `/booking?${params.toString()}`;
}
