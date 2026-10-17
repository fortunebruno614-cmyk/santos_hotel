import { HotelInfo } from "@/components/hotel/hotel-info";
import { loadHotelProfile } from "@/server/public/catalog";

export const metadata = {
  title: "The Santo way",
  description:
    "Get to know the Santo Hotel concept, property spaces, guest information and frequently asked questions.",
};

export default async function HotelPage() {
  const hotel = await loadHotelProfile();
  const address =
    [hotel.addressLine1, hotel.addressLine2, hotel.city, hotel.postcode, hotel.country]
      .filter(Boolean)
      .join(", ") || "Hotel address to be confirmed";

  return (
    <HotelInfo
      hotel={{
        name: hotel.name,
        email: hotel.email,
        phone: hotel.phone,
        address,
        checkInTime: hotel.checkInTime,
        checkOutTime: hotel.checkOutTime,
        cancellationWindowHours: hotel.cancellationWindowHours,
      }}
    />
  );
}
