import Link from "next/link";
import { ArrowUpRight, Building2, Plus, Search } from "lucide-react";
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

const STATUSES = ["ACTIVE", "PROVISIONING", "SUSPENDED", "CLOSED"];

export default async function PlatformOrganizationsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const sp = await searchParams;
  const query = (sp.q ?? "").trim().toLowerCase();
  const status = STATUSES.includes(sp.status ?? "") ? sp.status! : "";

  const organizations = await prisma.organization.findMany({
    orderBy: { createdAt: "desc" },
    include: {
      _count: { select: { hotels: true, members: true } },
      kyc: { select: { status: true, submittedAt: true } },
      hotels: {
        orderBy: { createdAt: "asc" },
        take: 2,
        select: { id: true, name: true, publicationStatus: true },
      },
    },
  });

  const filtered = organizations.filter((organization) => {
    if (status && organization.status !== status) return false;
    if (!query) return true;
    return [organization.name, organization.slug, organization.email ?? ""]
      .join(" ")
      .toLowerCase()
      .includes(query);
  });

  const counts = organizations.reduce<Record<string, number>>((accumulator, organization) => {
    accumulator[organization.status] = (accumulator[organization.status] ?? 0) + 1;
    return accumulator;
  }, {});

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Marketplace"
        title="Organizations"
        description="Every hotel business on the platform, its verification state and its properties."
        actions={
          <Link href="/platform/organizations/new" className="p-btn p-btn-primary">
            <Plus className="size-3.5" /> Onboard business
          </Link>
        }
      />

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {[
          { label: "All organizations", value: organizations.length, status: "" },
          { label: "Active", value: counts.ACTIVE ?? 0, status: "ACTIVE" },
          { label: "Provisioning", value: counts.PROVISIONING ?? 0, status: "PROVISIONING" },
          { label: "Suspended / closed", value: (counts.SUSPENDED ?? 0) + (counts.CLOSED ?? 0), status: "SUSPENDED" },
        ].map((item) => (
          <Link
            key={item.label}
            href={item.status ? `/platform/organizations?status=${item.status}` : "/platform/organizations"}
            className={`rounded-xl border p-4 transition-colors ${
              status === item.status
                ? "border-cyan-400/30 bg-cyan-400/[0.06]"
                : "border-white/[0.07] bg-[#111b2b] hover:border-white/[0.14]"
            }`}
          >
            <p className="text-[0.65rem] font-semibold uppercase tracking-[0.12em] text-slate-500">
              {item.label}
            </p>
            <p className="mt-1.5 text-xl font-semibold tabular-nums text-slate-100">
              {formatNumber(item.value)}
            </p>
          </Link>
        ))}
      </div>

      <form
        method="get"
        action="/platform/organizations"
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
              placeholder="Name, slug or e-mail…"
              className="pl-9"
            />
          </div>
        </label>
        <label className="flex w-44 flex-col gap-1.5">
          <span className="text-[0.65rem] font-medium uppercase tracking-[0.12em] text-slate-500">
            Status
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
        <Link href="/platform/organizations" className="p-btn">
          Reset
        </Link>
      </form>

      <Panel>
        <PanelHeader
          title={`${filtered.length} organization${filtered.length === 1 ? "" : "s"}`}
          description="Open a row to manage its properties and verification."
        />
        <div className="p-table-wrap rounded-none border-0 bg-transparent">
          <table className="p-table">
            <thead>
              <tr>
                <th>Organization</th>
                <th>KYC</th>
                <th>Properties</th>
                <th>Members</th>
                <th>Status</th>
                <th>Joined</th>
                <th className="text-right">Open</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={7} className="p-empty">
                    <EmptyState
                      title="No organizations match"
                      description="Try a different search or status filter."
                    />
                  </td>
                </tr>
              )}
              {filtered.map((organization) => (
                <tr key={organization.id}>
                  <td>
                    <Link
                      href={`/platform/organizations/${organization.id}`}
                      className="inline-flex items-center gap-2 font-medium text-slate-200 hover:text-cyan-300"
                    >
                      <span className="flex size-7 items-center justify-center rounded-md border border-white/[0.08] bg-white/[0.03] text-cyan-400">
                        <Building2 className="size-3.5" />
                      </span>
                      {organization.name}
                    </Link>
                    <span className="block pl-9 text-[0.65rem] text-slate-500">
                      {organization.email ?? organization.slug}
                    </span>
                  </td>
                  <td>
                    {organization.kyc ? (
                      <StatusPill status={organization.kyc.status} />
                    ) : (
                      <span className="text-slate-600">—</span>
                    )}
                  </td>
                  <td>
                    <span className="tabular-nums text-slate-200">{organization._count.hotels}</span>
                    {organization.hotels.length > 0 && (
                      <span className="block max-w-56 truncate text-[0.65rem] text-slate-500">
                        {organization.hotels.map((hotel) => hotel.name).join(", ")}
                      </span>
                    )}
                  </td>
                  <td className="tabular-nums text-slate-300">{organization._count.members}</td>
                  <td>
                    <StatusPill status={organization.status} />
                  </td>
                  <td className="whitespace-nowrap text-slate-400">
                    {formatDate(organization.createdAt)}
                  </td>
                  <td className="text-right">
                    <Link
                      href={`/platform/organizations/${organization.id}`}
                      className="inline-flex size-7 items-center justify-center rounded-md border border-white/[0.08] text-slate-400 hover:text-cyan-300"
                      aria-label={`Open ${organization.name}`}
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
