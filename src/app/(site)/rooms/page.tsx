import { Listing } from "@/components/hotel/listing";
import { loadHotelProfile, loadPublicRoomTypes } from "@/server/public/catalog";
import { getDefaultHotel } from "@/server/public/hotels";
import { getContent } from "@/server/console/settings";
import { getT, pageMetadata } from "@/server/locale/display";

export const generateMetadata = () => pageMetadata("meta.rooms.title", "meta.rooms.description");

export default async function RoomsPage() {
  const defaultHotel = await getDefaultHotel();
  if (!defaultHotel) return null;
  const hotelId = defaultHotel.id;
  const [t, rooms, hotel, intro] = await Promise.all([
    getT(),
    loadPublicRoomTypes(hotelId),
    loadHotelProfile(hotelId),
    getContent("rooms.intro", hotelId),
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
      policyNote={t("policy.freeCancellation", {
        hours: hotel.cancellationWindowHours,
      })}
      title={intro?.title}
      description={intro?.body}
    />
  );
}
