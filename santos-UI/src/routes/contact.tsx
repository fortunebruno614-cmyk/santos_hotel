import { createFileRoute } from "@tanstack/react-router";
import { HotelInfo } from "@/components/hotel/hotel-info";
import { meta } from "@/lib/hotel-data";
export const Route = createFileRoute("/contact")({
  head: () =>
    meta(
      "Say hello",
      "Explore Santo Hotel contact information and the demonstration enquiry form. Hotel contact details are awaiting confirmation.",
    ),
  component: () => <HotelInfo contact />,
});
