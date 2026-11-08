import { HotelInfo } from "@/components/hotel/hotel-info";
import { loadHotelProfile } from "@/server/public/catalog";
import { getDefaultHotel } from "@/server/public/hotels";
import { getT, pageMetadata } from "@/server/locale/display";

export const generateMetadata = () =>
  pageMetadata("meta.contact.title", "meta.contact.description");

export default async function ContactPage() {
  const defaultHotel = await getDefaultHotel();
  if (!defaultHotel) return null;
  const [hotel, t] = await Promise.all([
    loadHotelProfile(defaultHotel.id),
    getT(),
  ]);
  const address =
    [hotel.addressLine1, hotel.addressLine2, hotel.city, hotel.postcode, hotel.country]
      .filter(Boolean)
      .join(", ") || t("hotel.addressFallback");

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
