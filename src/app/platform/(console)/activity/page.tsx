import Link from "next/link";
import {
  Activity,
  ArrowUpRight,
  Hotel,
  Search,
  ShieldCheck,
  Sparkles,
  UserPlus,
} from "lucide-react";
import {
  EmptyState,
  PageHeader,
  Panel,
  PanelHeader,
  formatDateTime,
} from "@/components/platform/ui";
import { prisma } from "@/lib/prisma";

const CATEGORIES = ["organization", "listing", "membership", "user", "auth"];

function iconFor(action: string) {
  if (action.startsWith("organization.kyc")) return ShieldCheck;
  if (action.startsWith("listing.")) return Hotel;
  if (action.startsWith("membership.") || action.startsWith("user.")) return UserPlus;
  if (action.startsWith("auth.")) return Sparkles;
  return Activity;
}

function humanize(action: string) {
  return action.replaceAll(".", " · ").replaceAll("_", " ");
}

export default async function PlatformActivityPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const sp = await searchParams;
  const query = (sp.q ?? "").trim().toLowerCase();
  const category = CATEGORIES.includes(sp.category ?? "") ? sp.category! : "";

  const entries = await prisma.auditLog.findMany({
    where: category ? { action: { startsWith: `${category}.` } } : undefined,
    orderBy: { createdAt: "desc" },
    take: 150,
    include: {
      user: { select: { name: true, email: true } },
      organization: { select: { id: true, name: true } },
      hotel: { select: { id: true, name: true } },
    },
  });

  const filtered = entries.filter((entry) => {
    if (!query) return true;
    return [
      entry.action,
      entry.entityType,
      entry.user?.name ?? "",
      entry.user?.email ?? "",
      entry.organization?.name ?? "",
      entry.hotel?.name ?? "",
    ]
      .join(" ")
      .toLowerCase()
      .includes(query);
  });

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Audit"
        title="Platform activity"
        description="Onboarding, business verification, listing decisions and membership changes across every tenant."
      />

      <form
        method="get"
        action="/platform/activity"
        className="flex flex-wrap items-end gap-2 rounded-2xl border border-white/[0.07] bg-[#111b2b] p-3"
      >
        <label className="flex min-w-56 flex-1 flex-col gap-1.5">
          <span className="text-[0.65rem] font-medium uppercase tracking-[0.12em] text-slate-500">
            Search
          </span>
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-3.5 -translate-y-1/2 text-slate-500" />
            <input
              name="q"
              defaultValue={sp.q ?? ""}
              placeholder="Action, actor, organization or property…"
              className="pl-9"
            />
          </div>
        </label>
        <label className="flex w-48 flex-col gap-1.5">
          <span className="text-[0.65rem] font-medium uppercase tracking-[0.12em] text-slate-500">
            Category
          </span>
          <select name="category" defaultValue={category}>
            <option value="">All actions</option>
            {CATEGORIES.map((value) => (
              <option key={value} value={value}>
                {value[0].toUpperCase() + value.slice(1)}
              </option>
            ))}
          </select>
        </label>
        <button type="submit" className="p-btn p-btn-primary">
          Filter
        </button>
        <Link href="/platform/activity" className="p-btn">
          Reset
        </Link>
      </form>

      <Panel>
        <PanelHeader
          title={`${filtered.length} entr${filtered.length === 1 ? "y" : "ies"}`}
          description="Newest first. Audit entries are immutable."
        />
        {filtered.length === 0 ? (
          <div className="p-5">
            <EmptyState
              title="No activity matches"
              description="Try a different search term or action category."
            />
          </div>
        ) : (
          <ul className="divide-y divide-white/[0.06]">
            {filtered.map((entry) => {
              const Icon = iconFor(entry.action);
              const href = entry.organization
                ? entry.hotel
                  ? `/platform/hotels/${entry.hotel.id}`
                  : `/platform/organizations/${entry.organization.id}`
                : null;
              return (
                <li key={entry.id}>
                  <div className="flex flex-wrap items-start gap-3 px-5 py-3.5">
                    <span className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-lg border border-white/[0.08] bg-white/[0.03] text-cyan-400">
                      <Icon className="size-4" />
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-medium capitalize text-slate-200">
                        {humanize(entry.action)}
                      </p>
                      <p className="mt-0.5 text-[0.68rem] text-slate-500">
                        {entry.user?.name ?? entry.actorType ?? "system"}
                        {entry.user?.email ? ` · ${entry.user.email}` : ""}
                        {entry.organization ? (
                          <>
                            {" · "}
                            <Link
                              href={`/platform/organizations/${entry.organization.id}`}
                              className="text-slate-400 hover:text-cyan-300"
                            >
                              {entry.organization.name}
                            </Link>
                          </>
                        ) : null}
                        {entry.hotel ? (
                          <>
                            {" · "}
                            <Link
                              href={`/platform/hotels/${entry.hotel.id}`}
                              className="text-slate-400 hover:text-cyan-300"
                            >
                              {entry.hotel.name}
                            </Link>
                          </>
                        ) : null}
                      </p>
                      <p className="mt-0.5 font-mono text-[0.62rem] text-slate-600">
                        {entry.entityType} · {entry.entityId}
                      </p>
                    </div>
                    <div className="flex shrink-0 items-center gap-3">
                      <span className="text-[0.65rem] text-slate-500">
                        {formatDateTime(entry.createdAt)}
                      </span>
                      {href && (
                        <Link
                          href={href}
                          className="inline-flex size-7 items-center justify-center rounded-md border border-white/[0.08] text-slate-400 hover:text-cyan-300"
                          aria-label="Open related record"
                        >
                          <ArrowUpRight className="size-3.5" />
                        </Link>
                      )}
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </Panel>
    </div>
  );
}
