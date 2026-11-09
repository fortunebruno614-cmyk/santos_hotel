import Link from "next/link";
import { ArrowRight, CalendarDays, UserRound } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Breadcrumb, PageHeading } from "@/components/hotel/shared";
import { CancelReservationButton } from "@/components/hotel/cancel-button";
import { SignOutButton } from "@/components/auth/sign-out-button";
import { UserAvatar } from "@/components/auth/user-avatar";
import { WeatherWidget } from "@/components/weather/weather-widget";
import { requireGuest, getCurrentUser } from "@/server/auth/dal";
import { prisma } from "@/lib/prisma";
import { cancellationInfoFor } from "@/server/booking/service";
import { requireHotelContext, hotelToday } from "@/server/pricing/context";
import { getDefaultHotel } from "@/server/public/hotels";
import { displayCurrency } from "@/server/currency/display";
import { BookingStatus } from "@/generated/prisma/enums";
import { fallbackImageForSlug, formatMoney as publicMoney } from "@/lib/hotel";
import { getT } from "@/server/locale/display";
import type { Dictionary } from "@/lib/dictionaries";

export default async function AccountPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const sp = await searchParams;
  const tab = sp.tab === "profile" || sp.tab === "bookings" ? sp.tab : "overview";
  const session = await requireGuest();
  const user = await getCurrentUser();
  const defaultHotel = await getDefaultHotel();
  if (!defaultHotel) return null;
  const hotel = await requireHotelContext(defaultHotel.id);
  const display = await displayCurrency();
  const today = hotelToday(new Date(), hotel.timezone);
  const t = await getT();

  const guest = user && "firstName" in user ? user : null;
  const name = guest
    ? [guest.firstName, guest.lastName].filter(Boolean).join(" ")
    : t("account.guestName");

  const bookings = session.guestId
    ? await prisma.booking.findMany({
        where: { guestId: session.guestId },
        orderBy: { createdAt: "desc" },
        include: {
          rooms: {
            include: { room: { include: { roomType: { select: { name: true, slug: true } } } } },
          },
        },
      })
    : [];

  const hotelContexts = new Map(
    await Promise.all(
      [...new Set(bookings.map((booking) => booking.hotelId).filter(Boolean))].map(
        async (hotelId) => [hotelId!, await requireHotelContext(hotelId!)] as const,
      ),
    ),
  );

  const roomTypes = await prisma.roomType.findMany({
    where: { name: { in: [...new Set(bookings.flatMap((booking) => booking.rooms.map((line) => line.room.roomType.name)))] } },
    include: { images: { orderBy: { sortOrder: "asc" }, take: 1 } },
  });
  const imageByName = new Map(
    roomTypes.map((type) => [
      type.name,
      type.images[0]?.url ?? fallbackImageForSlug(type.slug),
    ]),
  );

  const upcoming = bookings.filter((booking) => booking.checkOut.getTime() >= today.getTime());
  const past = bookings.filter((booking) => booking.checkOut.getTime() < today.getTime());

  const renderBooking = (booking: (typeof bookings)[number]) => {
    const context =
      (booking.hotelId ? hotelContexts.get(booking.hotelId) : null) ?? hotel;
    const cancellation = cancellationInfoFor(booking, context);
    const roomName = booking.rooms[0]?.room.roomType.name ?? t("account.santoStay");
    const image = imageByName.get(roomName) ?? fallbackImageForSlug("");
    const total = publicMoney(booking.total.toString(), context.currency, display);
    const statusLabel = t(`status.booking.${booking.bookingStatus}` as keyof Dictionary);
    const paymentLabel = t(`status.payment.${booking.paymentStatus}` as keyof Dictionary);
    return (
      <article className="account-booking" key={booking.id}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={image} alt={roomName} />
        <div>
          <span className="subtle-badge">
            {statusLabel} · {paymentLabel}
          </span>
          <h3>{roomName}</h3>
          <p>
            {booking.checkIn.toISOString().slice(0, 10)} — {booking.checkOut.toISOString().slice(0, 10)}
          </p>
          <p>
            {t("booking.guestsLine", {
              adults: booking.adults,
              adultUnit: booking.adults === 1 ? t("search.adult") : t("search.adultsPlural"),
              children: booking.children,
              childUnit: booking.children === 1 ? t("search.child") : t("search.childrenPlural"),
              rooms: booking.rooms.length,
              roomUnit: booking.rooms.length === 1 ? t("summary.room") : t("summary.rooms"),
            })}
          </p>
          <p>{t("account.total", { total })}</p>
          <small>{t("account.reference", { ref: booking.bookingReference })}</small>
          <div className="confirmation-actions">
            <Button asChild variant="link">
              <Link href={`/booking/confirmation?ref=${encodeURIComponent(booking.bookingReference)}`}>
                {t("account.viewReservation")} <ArrowRight />
              </Link>
            </Button>
            {booking.bookingStatus !== BookingStatus.CANCELLED &&
              (cancellation.guestAllowed ? (
                <CancelReservationButton
                  bookingId={booking.id}
                  reference={booking.bookingReference}
                  mode="account"
                />
              ) : (
                <p className="tiny-note">{t("account.cancelUnavailable")}</p>
              ))}
          </div>
        </div>
      </article>
    );
  };

  return (
    <div className="container page-content">
      <Breadcrumb current={t("account.breadcrumb")} />
      <PageHeading
        eyebrow={t("account.eyebrow")}
        title={t("account.welcome", { name: guest?.firstName ?? t("account.guestName") })}
        description={t("account.description")}
      />

      <div className="account-layout">
        <nav className="account-nav">
          <Button asChild variant={tab === "overview" ? "secondary" : "ghost"}>
            <Link href="/account">
              <CalendarDays />
              {t("account.nav.overview")}
            </Link>
          </Button>
          <Button asChild variant={tab === "bookings" ? "secondary" : "ghost"}>
            <Link href="/account?tab=bookings">
              <CalendarDays />
              {t("account.nav.bookings")}
            </Link>
          </Button>
          <Button asChild variant={tab === "profile" ? "secondary" : "ghost"}>
            <Link href="/account?tab=profile">
              <UserRound />
              {t("account.nav.profile")}
            </Link>
          </Button>
          <SignOutButton
            label={t("account.nav.signOut")}
            variant="ghost"
            icon
          />
        </nav>

        <section>
          {tab === "profile" ? (
            <div className="form-section">
              <h2>{t("account.profileTitle")}</h2>
              <p className="tiny-note">{t("account.profileNote")}</p>
              <div className="profile-identity">
                <UserAvatar name={name} src={guest?.avatarUrl} className="profile-avatar" />
                <div>
                  <strong>{name}</strong>
                  <span>{guest?.email ?? "-"}</span>
                  {guest?.authProvider === "google" && (
                    <span className="provider-badge">{t("account.googleConnected")}</span>
                  )}
                </div>
              </div>
              <Button asChild className="mt-6">
                <Link href="/contact">{t("account.contactHotel")}</Link>
              </Button>
            </div>
          ) : (
            <>
              {tab === "overview" && (
                <WeatherWidget variant="card" className="account-weather" />
              )}
              <section>
                <div className="section-heading">
                  <h2>
                    {tab === "overview" ? t("account.nextStay") : t("account.nav.bookings")}
                  </h2>
                  <span className="subtle-badge">{t("account.liveReservations")}</span>
                </div>
                {upcoming.length === 0 ? (
                  <div className="empty-state">
                    <h2>{t("account.noUpcoming")}</h2>
                    <p>{t("account.noUpcomingBody")}</p>
                    <Button asChild>
                      <Link href="/rooms">{t("account.exploreRooms")}</Link>
                    </Button>
                  </div>
                ) : (
                  <div className="space-y-5">{upcoming.map(renderBooking)}</div>
                )}
              </section>

              {tab === "bookings" && (
                <section className="mt-10">
                  <div className="section-heading">
                    <h2>{t("account.pastStays")}</h2>
                  </div>
                  {past.length === 0 ? (
                    <p className="tiny-note">{t("account.noPast")}</p>
                  ) : (
                    <div className="space-y-5">{past.map(renderBooking)}</div>
                  )}
                </section>
              )}
            </>
          )}
        </section>
      </div>
    </div>
  );
}
