import Link from "next/link";
import { SignOutButton } from "@/components/auth/sign-out-button";
import { Permissions, hasOrgPermission } from "@/server/auth/roles";
import {
  accessibleHotels,
  listUserMemberships,
} from "@/server/auth/tenancy";
import { switchHotel, switchOrganization } from "@/server/auth/tenant-actions";
import { getConsoleContext } from "@/server/console/context";

/**
 * Staff console chrome. The active organization/property context is always
 * visible where data can change (NFR-016) and can only be switched through
 * server-side membership checks.
 */
export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const { session, member, hotel } = await getConsoleContext();
  const [memberships, hotels] = await Promise.all([
    listUserMemberships(session.userId!),
    accessibleHotels(member),
  ]);
  const isAdmin = hasOrgPermission(member.role, Permissions.MANAGE_USERS);

  const sections = [
    { href: "/admin", label: "Dashboard" },
    ...(hasOrgPermission(member.role, Permissions.MANAGE_HOTELS)
      ? [{ href: "/admin/hotels", label: "Hotels" }]
      : []),
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
      <header className="border-b px-6 py-3 flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <Link href="/admin" className="font-medium">
            {member.organization.name} Admin
          </Link>
          <span className="text-xs text-zinc-500">
            {member.role} · {session.email ?? session.userId}
          </span>
        </div>
        <div className="flex flex-wrap items-center gap-3 text-sm">
          {memberships.length > 1 && (
            <form action={switchOrganization} className="flex items-center gap-1">
              <label htmlFor="orgId" className="text-xs text-zinc-500">
                Organization
              </label>
              <select
                id="orgId"
                name="orgId"
                defaultValue={member.organizationId}
                className="border px-2 py-1 rounded-md"
              >
                {memberships.map((entry) => (
                  <option key={entry.organizationId} value={entry.organizationId}>
                    {entry.organization.name}
                  </option>
                ))}
              </select>
              <button className="border px-2 py-1 rounded-md">Switch</button>
            </form>
          )}
          {hotels.length > 1 && (
            <form action={switchHotel} className="flex items-center gap-1">
              <label htmlFor="hotelId" className="text-xs text-zinc-500">
                Property
              </label>
              <select
                id="hotelId"
                name="hotelId"
                defaultValue={hotel.id}
                className="border px-2 py-1 rounded-md"
              >
                {hotels.map((entry) => (
                  <option key={entry.id} value={entry.id}>
                    {entry.name}
                  </option>
                ))}
              </select>
              <button className="border px-2 py-1 rounded-md">Switch</button>
            </form>
          )}
          {session.platformRole && (
            <Link href="/platform" className="border px-2 py-1 rounded-md">
              Platform ({session.platformRole})
            </Link>
          )}
          <SignOutButton label="Sign out" variant="outline" size="sm" />
        </div>
      </header>
      <div className="border-b bg-zinc-50 px-6 py-1 text-xs text-zinc-600 dark:bg-zinc-900 dark:text-zinc-300">
        Active property: <strong>{hotel.name}</strong> · {hotel.currency} ·{" "}
        {hotel.publicationStatus}
      </div>
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
