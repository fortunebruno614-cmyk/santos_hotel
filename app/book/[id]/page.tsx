import Link from "next/link";
import { rooms } from "@/app/data/rooms";
import BookingForm from "./booking-form";

export default async function BookPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const room = rooms.find((r) => r.id === Number(id));

  if (!room) {
    return (
      <main className="authPage">
        <div className="authCard">
          <h1>Room not found</h1>
          <Link className="btn btnPrimary" href="/dashboard">Back to dashboard</Link>
        </div>
      </main>
    );
  }

  return (
    <>
      <nav className="nav">
        <Link className="brand" href="/">
          Santos<span> Hotel</span>
        </Link>
        <div className="navActions">
          <Link className="btn" href="/dashboard">Dashboard</Link>
          <Link className="btn" href="/dashboard/bookings">My Bookings</Link>
        </div>
      </nav>

      <main className="bookingPage">
        <Link className="backLink" href="/dashboard">← Back to rooms</Link>

        <div className="bookingCard">
          <div className="bookingRoomInfo">
            <div className="roomImageLargeWrap">
              <img src={room.image} alt={room.name} className="roomImageLarge" />
              <span className="roomTypeBadgeLarge">{room.type}</span>
            </div>
            <h1>{room.name}</h1>
            <div className="roomMeta">
              <span>{room.size}</span>
              <span>{room.bed} Bed</span>
              <span>{room.capacity} {room.capacity === 1 ? "Guest" : "Guests"}</span>
            </div>
            <p className="roomDesc">{room.desc}</p>
            <div className="roomAmenities">
              {room.amenities.map((a) => (
                <span key={a} className="amenity">{a}</span>
              ))}
            </div>
            <div className="roomPriceLarge">₦{room.price.toLocaleString()}<small>/night</small></div>
          </div>

          <div className="bookingForm">
            <h2>Book this room</h2>
            <BookingForm room={room} />
          </div>
        </div>
      </main>

      <footer className="footer">
        © {new Date().getFullYear()} Santos Hotel. All rights reserved.
      </footer>
    </>
  );
}
