import { HomeContent } from "./home-content";
import { getContent } from "@/server/console/settings";
import {
  loadHotelProfile,
  loadPublicRoomTypes,
  loadRoomsInventory,
} from "@/server/public/catalog";
import { getDefaultHotel } from "@/server/public/hotels";

export default async function Home() {
  const defaultHotel = await getDefaultHotel();
  if (!defaultHotel) return null;
  const hotelId = defaultHotel.id;
  const [hero, rooms, hotel, inventory] = await Promise.all([
    getContent("home.hero", hotelId),
    loadPublicRoomTypes(hotelId),
    loadHotelProfile(hotelId),
    loadRoomsInventory(hotelId),
  ]);

  const address =
    [hotel.addressLine1, hotel.addressLine2, hotel.city, hotel.postcode, hotel.country]
      .filter(Boolean)
      .join(", ") || "Hotel address to be confirmed.";

  return (
    <HomeContent
      rooms={rooms}
      inventory={inventory}
      currency={hotel.currency}
      heroTitle={hero?.title || "Your Stay, Thoughtfully Designed."}
      heroBody={
        hero?.body ||
        "Discover comfort, exceptional hospitality, and a stay tailored to you at Santo Hotel."
      }
      address={address}
      hotelName={hotel.name}
    />
  );
}
