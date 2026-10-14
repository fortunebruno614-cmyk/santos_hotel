import { createFileRoute } from "@tanstack/react-router";
import { Listing } from "@/components/hotel/listing";
import { meta } from "@/lib/hotel-data";
export const Route = createFileRoute("/availability")({
  head: () =>
    meta(
      "Find your stay",
      "Explore demonstration room availability for your selected Santo Hotel stay.",
    ),
  component: () => <Listing availability />,
});
