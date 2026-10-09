import { logout } from "@/server/auth/actions";
import { requireGuest, getCurrentUser } from "@/server/auth/dal";
import { prisma } from "@/lib/prisma";
import { CancelReservationButton } from "@/app/booking/confirmation/cancel-button";
import { cancellationInfoFor } from "@/server/booking/service";
import { loadHotelContext, hotelToday, formatMoney } from "@/server/pricing/context";
import { BookingStatus } from "@/generated/prisma/enums";

type StaffUser = { id: string; name: string; email: string; role: string; isActive: boolean };
type GuestUser = { id: string; firstName: string; lastName: string; email: string | null; isActive: boolean };

export default async function AccountPage() {
  const s = await requireGuest();
  const user = await getCurrentUser();
  const hotel = await loadHotelContext();
  const today = hotelToday(new Date(), hotel.timezone);

  const name =
    user && "name" in user
      ? (user as StaffUser).name
      : user
        ? `${(user as GuestUser).firstName} ${(user as GuestUser).lastName}`
        : "-";

  const bookings = s.guestId
    ? await prisma.booking.findMany({
        where: { guestId: s.guestId },
        orderBy: { createdAt: "desc" },
        include: {
          rooms: {
            include: { room: { include: { roomType: { select: { name: true } } } } },
          },
        },
      })
    : [];

  const upcoming = bookings.filter((b) => b.checkOut.getTime() >= today.getTime());
  const past = bookings.filter((b) => b.checkOut.getTime() < today.getTime());

  const renderBooking = (b: (typeof bookings)[number]) => {
    const cancellation = cancellationInfoFor(b, hotel);
    return (
      <li key={b.id} className="border p-3 rounded-md space-y-1">
        <p>Ref: <span className="font-mono">{b.bookingReference}</span></p>
        <p>
          Dates: {b.checkIn.toISOString().slice(0, 10)} - {b.checkOut.toISOString().slice(0, 10)} ·{" "}
          {b.rooms
            .map((line) => `${line.room.roomType.name} ${line.room.roomNumber}`)
            .join(", ")}
        </p>
        <p>Total: {formatMoney(b.total.toString(), hotel.currency)}</p>
        <p>
          Status: {b.bookingStatus} / {b.paymentStatus}
        </p>
        {b.bookingStatus !== BookingStatus.CANCELLED &&
          (cancellation.guestAllowed ? (
            <CancelReservationButton bookingId={b.id} reference={b.bookingReference} mode="account" />
          ) : (
            <p className="text-sm text-zinc-500">
              Cancellation unavailable
              {cancellation.reason === "too_late_to_cancel" ? " (window passed)" : ""}.
            </p>
          ))}
      </li>
    );
  };

  return (
    <main className="min-h-screen p-6 space-y-6 max-w-3xl mx-auto">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">My account</h1>
        <form action={logout}>
          <button className="border px-3 py-2 rounded-md">Sign out</button>
        </form>
      </div>

      <section className="space-y-2 border p-4 rounded-md">
        <h2 className="text-lg font-medium">Profile</h2>
        <p>Name: {name}</p>
        <p>Email: {user?.email ?? "-"}</p>
        <p>Role: {s.role}</p>
      </section>

      <section className="space-y-4 border p-4 rounded-md">
        <h2 className="text-lg font-medium">Upcoming stays</h2>
        {upcoming.length === 0 && <p>No upcoming bookings.</p>}
        <ul className="space-y-2">{upcoming.map(renderBooking)}</ul>
      </section>

      <section className="space-y-4 border p-4 rounded-md">
        <h2 className="text-lg font-medium">Past stays</h2>
        {past.length === 0 && <p>No past bookings.</p>}
        <ul className="space-y-2">{past.map(renderBooking)}</ul>
      </section>
    </main>
  );
}
