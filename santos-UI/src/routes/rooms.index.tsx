import { createFileRoute } from "@tanstack/react-router";
import { Listing } from "@/components/hotel/listing";
import { meta } from "@/lib/hotel-data";
export const Route = createFileRoute("/rooms/")({
  head: () =>
    meta(
      "Rooms & Suites",
      "Find your perfect stay in the Santo Hotel room and suite collection. Explore sample accommodation, amenities and rates.",
    ),
  component: () => <Listing />,
});
