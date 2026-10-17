import { StaySearchSchema } from "@/server/availability/validation";
import { parseDateOnly } from "@/server/availability/overlap";
import { findAvailability, StayValidationError } from "@/server/availability/service";
import { computeTypePrices } from "@/server/pricing/service";
import { loadHotelContext } from "@/server/pricing/context";
import type { ListingRoom, StayQuery } from "@/lib/hotel";
import { loadPublicRoomTypes } from "@/server/public/catalog";

const ERROR_MESSAGES: Record<string, string> = {
  invalid_query: "Please choose valid dates and party size.",
  invalid_date_range: "Check-out must be after check-in.",
  stay_too_long: "That stay is longer than the 60-night limit.",
  invalid_occupancy: "Party size must be 1–20 adults and 0–20 children.",
};

export type ParsedStay =
  | { stay: StayQuery; error: null }
  | { stay: null; error: string | null };

export function parsePublicStay(
  searchParams: Record<string, string | undefined>,
): ParsedStay {
  const hasQuery =
    searchParams.checkIn ||
    searchParams.checkOut ||
    searchParams.adults ||
    searchParams.children;
  if (!hasQuery) return { stay: null, error: null };

  const parsed = StaySearchSchema.safeParse({
    checkIn: searchParams.checkIn ?? undefined,
    checkOut: searchParams.checkOut ?? undefined,
    adults: searchParams.adults ?? undefined,
    children: searchParams.children ?? undefined,
  });
  if (!parsed.success) {
    const key = Object.keys(parsed.error.flatten().fieldErrors)[0];
    return { stay: null, error: ERROR_MESSAGES[key] ?? ERROR_MESSAGES.invalid_query };
  }

  const checkIn = parseDateOnly(parsed.data.checkIn);
  const checkOut = parseDateOnly(parsed.data.checkOut);
  if (!checkIn || !checkOut) {
    return { stay: null, error: ERROR_MESSAGES.invalid_query };
  }

  const quantityRaw = Number(searchParams.rooms ?? 1);
  const quantity =
    Number.isInteger(quantityRaw) && quantityRaw >= 1 && quantityRaw <= 3 ? quantityRaw : 1;

  return {
    stay: {
      checkIn: checkIn.toISOString().slice(0, 10),
      checkOut: checkOut.toISOString().slice(0, 10),
      adults: parsed.data.adults,
      children: parsed.data.children,
      quantity,
    },
    error: null,
  };
}

export async function loadAvailabilityListing(stay: StayQuery): Promise<{
  rooms: ListingRoom[];
  currency: string;
  error: string | null;
}> {
  try {
    const checkIn = parseDateOnly(stay.checkIn);
    const checkOut = parseDateOnly(stay.checkOut);
    if (!checkIn || !checkOut) {
      return { rooms: [], currency: (await loadHotelContext()).currency, error: ERROR_MESSAGES.invalid_query };
    }

    const [catalog, availability] = await Promise.all([
      loadPublicRoomTypes(),
      findAvailability({
        checkIn,
        checkOut,
        adults: stay.adults,
        children: stay.children,
      }),
    ]);

    const prices = await computeTypePrices(
      availability.roomTypes.map((type) => type.id),
      checkIn,
      checkOut,
    );
    const hotel = await loadHotelContext();

    const rooms = catalog
      .map((room) => {
        const type = availability.roomTypes.find((candidate) => candidate.id === room.id);
        const price = prices.get(room.id);
        return {
          ...room,
          availableCount: type?.availableCount ?? 0,
          availableRoomIds: type?.availableRooms.map((physical) => physical.id) ?? [],
          price,
        };
      })
      .filter((room) => (room.availableCount ?? 0) > 0);

    return { rooms, currency: hotel.currency, error: null };
  } catch (error) {
    if (error instanceof StayValidationError) {
      return {
        rooms: [],
        currency: (await loadHotelContext()).currency,
        error: ERROR_MESSAGES[error.code] ?? ERROR_MESSAGES.invalid_query,
      };
    }
    throw error;
  }
}
