import Link from "next/link";
import { requireStaffOrAdmin } from "@/server/auth/dal";
import { logout } from "@/server/auth/actions";
import { Permissions, hasPermission } from "@/server/auth/roles";

/**
 * Staff console chrome. The links mirror the P3 access map: staff see the
 * operational sections their permissions allow; settings, content, users and
 * the audit trail are admin-only, and the backend enforces the same split.
 */
export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const session = await requireStaffOrAdmin();
  const isAdmin = hasPermission(session.role, Permissions.MANAGE_USERS);

  const sections = [
    { href: "/admin", label: "Dashboard" },
    { href: "/admin/bookings", label: "Reservations" },
    { href: "/admin/rooms", label: "Rooms" },
    { href: "/admin/room-types", label: "Room types" },
    { href: "/admin/rates", label: "Rates" },
    { href: "/admin/promotions", label: "Promotions" },
    { href: "/admin/guests", label: "Guests" },
    { href: "/admin/payments", label: "Payments" },
    ...(isAdmin
      ? [
          { href: "/admin/users", label: "Users" },
          { href: "/admin/settings", label: "Settings" },
          { href: "/admin/content", label: "Content" },
          { href: "/admin/audit", label: "Audit" },
        ]
      : []),
  ];

  return (
    <div className="min-h-screen flex flex-col">
      <header className="border-b px-6 py-3 flex items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <Link href="/admin" className="font-medium">
            Santo Hotel Admin
          </Link>
          <span className="text-xs text-zinc-500">{session.role}</span>
        </div>
        <form action={logout}>
          <button className="border px-3 py-1 rounded-md">Sign out</button>
        </form>
      </header>
      <nav className="border-b px-6 py-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm">
        {sections.map((section) => (
          <Link key={section.href} href={section.href} className="hover:underline">
            {section.label}
          </Link>
        ))}
      </nav>
      <main className="flex-1 p-6">{children}</main>
    </div>
  );
}
