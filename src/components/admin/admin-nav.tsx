"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  BedDouble,
  Building2,
  CalendarDays,
  CreditCard,
  FileText,
  History,
  LayoutDashboard,
  LayoutGrid,
  Mail,
  Settings,
  Sparkles,
  Tag,
  Ticket,
  UserCog,
  Users,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";

export type NavItem = { href: string; label: string };
export type NavGroup = { label: string; items: NavItem[] };

const ICONS: Record<string, LucideIcon> = {
  "/admin": LayoutDashboard,
  "/admin/bookings": CalendarDays,
  "/admin/guests": Users,
  "/admin/payments": CreditCard,
  "/admin/rooms": BedDouble,
  "/admin/room-types": LayoutGrid,
  "/admin/amenities": Sparkles,
  "/admin/rates": Tag,
  "/admin/promotions": Ticket,
  "/admin/hotels": Building2,
  "/admin/users": UserCog,
  "/admin/settings": Settings,
  "/admin/notifications": Mail,
  "/admin/content": FileText,
  "/admin/audit": History,
};

function isActive(pathname: string, href: string) {
  if (href === "/admin") return pathname === "/admin";
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function AdminNav({
  groups,
  variant = "sidebar",
}: {
  groups: NavGroup[];
  variant?: "sidebar" | "bar";
}) {
  const pathname = usePathname();

  if (variant === "bar") {
    return (
      <nav className="flex items-center gap-1 overflow-x-auto px-4 py-2" aria-label="Console sections">
        {groups.flatMap((group) =>
          group.items.map((item) => {
            const active = isActive(pathname, item.href);
            const Icon = ICONS[item.href];
            return (
              <Link
                key={item.href}
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "inline-flex shrink-0 items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium transition-colors",
                  active
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:bg-muted hover:text-foreground",
                )}
              >
                {Icon && <Icon className="size-3.5" />}
                {item.label}
              </Link>
            );
          }),
        )}
      </nav>
    );
  }

  return (
    <nav className="flex flex-col gap-6 px-3 py-4" aria-label="Console sections">
      {groups.map((group) => (
        <div key={group.label} className="space-y-1">
          <p className="px-3 pb-1 text-[0.65rem] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
            {group.label}
          </p>
          {group.items.map((item) => {
            const active = isActive(pathname, item.href);
            const Icon = ICONS[item.href];
            return (
              <Link
                key={item.href}
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "group flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm transition-colors",
                  active
                    ? "bg-primary/10 font-medium text-primary"
                    : "text-foreground/80 hover:bg-muted hover:text-foreground",
                )}
              >
                {Icon && (
                  <Icon
                    className={cn(
                      "size-4 shrink-0",
                      active ? "text-primary" : "text-muted-foreground group-hover:text-foreground",
                    )}
                  />
                )}
                <span className="truncate">{item.label}</span>
              </Link>
            );
          })}
        </div>
      ))}
    </nav>
  );
}
