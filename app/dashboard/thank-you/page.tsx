import Link from "next/link";
import { createClient } from "@/utils/supabase/server";
import { cookies } from "next/headers";
import { rooms } from "@/app/data/rooms";
import BookingConfirmedPopup from "@/app/components/booking-confirmed-popup";

export default async function ThankYouPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const params = await searchParams;
  const bookingId = typeof params.id === "string" ? params.id : null;

  let booking: {
    room_id: number;
    room_name: string;
    checkin: string;
    checkout: string;
    guests: number;
    full_name: string;
    email: string;
    total_price: number;
  } | null = null;
  let room = null;

  if (bookingId) {
    const cookieStore = await cookies();
    const supabase = createClient(cookieStore);

    const result = await supabase
      .from("bookings")
      .select("*")
      .eq("id", bookingId)
      .single();

    booking = result.data as {
      room_id: number;
      room_name: string;
      checkin: string;
      checkout: string;
      guests: number;
      full_name: string;
      email: string;
      total_price: number;
    } | null;
    if (booking) {
      const b = booking;
      room = rooms.find((r) => r.id === b.room_id) ?? null;
    }
  }

  const checkin = booking ? new Date(booking.checkin) : null;
  const checkout = booking ? new Date(booking.checkout) : null;
  const nights = checkin && checkout
    ? Math.ceil((checkout.getTime() - checkin.getTime()) / (1000 * 60 * 60 * 24))
    : 0;

  return (
    <>
      {booking && (
        <BookingConfirmedPopup
          booking={{
            bookingId: bookingId!,
            roomName: booking.room_name,
            checkin: booking.checkin,
            checkout: booking.checkout,
            totalPrice: booking.total_price,
            guestName: booking.full_name,
          }}
        />
      )}

      <nav className="nav">
        <Link className="brand" href="/">
          Santos<span> Hotel</span>
        </Link>
        <div className="navActions">
          <Link className="btn" href="/dashboard">Dashboard</Link>
        </div>
      </nav>

      <main className="confirmationPage">
        <div className="confirmationCard">
          <div className="confirmationCheck">✓</div>
          <h1>Thank You for Booking with Us!</h1>
          <p className="confirmationSubtitle">
            Your reservation at Santos Hotel has been confirmed. We look forward to welcoming you.
          </p>

          {room && booking && (
            <>
              <div className="confirmationRoomImage">
                <img src={room.image} alt={booking.room_name} />
              </div>

              <div className="confirmationDetails">
                <div className="confirmationRow">
                  <span className="confirmationLabel">Room</span>
                  <span className="confirmationValue">{booking.room_name}</span>
                </div>
                <div className="confirmationRow">
                  <span className="confirmationLabel">Check-in</span>
                  <span className="confirmationValue">
                    {checkin!.toLocaleDateString("en-NG", { weekday: "long", year: "numeric", month: "long", day: "numeric" })}, 2:00 PM
                  </span>
                </div>
                <div className="confirmationRow">
                  <span className="confirmationLabel">Check-out</span>
                  <span className="confirmationValue">
                    {checkout!.toLocaleDateString("en-NG", { weekday: "long", year: "numeric", month: "long", day: "numeric" })}, 12:00 PM
                  </span>
                </div>
                <div className="confirmationRow">
                  <span className="confirmationLabel">Guests</span>
                  <span className="confirmationValue">{booking.guests}</span>
                </div>
                <div className="confirmationRow">
                  <span className="confirmationLabel">Nights</span>
                  <span className="confirmationValue">{nights}</span>
                </div>
                <div className="confirmationRow">
                  <span className="confirmationLabel">Guest Name</span>
                  <span className="confirmationValue">{booking.full_name}</span>
                </div>
                <div className="confirmationRow confirmationTotal">
                  <span className="confirmationLabel">Total Paid</span>
                  <span className="confirmationValue">₦{Number(booking.total_price).toLocaleString()}</span>
                </div>
              </div>

              <div className="confirmationArrow">
                A confirmation email has been sent to {booking.email}
              </div>
            </>
          )}

          <div className="confirmationActions">
            <Link className="btn btnPrimary btnLarge" href="/dashboard/bookings">
              View My Bookings →
            </Link>
            <Link className="btn btnLarge" href="/dashboard">
              Back to Dashboard
            </Link>
          </div>
        </div>
      </main>

      <footer className="footer">
        © {new Date().getFullYear()} Santos Hotel. All rights reserved.
      </footer>
    </>
  );
}
