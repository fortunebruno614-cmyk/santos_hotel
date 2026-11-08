import { HomeContent } from "./home-content";
import { getContent } from "@/server/console/settings";
import {
  loadHotelProfile,
  loadPublicRoomTypes,
  loadRoomsInventory,
} from "@/server/public/catalog";
import { getDefaultHotel } from "@/server/public/hotels";
import { getT } from "@/server/locale/display";

export default async function Home() {
  const defaultHotel = await getDefaultHotel();
  if (!defaultHotel) return null;
  const hotelId = defaultHotel.id;
  const [t, hero, rooms, hotel, inventory] = await Promise.all([
    getT(),
    getContent("home.hero", hotelId),
    loadPublicRoomTypes(hotelId),
    loadHotelProfile(hotelId),
    loadRoomsInventory(hotelId),
  ]);

  const address =
    [hotel.addressLine1, hotel.addressLine2, hotel.city, hotel.postcode, hotel.country]
      .filter(Boolean)
      .join(", ") || t("home.addressFallback");

  return (
    <HomeContent
      rooms={rooms}
      inventory={inventory}
      currency={hotel.currency}
      heroTitle={hero?.title || t("home.heroTitleFallback")}
      heroBody={hero?.body || t("home.heroBodyFallback")}
      address={address}
      hotelName={hotel.name}
    />
  );
}
