"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  Activity,
  BarChart3,
  Bell,
  Building2,
  ChevronsUpDown,
  Command,
  ExternalLink,
  Hotel,
  LayoutDashboard,
  LogOut,
  Menu,
  PanelLeftClose,
  PanelLeftOpen,
  RefreshCw,
  Search,
  ShieldCheck,
  Sparkles,
  UserPlus,
  Users,
  X,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { logout } from "@/server/auth/actions";

type NavItem = {
  href: string;
  label: string;
  icon: LucideIcon;
  badge?: number;
  exact?: boolean;
};

export type PlatformSearchItem = {
  href: string;
  label: string;
  hint: string;
  group: "Organizations" | "Properties" | "Navigate";
};

function isActive(pathname: string, item: { href: string; exact?: boolean }) {
  if (item.exact) return pathname === item.href;
  return pathname === item.href || pathname.startsWith(`${item.href}/`);
}

const CRUMB_LABELS: Record<string, string> = {
  platform: "Platform",
  organizations: "Organizations",
  properties: "Properties",
  verification: "Verification",
  analytics: "Analytics",
  activity: "Activity",
  operators: "Operators",
  hotels: "Properties",
  new: "Onboard",
  login: "Sign in",
};

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function initials(name: string) {
  const parts = name.trim().split(/\s+/).slice(0, 2);
  return parts.map((part) => part[0]?.toUpperCase()).join("") || "OP";
}

export function PlatformShell({
  operator,
  pendingVerification,
  pendingReviews,
  organizations,
  searchItems,
  children,
}: {
  operator: { name: string; email: string; role: string };
  pendingVerification: number;
  pendingReviews: number;
  organizations: Array<{ id: string; name: string; slug: string }>;
  searchItems: PlatformSearchItem[];
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState(0);
  const [refreshing, setRefreshing] = useState(false);
  const inputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setPaletteOpen((open) => !open);
        setQuery("");
        setSelected(0);
      }
      if (event.key === "Escape") setPaletteOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  useEffect(() => {
    if (paletteOpen) {
      const timer = window.setTimeout(() => inputRef.current?.focus(), 30);
      return () => window.clearTimeout(timer);
    }
  }, [paletteOpen]);

  const navGroups: Array<{ label: string; items: NavItem[] }> = [
    {
      label: "Workspace",
      items: [{ href: "/platform", label: "Overview", icon: LayoutDashboard, exact: true }],
    },
    {
      label: "Marketplace",
      items: [
        { href: "/platform/organizations", label: "Organizations", icon: Building2 },
        { href: "/platform/properties", label: "Properties", icon: Hotel },
        {
          href: "/platform/verification",
          label: "Verification",
          icon: ShieldCheck,
          badge: pendingVerification,
        },
        { href: "/platform/organizations/new", label: "Onboard business", icon: UserPlus },
      ],
    },
    {
      label: "Operations",
      items: [
        { href: "/platform/analytics", label: "Analytics", icon: BarChart3 },
        { href: "/platform/activity", label: "Activity", icon: Activity },
        { href: "/platform/operators", label: "Operators", icon: Users },
      ],
    },
  ];

  const paletteItems = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return searchItems.slice(0, 14);
    return searchItems
      .filter(
        (item) =>
          item.label.toLowerCase().includes(needle) ||
          item.hint.toLowerCase().includes(needle) ||
          item.group.toLowerCase().includes(needle),
      )
      .slice(0, 14);
  }, [query, searchItems]);

  const breadcrumbs = useMemo(() => {
    const segments = pathname.split("/").filter(Boolean);
    const crumbs: Array<{ label: string; href: string }> = [];
    let accumulated = "";
    for (const segment of segments) {
      accumulated += `/${segment}`;
      const label = UUID.test(segment)
        ? "Details"
        : CRUMB_LABELS[segment] ?? segment.replace(/-/g, " ");
      crumbs.push({ label, href: accumulated });
    }
    return crumbs;
  }, [pathname]);

  const currentOrganization = useMemo(() => {
    const match = pathname.match(/^\/platform\/organizations\/([0-9a-f-]{36})/i);
    return match ? organizations.find((org) => org.id === match[1])?.id ?? "" : "";
  }, [organizations, pathname]);

  const openItem = (href: string) => {
    setPaletteOpen(false);
    setQuery("");
    router.push(href);
  };

  const notificationCount = pendingVerification + pendingReviews;

  const sidebar = (
    <div className="flex h-full flex-col bg-[#0b1220]">
      <div
        className={cn(
          "flex h-16 shrink-0 items-center gap-3 border-b border-white/[0.07] px-4",
          collapsed && "justify-center px-2",
        )}
      >
        <Link href="/platform" className="flex min-w-0 items-center gap-2.5">
          <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-cyan-400 to-blue-600 text-[#031018] shadow-[0_0_24px_rgba(6,182,212,0.25)]">
            <Sparkles className="size-4" />
          </span>
          {!collapsed && (
            <span className="min-w-0 leading-none">
              <span className="block truncate text-sm font-semibold text-slate-50">
                Santo Platform
              </span>
              <span className="mt-1 block text-[0.58rem] font-medium uppercase tracking-[0.22em] text-slate-500">
                Marketplace OS
              </span>
            </span>
          )}
        </Link>
        <button
          type="button"
          onClick={() => setCollapsed((value) => !value)}
          className={cn(
            "ml-auto hidden size-7 items-center justify-center rounded-md text-slate-500 transition-colors hover:bg-white/[0.06] hover:text-slate-200 lg:flex",
            collapsed && "absolute left-[58px] top-5 z-10",
          )}
          aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
        >
          {collapsed ? <PanelLeftOpen className="size-4" /> : <PanelLeftClose className="size-4" />}
        </button>
      </div>

      <nav className="flex-1 overflow-y-auto px-2.5 py-4">
        {navGroups.map((group) => (
          <div key={group.label} className="mb-5">
            {!collapsed && (
              <p className="mb-1.5 px-2.5 text-[0.58rem] font-semibold uppercase tracking-[0.18em] text-slate-600">
                {group.label}
              </p>
            )}
            <div className="space-y-0.5">
              {group.items.map((item) => {
                const active = isActive(pathname, item);
                const Icon = item.icon;
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    title={collapsed ? item.label : undefined}
                    aria-current={active ? "page" : undefined}
                    className={cn(
                      "group relative flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-[0.8rem] transition-colors",
                      active
                        ? "bg-cyan-400/10 font-medium text-cyan-300"
                        : "text-slate-400 hover:bg-white/[0.05] hover:text-slate-100",
                      collapsed && "justify-center px-0",
                    )}
                  >
                    {active && (
                      <span className="absolute left-0 top-1/2 h-4 w-0.5 -translate-y-1/2 rounded-r bg-cyan-400" />
                    )}
                    <Icon className="size-4 shrink-0" />
                    {!collapsed && <span className="truncate">{item.label}</span>}
                    {!collapsed && item.badge ? (
                      <span className="ml-auto rounded-full bg-amber-400/15 px-1.5 py-0.5 text-[0.6rem] font-semibold text-amber-300">
                        {item.badge}
                      </span>
                    ) : null}
                    {collapsed && item.badge ? (
                      <span className="absolute right-1 top-1 size-1.5 rounded-full bg-amber-400" />
                    ) : null}
                  </Link>
                );
              })}
            </div>
          </div>
        ))}
      </nav>

      <div className="shrink-0 border-t border-white/[0.07] p-3">
        {!collapsed ? (
          <div className="rounded-xl border border-white/[0.06] bg-white/[0.025] p-3">
            <div className="flex items-center gap-2.5">
              <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-cyan-400/80 to-blue-600/80 text-[0.65rem] font-bold text-[#031018]">
                {initials(operator.name)}
              </span>
              <div className="min-w-0">
                <p className="truncate text-xs font-medium text-slate-100">{operator.name}</p>
                <p className="truncate text-[0.65rem] text-slate-500">{operator.email}</p>
              </div>
            </div>
            <div className="mt-3 flex items-center justify-between gap-2">
              <span className="rounded-full border border-white/[0.08] px-2 py-0.5 text-[0.6rem] font-medium uppercase tracking-wide text-slate-400">
                {operator.role}
              </span>
              <form action={logout}>
                <button
                  type="submit"
                  className="inline-flex items-center gap-1 text-[0.65rem] font-medium text-slate-500 transition-colors hover:text-red-300"
                >
                  <LogOut className="size-3" /> Sign out
                </button>
              </form>
            </div>
          </div>
        ) : (
          <form action={logout} className="flex justify-center">
            <button
              type="submit"
              title="Sign out"
              aria-label="Sign out"
              className="flex size-9 items-center justify-center rounded-lg text-slate-500 transition-colors hover:bg-white/[0.06] hover:text-red-300"
            >
              <LogOut className="size-4" />
            </button>
          </form>
        )}
      </div>
    </div>
  );

  return (
    <div className="platform-shell">
      <div className="flex min-h-screen">
        <aside
          className={cn(
            "sticky top-0 hidden h-screen shrink-0 border-r border-white/[0.07] transition-[width] duration-200 ease-out lg:block",
            collapsed ? "w-[72px]" : "w-[252px]",
          )}
        >
          {sidebar}
        </aside>

        {mobileOpen && (
          <div className="fixed inset-0 z-50 lg:hidden">
            <button
              type="button"
              aria-label="Close navigation"
              className="absolute inset-0 bg-black/60 backdrop-blur-sm"
              onClick={() => setMobileOpen(false)}
            />
            <div className="relative h-full w-[270px] border-r border-white/[0.07] shadow-2xl">
              <button
                type="button"
                onClick={() => setMobileOpen(false)}
                className="absolute right-3 top-4 z-10 flex size-8 items-center justify-center rounded-md text-slate-400 hover:bg-white/[0.06] hover:text-white"
                aria-label="Close navigation"
              >
                <X className="size-4" />
              </button>
              {sidebar}
            </div>
          </div>
        )}

        <div className="flex min-w-0 flex-1 flex-col">
          <header className="sticky top-0 z-40 border-b border-white/[0.07] bg-[#080d18]/90 backdrop-blur-xl">
            <div className="flex h-16 items-center gap-3 px-4 lg:px-7">
              <button
                type="button"
                onClick={() => setMobileOpen(true)}
                className="flex size-9 items-center justify-center rounded-lg border border-white/[0.08] bg-white/[0.03] text-slate-300 lg:hidden"
                aria-label="Open navigation"
              >
                <Menu className="size-4" />
              </button>

              <div className="hidden min-w-0 items-center gap-1.5 text-[0.72rem] text-slate-500 sm:flex">
                {breadcrumbs.map((crumb, index) => (
                  <span key={crumb.href} className="flex min-w-0 items-center gap-1.5">
                    {index > 0 && <span className="text-slate-700">/</span>}
                    {index === breadcrumbs.length - 1 ? (
                      <span className="truncate font-medium text-slate-200">{crumb.label}</span>
                    ) : (
                      <Link
                        href={crumb.href}
                        className="truncate transition-colors hover:text-slate-200"
                      >
                        {crumb.label}
                      </Link>
                    )}
                  </span>
                ))}
              </div>

              <div className="ml-auto flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => {
                    setPaletteOpen(true);
                    setQuery("");
                    setSelected(0);
                  }}
                  className="hidden h-9 items-center gap-2 rounded-lg border border-white/[0.08] bg-white/[0.03] px-3 text-left text-[0.72rem] text-slate-500 transition-colors hover:border-white/[0.14] hover:text-slate-300 sm:flex sm:w-52"
                >
                  <Search className="size-3.5" />
                  <span className="flex-1">Search platform…</span>
                  <kbd className="rounded border border-white/[0.08] bg-white/[0.04] px-1 py-0.5 font-sans text-[0.6rem] text-slate-500">
                    ⌘K
                  </kbd>
                </button>

                <select
                  aria-label="Jump to organization"
                  value={currentOrganization}
                  onChange={(event) => {
                    const value = event.target.value;
                    if (value === "__all") router.push("/platform/organizations");
                    else if (value) router.push(`/platform/organizations/${value}`);
                  }}
                  className="hidden h-9 w-44 text-[0.72rem] lg:block"
                >
                  <option value="__all">All organizations</option>
                  {organizations.map((org) => (
                    <option key={org.id} value={org.id}>
                      {org.name}
                    </option>
                  ))}
                </select>

                <button
                  type="button"
                  onClick={() => {
                    setRefreshing(true);
                    router.refresh();
                    window.setTimeout(() => setRefreshing(false), 900);
                  }}
                  className="flex size-9 items-center justify-center rounded-lg border border-white/[0.08] bg-white/[0.03] text-slate-400 transition-colors hover:text-slate-100"
                  aria-label="Refresh dashboard"
                  title="Refresh"
                >
                  <RefreshCw className={cn("size-3.5", refreshing && "animate-spin")} />
                </button>

                <Link
                  href="/platform/verification"
                  className="relative flex size-9 items-center justify-center rounded-lg border border-white/[0.08] bg-white/[0.03] text-slate-400 transition-colors hover:text-slate-100"
                  aria-label={`Verification queue: ${notificationCount} pending`}
                  title="Verification queue"
                >
                  <Bell className="size-3.5" />
                  {notificationCount > 0 && (
                    <span className="absolute -right-1 -top-1 flex size-4 items-center justify-center rounded-full bg-cyan-400 text-[0.55rem] font-bold text-[#031018]">
                      {notificationCount > 9 ? "9+" : notificationCount}
                    </span>
                  )}
                </Link>

                <Link
                  href="/hotels"
                  className="hidden size-9 items-center justify-center rounded-lg border border-white/[0.08] bg-white/[0.03] text-slate-400 transition-colors hover:text-slate-100 sm:flex"
                  aria-label="View public marketplace"
                  title="View public marketplace"
                >
                  <ExternalLink className="size-3.5" />
                </Link>

                <details className="relative">
                  <summary className="flex h-9 cursor-pointer list-none items-center gap-2 rounded-lg border border-white/[0.08] bg-white/[0.03] pl-1 pr-2 text-slate-300 transition-colors hover:border-white/[0.14] [&::-webkit-details-marker]:hidden">
                    <span className="flex size-7 items-center justify-center rounded-md bg-gradient-to-br from-cyan-400 to-blue-600 text-[0.6rem] font-bold text-[#031018]">
                      {initials(operator.name)}
                    </span>
                    <ChevronsUpDown className="size-3 text-slate-500" />
                  </summary>
                  <div className="absolute right-0 z-50 mt-1.5 w-60 rounded-xl border border-white/10 bg-[#0f1828] p-2 text-xs shadow-2xl">
                    <div className="border-b border-white/[0.07] px-2.5 pb-2.5 pt-1">
                      <p className="truncate font-medium text-slate-100">{operator.name}</p>
                      <p className="truncate text-[0.68rem] text-slate-500">{operator.email}</p>
                      <span className="mt-1.5 inline-flex rounded-full border border-cyan-400/20 bg-cyan-400/10 px-1.5 py-0.5 text-[0.58rem] font-semibold uppercase tracking-wide text-cyan-300">
                        {operator.role}
                      </span>
                    </div>
                    <div className="py-1">
                      <Link
                        href="/platform/operators"
                        className="flex items-center gap-2 rounded-lg px-2.5 py-2 text-slate-400 hover:bg-white/[0.05] hover:text-slate-100"
                      >
                        <Users className="size-3.5" /> Operators
                      </Link>
                      <Link
                        href="/hotels"
                        className="flex items-center gap-2 rounded-lg px-2.5 py-2 text-slate-400 hover:bg-white/[0.05] hover:text-slate-100"
                      >
                        <ExternalLink className="size-3.5" /> View marketplace
                      </Link>
                    </div>
                    <form action={logout} className="border-t border-white/[0.07] pt-1">
                      <button
                        type="submit"
                        className="flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left text-slate-400 hover:bg-red-400/10 hover:text-red-300"
                      >
                        <LogOut className="size-3.5" /> Sign out
                      </button>
                    </form>
                  </div>
                </details>
              </div>
            </div>
          </header>

          <main className="flex-1 px-4 py-6 lg:px-7 lg:py-8">
            <div className="mx-auto w-full max-w-[1480px]">{children}</div>
          </main>
        </div>
      </div>

      {paletteOpen && (
        <div className="fixed inset-0 z-[70] flex items-start justify-center bg-black/65 px-4 pt-[12vh] backdrop-blur-sm">
          <button
            type="button"
            aria-label="Close search"
            className="absolute inset-0"
            onClick={() => setPaletteOpen(false)}
          />
          <div
            role="dialog"
            aria-modal="true"
            aria-label="Search platform"
            className="relative w-full max-w-xl overflow-hidden rounded-2xl border border-white/10 bg-[#0d1624] shadow-[0_30px_90px_rgba(0,0,0,0.65)]"
          >
            <div className="flex items-center gap-2 border-b border-white/[0.07] px-4 py-3">
              <Command className="size-4 text-cyan-400" />
              <input
                ref={inputRef}
                value={query}
                onChange={(event) => {
                  setQuery(event.target.value);
                  setSelected(0);
                }}
                onKeyDown={(event) => {
                  if (event.key === "ArrowDown") {
                    event.preventDefault();
                    setSelected((value) => Math.min(value + 1, paletteItems.length - 1));
                  } else if (event.key === "ArrowUp") {
                    event.preventDefault();
                    setSelected((value) => Math.max(value - 1, 0));
                  } else if (event.key === "Enter" && paletteItems[selected]) {
                    event.preventDefault();
                    openItem(paletteItems[selected].href);
                  }
                }}
                placeholder="Search organizations, properties and pages…"
                className="h-9 border-0 bg-transparent px-0 text-sm shadow-none focus:ring-0"
                aria-label="Search"
              />
              <kbd className="rounded border border-white/[0.08] bg-white/[0.04] px-1.5 py-0.5 text-[0.6rem] text-slate-500">
                Esc
              </kbd>
            </div>
            <ul className="max-h-[52vh] overflow-y-auto p-2">
              {paletteItems.length === 0 && (
                <li className="px-3 py-8 text-center text-xs text-slate-500">
                  No matches for “{query}”.
                </li>
              )}
              {paletteItems.map((item, index) => (
                <li key={`${item.group}-${item.href}-${item.label}`}>
                  <button
                    type="button"
                    onMouseEnter={() => setSelected(index)}
                    onClick={() => openItem(item.href)}
                    className={cn(
                      "flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left transition-colors",
                      index === selected ? "bg-cyan-400/10" : "hover:bg-white/[0.04]",
                    )}
                  >
                    <span className="flex size-7 shrink-0 items-center justify-center rounded-md border border-white/[0.08] bg-white/[0.03] text-slate-400">
                      {item.group === "Organizations" ? (
                        <Building2 className="size-3.5" />
                      ) : item.group === "Properties" ? (
                        <Hotel className="size-3.5" />
                      ) : (
                        <Command className="size-3.5" />
                      )}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-xs font-medium text-slate-200">
                        {item.label}
                      </span>
                      <span className="block truncate text-[0.65rem] text-slate-500">
                        {item.hint}
                      </span>
                    </span>
                    <span className="text-[0.58rem] uppercase tracking-wide text-slate-600">
                      {item.group}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}
    </div>
  );
}
