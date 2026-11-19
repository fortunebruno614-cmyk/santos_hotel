import Link from "next/link";
import { ArrowUpRight, Hotel, Search } from "lucide-react";
import {
  EmptyState,
  PageHeader,
  Panel,
  PanelHeader,
  StatusPill,
  formatDate,
  formatNumber,
} from "@/components/platform/ui";
import { prisma } from "@/lib/prisma";

const STATUSES = [
  "PUBLISHED",
  "DRAFT",
  "SUBMITTED",
  "UNDER_REVIEW",
  "PAUSED",
  "SUSPENDED",
  "ARCHIVED",
];

export default async function PlatformPropertiesPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const sp = await searchParams;
  const query = (sp.q ?? "").trim().toLowerCase();
  const status = STATUSES.includes(sp.status ?? "") ? sp.status! : "";

  const properties = await prisma.hotel.findMany({
    orderBy: { updatedAt: "desc" },
    include: {
      organization: { select: { id: true, name: true, status: true } },
      _count: { select: { roomTypes: true, rooms: true, bookings: true } },
    },
  });

  const filtered = properties.filter((property) => {
    if (status && property.publicationStatus !== status) return false;
    if (!query) return true;
    return [
      property.name,
      property.slug,
      property.city ?? "",
      property.country ?? "",
      property.organization.name,
    ]
      .join(" ")
      .toLowerCase()
      .includes(query);
  });

  const published = properties.filter((property) => property.publicationStatus === "PUBLISHED").length;
  const inReview = properties.filter((property) =>
    ["SUBMITTED", "UNDER_REVIEW"].includes(property.publicationStatus),
  ).length;

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Marketplace"
        title="Properties"
        description="Every listing across tenant organizations, from draft to published."
      />

      <div className="grid gap-3 sm:grid-cols-3">
        {[
          { label: "All properties", value: properties.length },
          { label: "Published", value: published },
          { label: "In review", value: inReview },
        ].map((item) => (
          <div
            key={item.label}
            className="rounded-xl border border-white/[0.07] bg-[#111b2b] p-4"
          >
            <p className="text-[0.65rem] font-semibold uppercase tracking-[0.12em] text-slate-500">
              {item.label}
            </p>
            <p className="mt-1.5 text-xl font-semibold tabular-nums text-slate-100">
              {formatNumber(item.value)}
            </p>
          </div>
        ))}
      </div>

      <form
        method="get"
        action="/platform/properties"
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
              placeholder="Property, city, organization…"
              className="pl-9"
            />
          </div>
        </label>
        <label className="flex w-48 flex-col gap-1.5">
          <span className="text-[0.65rem] font-medium uppercase tracking-[0.12em] text-slate-500">
            Publication
          </span>
          <select name="status" defaultValue={status}>
            <option value="">Any</option>
            {STATUSES.map((value) => (
              <option key={value} value={value}>
                {value
                  .toLowerCase()
                  .replaceAll("_", " ")
                  .replace(/^\w/, (letter) => letter.toUpperCase())}
              </option>
            ))}
          </select>
        </label>
        <button type="submit" className="p-btn p-btn-primary">
          Filter
        </button>
        <Link href="/platform/properties" className="p-btn">
          Reset
        </Link>
      </form>

      <Panel>
        <PanelHeader
          title={`${filtered.length} propert${filtered.length === 1 ? "y" : "ies"}`}
          description="Open a property to review publication and verify its map position."
        />
        <div className="p-table-wrap rounded-none border-0 bg-transparent">
          <table className="p-table">
            <thead>
              <tr>
                <th>Property</th>
                <th>Organization</th>
                <th>Location</th>
                <th>Publication</th>
                <th className="text-right">Rooms</th>
                <th className="text-right">Bookings</th>
                <th>Updated</th>
                <th className="text-right">Open</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={8} className="p-empty">
                    <EmptyState
                      title="No properties match"
                      description="Try a different search or publication filter."
                    />
                  </td>
                </tr>
              )}
              {filtered.map((property) => (
                <tr key={property.id}>
                  <td>
                    <Link
                      href={`/platform/hotels/${property.id}`}
                      className="inline-flex items-center gap-2 font-medium text-slate-200 hover:text-cyan-300"
                    >
                      <span className="flex size-7 items-center justify-center rounded-md border border-white/[0.08] bg-white/[0.03] text-cyan-400">
                        <Hotel className="size-3.5" />
                      </span>
                      {property.name}
                    </Link>
                    <span className="block pl-9 text-[0.65rem] text-slate-500">
                      /{property.slug}
                    </span>
                  </td>
                  <td>
                    <Link
                      href={`/platform/organizations/${property.organization.id}`}
                      className="text-slate-300 hover:text-cyan-300"
                    >
                      {property.organization.name}
                    </Link>
                    <span className="block text-[0.65rem] text-slate-500">
                      {property.organization.status}
                    </span>
                  </td>
                  <td className="text-slate-400">
                    {[property.city, property.country].filter(Boolean).join(", ") || "—"}
                  </td>
                  <td>
                    <StatusPill status={property.publicationStatus} />
                  </td>
                  <td className="text-right tabular-nums text-slate-300">
                    {property._count.rooms}
                    <span className="text-[0.65rem] text-slate-500"> / {property._count.roomTypes} types</span>
                  </td>
                  <td className="text-right tabular-nums text-slate-300">
                    {property._count.bookings}
                  </td>
                  <td className="whitespace-nowrap text-slate-400">
                    {formatDate(property.updatedAt)}
                  </td>
                  <td className="text-right">
                    <Link
                      href={`/platform/hotels/${property.id}`}
                      className="inline-flex size-7 items-center justify-center rounded-md border border-white/[0.08] text-slate-400 hover:text-cyan-300"
                      aria-label={`Open ${property.name}`}
                    >
                      <ArrowUpRight className="size-3.5" />
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Panel>
    </div>
  );
}
