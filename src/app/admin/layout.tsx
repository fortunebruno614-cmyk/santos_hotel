import Link from "next/link";
import { requireStaffOrAdmin } from "@/server/auth/dal";
import { logout } from "@/server/auth/actions";
import { Permissions, hasPermission } from "@/server/auth/roles";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const session = await requireStaffOrAdmin();
  return (
    <div className="min-h-screen flex flex-col">
      <header className="border-b px-6 py-3 flex items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <Link href="/admin" className="font-medium">
            Santo Hotel Admin
          </Link>
          <nav className="flex items-center gap-3 text-sm">
            <Link href="/admin/bookings" className="hover:underline">
              Reservations
            </Link>
            <Link href="/admin/rooms" className="hover:underline">
              Rooms
            </Link>
            {hasPermission(session.role, Permissions.MANAGE_USERS) && (
              <Link href="/admin/users" className="hover:underline">
                Users
              </Link>
            )}
          </nav>
        </div>
        <form action={logout}>
          <button className="border px-3 py-1 rounded-md">Sign out</button>
        </form>
      </header>
      <main className="flex-1 p-6">{children}</main>
    </div>
  );
}
