import Link from "next/link";
import { signOut } from "@/app/actions";
import { createClient } from "@/utils/supabase/server";
import { cookies } from "next/headers";
import { rooms } from "@/app/data/rooms";

export default async function Dashboard() {
  const cookieStore = await cookies();
  const supabase = createClient(cookieStore);
  const { data: { user } } = await supabase.auth.getUser();
  const avatarUrl = user?.user_metadata?.avatar_url ?? "";

  return (
    <>
      <nav className="nav">
        <Link className="brand" href="/">
          Santos<span> Hotel</span>
        </Link>
        <div className="navActions">
          <Link className="btn" href="/">Home</Link>
          <Link className="btn" href="/dashboard/bookings">My Bookings</Link>
          <Link className="btn" href="/dashboard/profile">Profile</Link>
          {avatarUrl && (
            <img
              src={avatarUrl}
              alt="Avatar"
              style={{ width: 36, height: 36, borderRadius: "50%", objectFit: "cover" }}
            />
          )}
          <form action={signOut} style={{ display: "inline" }}>
            <button type="submit" className="btn btnLogout">Log out</button>
          </form>
        </div>
      </nav>

      <main className="roomsSection">
        <h1 className="sectionTitle">Our Rooms & Suites</h1>
        <p className="sectionSubtitle">
          Discover luxury accommodations tailored to your needs. Every room includes complimentary breakfast and 24/7 concierge service.
        </p>

        <div className="roomsGrid">
          {rooms.map((room) => (
            <Link key={room.id} href={`/book/${room.id}`} className="roomCard">
              <div className="roomImageWrap">
                <img
                  src={room.image}
                  alt={room.name}
                  className="roomImage"
                />
                <span className="roomTypeBadge">{room.type}</span>
              </div>
              <div className="roomInfo">
                <div className="roomHeader">
                  <h3>{room.name}</h3>
                  <span className="roomCapacity">{room.capacity} {room.capacity === 1 ? "Guest" : "Guests"}</span>
                </div>
                <p className="roomDesc">{room.desc}</p>
                <div className="roomAmenities">
                  {room.amenities.slice(0, 4).map((a) => (
                    <span key={a} className="amenity">{a}</span>
                  ))}
                  {room.amenities.length > 4 && (
                    <span className="amenity">+{room.amenities.length - 4} more</span>
                  )}
                </div>
                <div className="roomFooter">
                  <span className="roomPrice">₦{room.price.toLocaleString()}<small>/night</small></span>
                  <span className="btn btnPrimary">Book Now</span>
                </div>
              </div>
            </Link>
          ))}
        </div>
      </main>

      <footer className="footer">
        © {new Date().getFullYear()} Santos Hotel. All rights reserved.
      </footer>
    </>
  );
}
