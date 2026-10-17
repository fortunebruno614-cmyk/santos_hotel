import { HotelInfo } from "@/components/hotel/hotel-info";
import { loadHotelProfile } from "@/server/public/catalog";

export const metadata = {
  title: "Say hello",
  description: "Contact Santo Hotel for booking assistance, accessibility questions and special occasions.",
};

export default async function ContactPage() {
  const hotel = await loadHotelProfile();
  const address =
    [hotel.addressLine1, hotel.addressLine2, hotel.city, hotel.postcode, hotel.country]
      .filter(Boolean)
      .join(", ") || "Hotel address to be confirmed";

  return (
    <HotelInfo
      contact
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
