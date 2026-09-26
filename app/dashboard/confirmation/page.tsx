import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/utils/supabase/server";
import { cookies } from "next/headers";
import { rooms } from "@/app/data/rooms";

export default async function ConfirmationPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const params = await searchParams;
  const bookingId = typeof params.id === "string" ? params.id : null;

  if (!bookingId) {
    redirect("/dashboard");
  }

  const cookieStore = await cookies();
  const supabase = createClient(cookieStore);

  const { data: booking } = await supabase
    .from("bookings")
    .select("*")
    .eq("id", bookingId)
    .single();

  if (!booking) {
    redirect("/dashboard");
  }

  const room = rooms.find((r) => r.id === booking.room_id);
  const checkin = new Date(booking.checkin);
  const checkout = new Date(booking.checkout);
  const nights = Math.ceil(
    (checkout.getTime() - checkin.getTime()) / (1000 * 60 * 60 * 24)
  );

  return (
    <>
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
          <h1>Thank You for Booking!</h1>
          <p className="confirmationSubtitle">
            Your reservation at Santos Hotel has been confirmed. We look forward to welcoming you.
          </p>

          {room && (
            <div className="confirmationRoomImage">
              <img src={room.image} alt={booking.room_name} />
            </div>
          )}

          <div className="confirmationDetails">
            <div className="confirmationRow">
              <span className="confirmationLabel">Room</span>
              <span className="confirmationValue">{booking.room_name}</span>
            </div>
            <div className="confirmationRow">
              <span className="confirmationLabel">Check-in</span>
              <span className="confirmationValue">
                {checkin.toLocaleDateString("en-NG", { weekday: "long", year: "numeric", month: "long", day: "numeric" })}, 2:00 PM
              </span>
            </div>
            <div className="confirmationRow">
              <span className="confirmationLabel">Check-out</span>
              <span className="confirmationValue">
                {checkout.toLocaleDateString("en-NG", { weekday: "long", year: "numeric", month: "long", day: "numeric" })}, 12:00 PM
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
            <div className="confirmationRow">
              <span className="confirmationLabel">Email</span>
              <span className="confirmationValue">{booking.email}</span>
            </div>
            <div className="confirmationRow">
              <span className="confirmationLabel">Phone</span>
              <span className="confirmationValue">{booking.phone}</span>
            </div>
            <div className="confirmationRow confirmationTotal">
              <span className="confirmationLabel">Total Paid</span>
              <span className="confirmationValue">₦{Number(booking.total_price).toLocaleString()}</span>
            </div>
            {booking.payment_reference && (
              <div className="confirmationRow">
                <span className="confirmationLabel">Payment Ref</span>
                <span className="confirmationValue">{booking.payment_reference}</span>
              </div>
            )}
          </div>

          <div className="confirmationArrow">
            <span>A confirmation email has been sent to {booking.email}</span>
          </div>

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
