import { HomeContent } from "./home-content";
import { getContent } from "@/server/console/settings";
import { loadHotelProfile, loadPublicRoomTypes } from "@/server/public/catalog";

export default async function Home() {
  const [hero, rooms, hotel] = await Promise.all([
    getContent("home.hero"),
    loadPublicRoomTypes(),
    loadHotelProfile(),
  ]);

  const address =
    [hotel.addressLine1, hotel.addressLine2, hotel.city, hotel.postcode, hotel.country]
      .filter(Boolean)
      .join(", ") || "Hotel address to be confirmed.";

  return (
    <HomeContent
      rooms={rooms}
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
