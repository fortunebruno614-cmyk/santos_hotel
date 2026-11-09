import { Breadcrumb, PageHeading } from "@/components/hotel/shared";
import { FlightTracker } from "@/components/flights/flight-tracker";
import { FLIGHT_BBOX_SPAN_DEG, FLIGHT_DEFAULT_ZOOM } from "@/config/flights";
import { getDefaultHotel } from "@/server/public/hotels";
import { getT, pageMetadata } from "@/server/locale/display";
import { bboxAround, resolveFlightCenter } from "@/server/flights/validation";

export const generateMetadata = () =>
  pageMetadata("meta.flights.title", "meta.flights.description");

export default async function FlightsPage() {
  const [hotel, t] = await Promise.all([getDefaultHotel(), getT()]);
  const hotelName = hotel?.name ?? "Santo Hotel";
  // The regional view follows the hotel's verified coordinates when present.
  // The fallback is a documented Lagos centre, never a guessed address pin.
  const center = resolveFlightCenter(hotel?.latitude, hotel?.longitude);
  const bbox = bboxAround(center, FLIGHT_BBOX_SPAN_DEG);

  return (
    <div className="container page-content">
      <Breadcrumb current={t("flights.breadcrumb")} />
      <PageHeading
        eyebrow={t("flights.eyebrow")}
        title={t("flights.title")}
        description={t("flights.description", { hotel: hotelName })}
      />
      <FlightTracker
        initialCenter={center}
        initialBbox={bbox}
        initialZoom={FLIGHT_DEFAULT_ZOOM}
        hotelName={hotelName}
      />
    </div>
  );
}
