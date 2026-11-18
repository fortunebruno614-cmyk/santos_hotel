"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export type TopNavItem = { href: string; label: string };

export function TopNav({ items }: { items: TopNavItem[] }) {
  const pathname = usePathname();
  return (
    <nav className="hidden min-w-0 items-center gap-0.5 xl:flex" aria-label="Primary">
      {items.map((item) => {
        const active =
          item.href === "/admin"
            ? pathname === "/admin"
            : pathname === item.href || pathname.startsWith(`${item.href}/`);
        return (
          <Link
            key={item.label}
            href={item.href}
            className={`whitespace-nowrap rounded-md px-2.5 py-1.5 text-[12px] font-medium transition-colors ${
              active
                ? "bg-zinc-100 text-zinc-900"
                : "text-zinc-500 hover:bg-zinc-50 hover:text-zinc-900"
            }`}
          >
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
