import { logout } from "@/server/auth/actions";
import { requireGuest, getCurrentUser } from "@/server/auth/dal";
import { prisma } from "@/lib/prisma";

type StaffUser = { id: string; name: string; email: string; role: string; isActive: boolean };
type GuestUser = { id: string; firstName: string; lastName: string; email: string | null; isActive: boolean };

export default async function AccountPage() {
  const s = await requireGuest();
  const user = await getCurrentUser();

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
        select: {
          id: true,
          bookingReference: true,
          checkIn: true,
          checkOut: true,
          total: true,
          bookingStatus: true,
          paymentStatus: true,
        },
      })
    : [];

  return (
    <main className="min-h-screen p-6 space-y-6">
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
        <h2 className="text-lg font-medium">Booking history</h2>
        {bookings.length === 0 && <p>No bookings yet.</p>}
        <ul className="space-y-2">
          {bookings.map((b) => (
            <li key={b.id} className="border p-3 rounded-md">
              <p>Ref: {b.bookingReference}</p>
              <p>
                Dates: {new Date(b.checkIn).toLocaleDateString()} -{" "}
                {new Date(b.checkOut).toLocaleDateString()}
              </p>
              <p>Total: {b.total.toString()} MYR</p>
              <p>
                Status: {b.bookingStatus} / {b.paymentStatus}
              </p>
            </li>
          ))}
        </ul>
      </section>
    </main>
  );
}
