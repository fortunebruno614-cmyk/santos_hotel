import { createFileRoute } from "@tanstack/react-router";
import { HotelInfo } from "@/components/hotel/hotel-info";
import { meta } from "@/lib/hotel-data";
export const Route = createFileRoute("/hotel")({
  head: () =>
    meta(
      "The Santo way",
      "Get to know the Santo Hotel concept, illustrative property spaces, guest information and frequently asked questions.",
    ),
  component: () => <HotelInfo />,
});
