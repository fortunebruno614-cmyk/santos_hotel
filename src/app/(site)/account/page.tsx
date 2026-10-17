import Link from "next/link";
import { ArrowRight, CalendarDays, LogOut, UserRound } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Breadcrumb, PageHeading } from "@/components/hotel/shared";
import { CancelReservationButton } from "@/components/hotel/cancel-button";
import { logout } from "@/server/auth/actions";
import { requireGuest, getCurrentUser } from "@/server/auth/dal";
import { prisma } from "@/lib/prisma";
import { cancellationInfoFor } from "@/server/booking/service";
import { loadHotelContext, hotelToday } from "@/server/pricing/context";
import { BookingStatus } from "@/generated/prisma/enums";
import { fallbackImageForSlug, formatMoney as publicMoney } from "@/lib/hotel";

export default async function AccountPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const sp = await searchParams;
  const tab = sp.tab === "profile" || sp.tab === "bookings" ? sp.tab : "overview";
  const session = await requireGuest();
  const user = await getCurrentUser();
  const hotel = await loadHotelContext();
  const today = hotelToday(new Date(), hotel.timezone);

  const guest = user && "firstName" in user ? user : null;
  const name = guest ? `${guest.firstName} ${guest.lastName}` : "Guest";

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
    const cancellation = cancellationInfoFor(booking, hotel);
    const roomName = booking.rooms[0]?.room.roomType.name ?? "Santo stay";
    const image = imageByName.get(roomName) ?? fallbackImageForSlug("");
    const total = publicMoney(booking.total.toString(), hotel.currency);
    return (
      <article className="account-booking" key={booking.id}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={image} alt={roomName} />
        <div>
          <span className="subtle-badge">
            {booking.bookingStatus.replaceAll("_", " ")} · {booking.paymentStatus}
          </span>
          <h3>{roomName}</h3>
          <p>
            {booking.checkIn.toISOString().slice(0, 10)} — {booking.checkOut.toISOString().slice(0, 10)}
          </p>
          <p>
            {booking.adults} adult{booking.adults === 1 ? "" : "s"}
            {booking.children > 0 ? ` · ${booking.children} children` : ""} ·{" "}
            {booking.rooms.length} room{booking.rooms.length === 1 ? "" : "s"}
          </p>
          <p>Total: {total}</p>
          <small>Reference: {booking.bookingReference}</small>
          <div className="confirmation-actions">
            <Button asChild variant="link">
              <Link href={`/booking/confirmation?ref=${encodeURIComponent(booking.bookingReference)}`}>
                View reservation <ArrowRight />
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
                <p className="tiny-note">Online cancellation is no longer available.</p>
              ))}
          </div>
        </div>
      </article>
    );
  };

  return (
    <div className="container page-content">
      <Breadcrumb current="My Santo" />
      <PageHeading
        eyebrow="MY SANTO"
        title={`Welcome back, ${guest?.firstName ?? "guest"}.`}
        description="Your stays, your details, all in one place."
      />

      <div className="account-layout">
        <nav className="account-nav">
          <Button asChild variant={tab === "overview" ? "secondary" : "ghost"}>
            <Link href="/account">
              <CalendarDays />
              Overview
            </Link>
          </Button>
          <Button asChild variant={tab === "bookings" ? "secondary" : "ghost"}>
            <Link href="/account?tab=bookings">
              <CalendarDays />
              My bookings
            </Link>
          </Button>
          <Button asChild variant={tab === "profile" ? "secondary" : "ghost"}>
            <Link href="/account?tab=profile">
              <UserRound />
              Profile details
            </Link>
          </Button>
          <form action={logout}>
            <Button type="submit" variant="ghost">
              <LogOut />
              Sign out
            </Button>
          </form>
        </nav>

        <section>
          {tab === "profile" ? (
            <div className="form-section">
              <h2>Your details</h2>
              <p className="tiny-note">Contact the hotel to update your profile details.</p>
              <div className="review-details">
                <span>
                  Name<strong>{name}</strong>
                </span>
                <span>
                  Email address<strong>{guest?.email ?? "-"}</strong>
                </span>
              </div>
              <Button asChild className="mt-6">
                <Link href="/contact">Contact the hotel</Link>
              </Button>
            </div>
          ) : (
            <>
              <section>
                <div className="section-heading">
                  <h2>{tab === "overview" ? "Your next stay" : "My bookings"}</h2>
                  <span className="subtle-badge">Live reservations</span>
                </div>
                {upcoming.length === 0 ? (
                  <div className="empty-state">
                    <h2>No upcoming stays yet.</h2>
                    <p>Your next Santo moment is waiting to be planned.</p>
                    <Button asChild>
                      <Link href="/rooms">Explore rooms</Link>
                    </Button>
                  </div>
                ) : (
                  <div className="space-y-5">{upcoming.map(renderBooking)}</div>
                )}
              </section>

              {tab === "bookings" && (
                <section className="mt-10">
                  <div className="section-heading">
                    <h2>Past stays</h2>
                  </div>
                  {past.length === 0 ? (
                    <p className="tiny-note">No past stays yet.</p>
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
