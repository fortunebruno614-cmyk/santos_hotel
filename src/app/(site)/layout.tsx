import { CurrencyProvider } from "@/components/hotel/currency-provider";
import { HotelShell } from "@/components/hotel/hotel-shell";
import { AI_CHAT_ENABLED } from "@/config/ai";
import { getCurrentSession } from "@/server/auth/dal";
import { displayCurrency } from "@/server/currency/display";
import { loadHotelProfile } from "@/server/public/catalog";
import { getContent } from "@/server/console/settings";
import { getDefaultHotel } from "@/server/public/hotels";
import { getT } from "@/server/locale/display";

export default async function SiteLayout({ children }: { children: React.ReactNode }) {
  const defaultHotel = await getDefaultHotel();
  const [session, hotel, footer, display, t] = await Promise.all([
    getCurrentSession(),
    defaultHotel ? loadHotelProfile(defaultHotel.id) : null,
    getContent("site.footer", defaultHotel?.id),
    displayCurrency(),
    getT(),
  ]);
  const address = hotel
    ? [hotel.addressLine1, hotel.addressLine2, hotel.city, hotel.postcode, hotel.country]
        .filter(Boolean)
        .join(", ") || t("hotel.addressFallback")
    : "Santo Hotel";

  return (
    <CurrencyProvider value={display}>
      <HotelShell
        signedIn={Boolean(session)}
        staff={session?.kind === "staff"}
        currency={hotel?.currency ?? "NGN"}
        hotelName={hotel?.name ?? "Santo Hotel"}
        address={address}
        email={hotel?.email ?? null}
        footerNote={footer?.body ?? null}
        chatEnabled={AI_CHAT_ENABLED}
      >
        {children}
      </HotelShell>
    </CurrencyProvider>
  );
}
