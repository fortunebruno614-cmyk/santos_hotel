import { HotelShell } from "@/components/hotel/hotel-shell";
import { getCurrentSession } from "@/server/auth/dal";
import { loadHotelProfile } from "@/server/public/catalog";
import { getContent } from "@/server/console/settings";

export default async function SiteLayout({ children }: { children: React.ReactNode }) {
  const [session, hotel, footer] = await Promise.all([
    getCurrentSession(),
    loadHotelProfile(),
    getContent("site.footer"),
  ]);
  const address =
    [hotel.addressLine1, hotel.addressLine2, hotel.city, hotel.postcode, hotel.country]
      .filter(Boolean)
      .join(", ") || "Hotel address to be confirmed";

  return (
    <HotelShell
      signedIn={Boolean(session)}
      staff={session?.kind === "staff"}
      currency={hotel.currency}
      hotelName={hotel.name}
      address={address}
      email={hotel.email}
      footerNote={footer?.body ?? null}
    >
      {children}
    </HotelShell>
  );
}
