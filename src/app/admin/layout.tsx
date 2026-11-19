import Link from "next/link";
import {
  Bell,
  Download,
  LayoutDashboard,
  Settings2,
  ShieldCheck,
  Sparkles,
} from "lucide-react";
import { SignOutButton } from "@/components/auth/sign-out-button";
import { userInitials } from "@/components/auth/user-avatar";
import { TopNav, type TopNavItem } from "@/components/dashboard/top-nav";
import { WorkspaceSwitcher } from "@/components/dashboard/workspace-switcher";
import { Permissions, hasOrgPermission, type Permission } from "@/server/auth/roles";
import { accessibleHotels, listUserMemberships } from "@/server/auth/tenancy";
import { getConsoleContext } from "@/server/console/context";
import "./admin.css";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const { session, member, hotel } = await getConsoleContext();
  const [memberships, hotels] = await Promise.all([
    listUserMemberships(session.userId!),
    accessibleHotels(member),
  ]);

  const can = (permission: Permission) => hasOrgPermission(member.role, permission);

  const primary: TopNavItem[] = [
    { href: "/admin", label: "Dashboard" },
    { href: "/admin/payments", label: "Financials" },
    ...(can(Permissions.VIEW_GUESTS) ? [{ href: "/admin/guests", label: "Customers" }] : []),
    { href: "/admin/bookings", label: "Operations" },
    ...(can(Permissions.MANAGE_AUDIT) ? [{ href: "/admin/audit", label: "Reports" }] : []),
    { href: "/admin?range=90d#insights", label: "Insights" },
    ...(can(Permissions.MANAGE_USERS) ? [{ href: "/admin/users", label: "Employees" }] : []),
  ];

  const management = [
    ...(can(Permissions.MANAGE_HOTELS) ? [{ href: "/admin/hotels", label: "Portfolio" }] : []),
    ...(can(Permissions.MANAGE_ROOMS)
      ? [
          { href: "/admin/rooms", label: "Rooms" },
          { href: "/admin/room-types", label: "Room types" },
          { href: "/admin/amenities", label: "Amenities" },
        ]
      : []),
    ...(can(Permissions.MANAGE_RATES) ? [{ href: "/admin/rates", label: "Rates" }] : []),
    ...(can(Permissions.MANAGE_PROMOTIONS)
      ? [{ href: "/admin/promotions", label: "Promotions" }]
      : []),
    ...(can(Permissions.MANAGE_CONTENT) ? [{ href: "/admin/content", label: "Content" }] : []),
    ...(can(Permissions.MANAGE_SETTINGS) ? [{ href: "/admin/settings", label: "Settings" }] : []),
    ...(can(Permissions.MANAGE_AUDIT) ? [{ href: "/admin/audit", label: "Audit" }] : []),
    ...(can(Permissions.MANAGE_SETTINGS)
      ? [{ href: "/admin/notifications", label: "Notifications" }]
      : []),
  ];
  const displayName = session.email ?? session.userId ?? "Operator";

  return (
    <div className="admin-shell flex min-h-screen flex-col bg-[#f7f8fa] text-zinc-900">
      <header className="sticky top-0 z-40 border-b border-zinc-200 bg-white/95 backdrop-blur">
        <div className="mx-auto flex h-14 max-w-[1600px] items-center gap-3 px-4 lg:px-6">
          <Link href="/admin" className="flex shrink-0 items-center gap-2">
            <span className="flex h-7 w-7 items-center justify-center rounded-md bg-zinc-900 text-[11px] font-bold text-white">
              S
            </span>
            <span className="hidden leading-none sm:block">
              <span className="block text-[13px] font-semibold tracking-tight text-zinc-900">
                Santo<span className="text-emerald-700">.</span>
              </span>
              <span className="block text-[8px] font-medium uppercase tracking-[0.16em] text-zinc-400">
                Hotel OS
              </span>
            </span>
          </Link>

          <span className="hidden h-6 w-px bg-zinc-200 sm:block" />

          <WorkspaceSwitcher
            organizations={memberships.map((entry) => ({
              id: entry.organizationId,
              name: entry.organization.name,
            }))}
            hotels={hotels.map((entry) => ({ id: entry.id, name: entry.name }))}
            currentOrganizationId={member.organizationId}
            currentHotelId={hotel.id}
            organizationName={member.organization.name}
            hotelName={hotel.name}
          />

          <div className="min-w-0 flex-1 pl-1">
            <TopNav items={primary} />
          </div>

          <div className="ml-auto flex shrink-0 items-center gap-1.5">
            {can(Permissions.VIEW_REPORTS) && (
              <a
                href="/api/admin/reports/transactions?range=30d"
                className="hidden h-8 items-center gap-1.5 rounded-md bg-emerald-700 px-2.5 text-[11px] font-medium text-white shadow-sm hover:bg-emerald-800 sm:inline-flex"
              >
                <Download size={12} />
                Generate report
              </a>
            )}
            <Link
              href="/admin/notifications"
              className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-zinc-200 bg-white text-zinc-500 shadow-sm hover:bg-zinc-50 hover:text-zinc-900"
              aria-label="Notifications"
            >
              <Bell size={14} />
            </Link>
            <details className="relative">
              <summary className="flex cursor-pointer list-none items-center gap-1.5 rounded-md border border-zinc-200 bg-white py-0.5 pl-0.5 pr-2 shadow-sm hover:bg-zinc-50">
                <span className="flex h-7 w-7 items-center justify-center rounded-full bg-zinc-900 text-[10px] font-semibold text-white">
                  {userInitials(displayName)}
                </span>
                <span className="hidden max-w-[120px] truncate text-[11px] font-medium text-zinc-700 md:block">
                  {session.email ?? "Account"}
                </span>
              </summary>
              <div className="absolute right-0 z-50 mt-1 w-56 rounded-lg border border-zinc-200 bg-white p-2 text-[11px] shadow-xl">
                <div className="border-b border-zinc-100 px-2 pb-2">
                  <p className="truncate font-medium text-zinc-800">{session.email ?? session.userId}</p>
                  <p className="text-[10px] capitalize text-zinc-400">
                    {member.role.toLowerCase()} · {member.organization.name}
                  </p>
                </div>
                <div className="py-1">
                  <Link
                    href="/admin/settings"
                    className="flex items-center gap-2 rounded px-2 py-1.5 text-zinc-600 hover:bg-zinc-50"
                  >
                    <Settings2 size={12} /> Property settings
                  </Link>
                  {session.platformRole && (
                    <Link
                      href="/platform"
                      className="flex items-center gap-2 rounded px-2 py-1.5 text-zinc-600 hover:bg-zinc-50"
                    >
                      <ShieldCheck size={12} /> Platform console
                    </Link>
                  )}
                  <Link
                    href="/"
                    className="flex items-center gap-2 rounded px-2 py-1.5 text-zinc-600 hover:bg-zinc-50"
                  >
                    <Sparkles size={12} /> View public site
                  </Link>
                </div>
                <div className="border-t border-zinc-100 pt-1">
                  <SignOutButton
                    label="Sign out"
                    icon
                    variant="ghost"
                    size="sm"
                    className="h-7 w-full justify-start px-2 text-[11px]"
                  />
                </div>
              </div>
            </details>
          </div>
        </div>

        <div className="border-t border-zinc-100 lg:hidden">
          <div className="flex items-center gap-1 overflow-x-auto px-3 py-1.5 text-[11px]">
            {primary.map((item) => (
              <Link
                key={item.label}
                href={item.href}
                className="shrink-0 rounded px-2 py-1 font-medium text-zinc-600 hover:bg-zinc-100"
              >
                {item.label}
              </Link>
            ))}
          </div>
        </div>
        <div className="border-t border-zinc-100">
          <div className="mx-auto flex max-w-[1600px] items-center gap-3 overflow-x-auto px-4 py-1.5 text-[11px] lg:px-6">
            <span className="inline-flex shrink-0 items-center gap-1 text-[9px] font-medium uppercase tracking-[0.12em] text-zinc-400">
              <LayoutDashboard size={11} /> Manage
            </span>
            {management.map((item) => (
              <Link
                key={`${item.href}-${item.label}`}
                href={item.href}
                className="shrink-0 rounded px-1.5 py-1 font-medium text-zinc-500 hover:bg-zinc-100 hover:text-zinc-900"
              >
                {item.label}
              </Link>
            ))}
            <span className="ml-auto hidden shrink-0 items-center gap-1 text-[9px] text-zinc-400 md:flex">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
              {hotel.name} · {hotel.publicationStatus.toLowerCase()} · {hotel.currency}
            </span>
          </div>
        </div>
      </header>

      <main className="flex-1 p-6">{children}</main>
    </div>
  );
}
