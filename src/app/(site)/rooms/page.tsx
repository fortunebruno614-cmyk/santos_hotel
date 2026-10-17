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
      policyNote={`Free cancellation up to ${hotel.cancellationWindowHours} hours before arrival`}
      title={intro?.title}
      description={intro?.body}
    />
  );
}
