import { Listing } from "@/components/hotel/listing";
import { loadHotelProfile, loadPublicRoomTypes } from "@/server/public/catalog";
import { loadAvailabilityListing, parsePublicStay } from "@/server/public/search";
import { getContent } from "@/server/console/settings";

export const metadata = {
  title: "Find your stay",
  description: "Explore live room availability for your selected Santo Hotel stay.",
};

export default async function SearchPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const sp = await searchParams;
  const parsed = parsePublicStay(sp);

  if (!parsed.stay) {
    const [hotel, rooms, intro] = await Promise.all([
      loadHotelProfile(),
      loadPublicRoomTypes(),
      getContent("rooms.intro"),
    ]);
    return (
      <Listing
        rooms={rooms}
        currency={hotel.currency}
        errorMessage={parsed.error}
        policyNote={`Free cancellation up to ${hotel.cancellationWindowHours} hours before arrival`}
        title={intro?.title}
        description={intro?.body}
      />
    );
  }

  const [{ rooms, currency, error }, hotel] = await Promise.all([
    loadAvailabilityListing(parsed.stay),
    loadHotelProfile(),
  ]);

  return (
    <Listing
      mode="availability"
      rooms={rooms}
      stay={parsed.stay}
      currency={currency || hotel.currency}
      errorMessage={error}
      policyNote={`Free cancellation up to ${hotel.cancellationWindowHours} hours before arrival`}
    />
  );
}
