import Link from "next/link";
import { MapPin } from "lucide-react";
import { PageHeading } from "@/components/hotel/shared";
import { listPublishedHotels } from "@/server/public/hotels";

export const metadata = {
  title: "Hotel marketplace",
  description: "Discover published Santo marketplace properties.",
};

export default async function HotelsPage() {
  const hotels = await listPublishedHotels();

  return (
    <div className="container page-content">
      <PageHeading
        eyebrow="THE SANTO MARKETPLACE"
        title="Find your next stay."
        description="Every published property, each operated by its own hotel team."
      />
      {hotels.length === 0 ? (
        <div className="empty-state">
          <h2>No published properties yet.</h2>
          <p>Hotel teams are preparing their listings. Please check back soon.</p>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {hotels.map((hotel) => (
            <Link
              key={hotel.id}
              href={`/hotels/${hotel.slug}`}
              className="rounded-xl border p-5 transition hover:shadow-md"
            >
              <h2 className="text-lg font-semibold">{hotel.name}</h2>
              <p className="mt-1 inline-flex items-center gap-1 text-sm text-zinc-500">
                <MapPin size={14} />
                {[hotel.city, hotel.country].filter(Boolean).join(", ") || "Location to be confirmed"}
              </p>
              <p className="mt-3 line-clamp-3 text-sm text-zinc-600">
                {hotel.description ?? "A Santo marketplace property."}
              </p>
              <p className="mt-3 text-xs font-medium uppercase tracking-wide text-zinc-500">
                Prices in {hotel.currency}
              </p>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
