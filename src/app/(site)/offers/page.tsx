import { OffersContent } from "./offers-content";
import { pageMetadata } from "@/server/locale/display";

export const generateMetadata = () =>
  pageMetadata("meta.offers.title", "meta.offers.description");

export default function OffersPage() {
  return <OffersContent />;
}
