import { Listing } from "@/components/hotel/listing";
import { loadHotelProfile, loadPublicRoomTypes } from "@/server/public/catalog";
import { loadAvailabilityListing, parsePublicStay } from "@/server/public/search";
import { getContent } from "@/server/console/settings";
import { getDefaultHotel } from "@/server/public/hotels";
import { getT, pageMetadata } from "@/server/locale/display";
import type { HotelLocation } from "@/lib/hotel";

export const generateMetadata = () =>
  pageMetadata("meta.search.title", "meta.search.description");

/** Verified map location (MR-07) — null coordinates until an operator sets them. */
function toHotelLocation(hotel: Awaited<ReturnType<typeof loadHotelProfile>>): HotelLocation {
  return {
    name: hotel.name,
    address:
      [hotel.addressLine1, hotel.addressLine2, hotel.city, hotel.postcode, hotel.country]
        .filter(Boolean)
        .join(", ") || null,
    latitude: hotel.latitude,
    longitude: hotel.longitude,
  };
}

export default async function SearchPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const sp = await searchParams;
  const parsed = parsePublicStay(sp);
  const defaultHotel = await getDefaultHotel();
  if (!defaultHotel) return null;
  const hotelId = defaultHotel.id;

  if (!parsed.stay) {
    const [hotel, rooms, intro, t] = await Promise.all([
      loadHotelProfile(hotelId),
      loadPublicRoomTypes(hotelId),
      getContent("rooms.intro", hotelId),
      getT(),
    ]);
    return (
      <Listing
        rooms={rooms}
        currency={hotel.currency}
        location={toHotelLocation(hotel)}
        errorMessage={parsed.error}
        policyNote={t("policy.freeCancellation", {
          hours: hotel.cancellationWindowHours,
        })}
        title={intro?.title}
        description={intro?.body}
      />
    );
  }

  const [{ rooms, currency, error }, hotel, t] = await Promise.all([
    loadAvailabilityListing(parsed.stay, hotelId),
    loadHotelProfile(hotelId),
    getT(),
  ]);

  return (
    <Listing
      mode="availability"
      rooms={rooms}
      stay={parsed.stay}
      currency={currency || hotel.currency}
      location={toHotelLocation(hotel)}
      errorMessage={error}
      policyNote={t("policy.freeCancellation", {
        hours: hotel.cancellationWindowHours,
      })}
    />
  );
}
