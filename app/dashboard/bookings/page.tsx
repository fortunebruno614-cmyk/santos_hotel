import Link from "next/link";
import { redirect } from "next/navigation";
import { signOut, getBookings } from "@/app/actions";
import { createClient } from "@/utils/supabase/server";
import { cookies } from "next/headers";
import BookingList from "./booking-list";

export default async function BookingsPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const cookieStore = await cookies();
  const supabase = createClient(cookieStore);
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const bookings = await getBookings();
  const params = await searchParams;
  const message = typeof params.message === "string" ? params.message : null;

  return (
    <>
      <nav className="nav">
        <Link className="brand" href="/">
          Santos<span> Hotel</span>
        </Link>
        <div className="navActions">
          <Link className="btn" href="/dashboard">Dashboard</Link>
          <Link className="btn" href="/dashboard/profile">Profile</Link>
          <form action={signOut} style={{ display: "inline" }}>
            <button type="submit" className="btn btnLogout">Log out</button>
          </form>
        </div>
      </nav>

      <main className="roomsSection">
        <h1 className="sectionTitle">My Bookings</h1>
        <p className="sectionSubtitle">View and manage your hotel reservations.</p>

        {message && <div className="message" style={{ marginBottom: 24 }}>{message}</div>}

        <BookingList bookings={bookings} />
      </main>

      <footer className="footer">
        © {new Date().getFullYear()} Santos Hotel. All rights reserved.
      </footer>
    </>
  );
}
