import { notFound } from "next/navigation";
import { Listing } from "@/components/hotel/listing";
import { loadHotelProfile, loadPublicRoomTypes } from "@/server/public/catalog";
import { getPublishedHotelBySlug } from "@/server/public/hotels";

export default async function HotelListingPage({
  params,
}: {
  params: Promise<{ hotelSlug: string }>;
}) {
  const { hotelSlug } = await params;
  const published = await getPublishedHotelBySlug(hotelSlug);
  if (!published) notFound();

  const [hotel, rooms] = await Promise.all([
    loadHotelProfile(published.id),
    loadPublicRoomTypes(published.id),
  ]);
  const today = new Date();
  const checkIn = today.toISOString().slice(0, 10);
  const checkout = new Date(today);
  checkout.setUTCDate(checkout.getUTCDate() + 1);
  const stay = {
    checkIn,
    checkOut: checkout.toISOString().slice(0, 10),
    adults: 2,
    children: 0,
    quantity: 1,
  };
  const address =
    [hotel.addressLine1, hotel.addressLine2, hotel.city, hotel.postcode, hotel.country]
      .filter(Boolean)
      .join(", ") || null;

  return (
    <div className="container page-content">
      <div className="mb-6">
        <p className="text-xs font-medium uppercase tracking-widest text-zinc-500">
          Santo marketplace
        </p>
        <h1 className="text-3xl font-semibold">{hotel.name}</h1>
        <p className="mt-1 text-sm text-zinc-600">{address ?? "Address to be confirmed."}</p>
        {hotel.description && <p className="mt-3 max-w-2xl text-sm">{hotel.description}</p>}
        <p className="mt-2 text-xs text-zinc-500">
          Check-in from {hotel.checkInTime} · check-out by {hotel.checkOutTime} · prices in{" "}
          {hotel.currency}
        </p>
      </div>
      <Listing
        rooms={rooms}
        stay={stay}
        currency={hotel.currency}
        location={{
          name: hotel.name,
          address,
          latitude: hotel.latitude,
          longitude: hotel.longitude,
        }}
        policyNote={`Free cancellation up to ${hotel.cancellationWindowHours} hours before arrival`}
        title="Rooms at this property"
        description="Live catalogue for this hotel. Choose a room to see availability and book."
      />
    </div>
  );
}
