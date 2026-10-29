import { Listing } from "@/components/hotel/listing";
import { loadHotelProfile, loadPublicRoomTypes } from "@/server/public/catalog";
import { getContent } from "@/server/console/settings";

export const metadata = {
  title: "Rooms & Suites",
  description:
    "Find your perfect stay in the Santo Hotel room and suite collection. Explore accommodation, amenities and rates.",
};

export default async function RoomsPage() {
  const [rooms, hotel, intro] = await Promise.all([
    loadPublicRoomTypes(),
    loadHotelProfile(),
    getContent("rooms.intro"),
  ]);

  return (
    <Listing
      rooms={rooms}
      currency={hotel.currency}
      location={{
        name: hotel.name,
        address:
          [hotel.addressLine1, hotel.addressLine2, hotel.city, hotel.postcode, hotel.country]
            .filter(Boolean)
            .join(", ") || null,
        latitude: hotel.latitude,
        longitude: hotel.longitude,
      }}
      policyNote={`Free cancellation up to ${hotel.cancellationWindowHours} hours before arrival`}
      title={intro?.title}
      description={intro?.body}
    />
  );
}
