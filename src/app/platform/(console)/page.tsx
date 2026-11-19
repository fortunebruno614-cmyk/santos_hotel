import Link from "next/link";
import {
  Activity,
  ArrowUpRight,
  Building2,
  CalendarDays,
  CreditCard,
  Download,
  Hotel,
  ShieldCheck,
  Sparkles,
  UserPlus,
} from "lucide-react";
import {
  ActivityChart,
  type ActivitySeries,
} from "@/components/platform/activity-chart";
import { RefreshButton } from "@/components/platform/actions";
import {
  ButtonLink,
  Donut,
  EmptyState,
  KpiCard,
  PageHeader,
  Panel,
  PanelBody,
  PanelHeader,
  StatusPill,
  formatDate,
  formatMoney,
  formatNumber,
  relativeTime,
} from "@/components/platform/ui";
import { prisma } from "@/lib/prisma";
import { getCurrentSession } from "@/server/auth/dal";
import {
  PLATFORM_RANGES,
  getPlatformDashboard,
  parsePlatformRange,
} from "@/server/platform/dashboard";

export default async function PlatformHomePage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const sp = await searchParams;
  const range = parsePlatformRange(sp.range);
  const data = await getPlatformDashboard(range);

  const session = await getCurrentSession();
  const user = session?.userId
    ? await prisma.user.findUnique({
        where: { id: session.userId },
        select: { name: true },
      })
    : null;
  const firstName = user?.name?.split(" ")[0] ?? "there";

  const chartSeries: ActivitySeries[] = [
    {
      key: "organizations",
      label: "New organizations",
      color: "#06b6d4",
      values: data.series.organizations,
      area: true,
    },
    {
      key: "properties",
      label: "New properties",
      color: "#3b82f6",
      values: data.series.properties,
    },
    {
      key: "bookings",
      label: "Bookings",
      color: "#22c55e",
      values: data.series.bookings,
    },
  ];

  const revenueSeries: ActivitySeries[] = [
    {
      key: "revenue",
      label: "Captured revenue",
      color: "#06b6d4",
      values: data.series.revenue,
      area: true,
    },
  ];

  const publicationSegments = [
    { label: "Published", value: data.publication.PUBLISHED ?? 0, color: "#22c55e" },
    {
      label: "In review",
      value: (data.publication.SUBMITTED ?? 0) + (data.publication.UNDER_REVIEW ?? 0),
      color: "#f59e0b",
    },
    { label: "Draft", value: data.publication.DRAFT ?? 0, color: "#475569" },
    {
      label: "Paused / suspended",
      value: (data.publication.PAUSED ?? 0) + (data.publication.SUSPENDED ?? 0),
      color: "#ef4444",
    },
    { label: "Archived", value: data.publication.ARCHIVED ?? 0, color: "#1e293b" },
  ].filter((segment) => segment.value > 0);

  const marketplaceTotal = publicationSegments.reduce((sum, segment) => sum + segment.value, 0);

  const statusRows = [
    { key: "ACTIVE", label: "Active", color: "#22c55e" },
    { key: "PROVISIONING", label: "Provisioning", color: "#3b82f6" },
    { key: "SUSPENDED", label: "Suspended", color: "#f59e0b" },
    { key: "CLOSED", label: "Closed", color: "#ef4444" },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Control center"
        title={`Welcome back, ${firstName}`}
        description={`Here is what is happening across the Santo marketplace today — ${formatDate(new Date())}.`}
        actions={
          <>
            <RefreshButton />
            <ButtonLink
              href={`/api/platform/reports/marketplace?range=${range}`}
              variant="primary"
            >
              <Download className="size-3.5" /> Export report
            </ButtonLink>
          </>
        }
      />

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="inline-flex items-center gap-1 rounded-xl border border-white/[0.07] bg-[#0b1220] p-1">
          {PLATFORM_RANGES.map((option) => (
            <Link
              key={option.value}
              href={`/platform?range=${option.value}`}
              className={`rounded-lg px-3 py-1.5 text-[0.72rem] font-medium transition-colors ${
                range === option.value
                  ? "bg-cyan-400/12 text-cyan-300"
                  : "text-slate-500 hover:text-slate-200"
              }`}
            >
              {option.label}
            </Link>
          ))}
        </div>
        <p className="text-[0.7rem] text-slate-500">
          Data generated {relativeTime(data.generatedAt)} · {data.totals.organizations} organizations ·{" "}
          {data.totals.properties} properties
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard
          label="Organizations"
          value={formatNumber(data.totals.organizations)}
          hint={`${data.totals.activeOrganizations} active · ${data.newInRange.organizations} new`}
          delta={data.deltas.organizations}
          series={data.series.organizations}
          accent="#06b6d4"
          icon={<Building2 className="size-4" />}
        />
        <KpiCard
          label="Properties"
          value={formatNumber(data.totals.properties)}
          hint={`${data.totals.publishedProperties} published · ${data.newInRange.properties} added`}
          delta={data.deltas.properties}
          series={data.series.properties}
          accent="#3b82f6"
          icon={<Hotel className="size-4" />}
        />
        <KpiCard
          label="Bookings"
          value={formatNumber(data.totals.bookings)}
          hint={`Last ${data.rangeLabel}`}
          delta={data.deltas.bookings}
          series={data.series.bookings}
          accent="#22c55e"
          icon={<CalendarDays className="size-4" />}
        />
        <KpiCard
          label="Captured revenue"
          value={formatMoney(data.totals.revenue, data.totals.revenueCurrency)}
          hint={`Last ${data.rangeLabel} · net of refunds`}
          delta={data.deltas.revenue}
          series={data.series.revenue}
          accent="#a855f7"
          icon={<CreditCard className="size-4" />}
        />
      </div>

      <div className="grid items-start gap-4 xl:grid-cols-[minmax(0,1.65fr)_minmax(320px,1fr)]">
        <Panel>
          <PanelHeader
            title="Marketplace activity"
            description="New organizations, properties and bookings over the selected range."
            actions={
              <span className="rounded-full border border-white/[0.08] bg-white/[0.03] px-2.5 py-0.5 text-[0.65rem] font-medium text-slate-400">
                {data.rangeLabel}
              </span>
            }
          />
          <PanelBody>
            <ActivityChart
              labels={data.series.labels}
              series={chartSeries}
              height={300}
            />
          </PanelBody>
        </Panel>

        <div className="space-y-4">
          <Panel>
            <PanelHeader
              title="Verification queue"
              description="Business KYC submissions awaiting a decision."
              actions={
                <span className="rounded-full bg-amber-400/15 px-2 py-0.5 text-[0.65rem] font-semibold text-amber-300">
                  {data.totals.pendingVerification}
                </span>
              }
            />
            <div className="divide-y divide-white/[0.06]">
              {data.pendingKyc.length === 0 && (
                <div className="p-5">
                  <EmptyState
                    title="No pending KYC"
                    description="New business submissions will appear here."
                  />
                </div>
              )}
              {data.pendingKyc.slice(0, 4).map((entry) => (
                <Link
                  key={entry.organizationId}
                  href={`/platform/organizations/${entry.organizationId}`}
                  className="flex items-center gap-3 px-5 py-3 transition-colors hover:bg-white/[0.025]"
                >
                  <span className="flex size-8 shrink-0 items-center justify-center rounded-lg border border-amber-400/20 bg-amber-400/10 text-amber-300">
                    <ShieldCheck className="size-4" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-xs font-medium text-slate-200">
                      {entry.legalName}
                    </span>
                    <span className="block truncate text-[0.65rem] text-slate-500">
                      {entry.organizationName} · submitted {formatDate(entry.submittedAt)}
                    </span>
                  </span>
                  <ArrowUpRight className="size-3.5 shrink-0 text-slate-600" />
                </Link>
              ))}
            </div>
            <div className="border-t border-white/[0.06] px-5 py-3">
              <Link
                href="/platform/verification"
                className="inline-flex items-center gap-1 text-[0.7rem] font-medium text-cyan-400 hover:text-cyan-300"
              >
                Open verification queue <ArrowUpRight className="size-3" />
              </Link>
            </div>
          </Panel>

          <Panel>
            <PanelHeader
              title="Listings needing review"
              description="Submitted or under review properties."
              actions={
                <span className="rounded-full bg-sky-400/15 px-2 py-0.5 text-[0.65rem] font-semibold text-sky-300">
                  {data.totals.pendingReviews}
                </span>
              }
            />
            <div className="divide-y divide-white/[0.06]">
              {data.reviewHotels.length === 0 && (
                <div className="p-5">
                  <EmptyState title="Nothing in the review lane" description="Listings appear here when an owner submits them." />
                </div>
              )}
              {data.reviewHotels.map((hotel) => (
                <Link
                  key={hotel.id}
                  href={`/platform/hotels/${hotel.id}`}
                  className="flex items-center gap-3 px-5 py-3 transition-colors hover:bg-white/[0.025]"
                >
                  <span className="flex size-8 shrink-0 items-center justify-center rounded-lg border border-sky-400/20 bg-sky-400/10 text-sky-300">
                    <Hotel className="size-4" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-xs font-medium text-slate-200">
                      {hotel.name}
                    </span>
                    <span className="block truncate text-[0.65rem] text-slate-500">
                      {hotel.organizationName} · {formatDate(hotel.updatedAt)}
                    </span>
                  </span>
                  <StatusPill status={hotel.publicationStatus} />
                </Link>
              ))}
            </div>
          </Panel>
        </div>
      </div>

      <div className="grid items-start gap-4 xl:grid-cols-[minmax(0,1.65fr)_minmax(320px,1fr)]">
        <Panel>
          <PanelHeader
            title="Captured revenue"
            description={`Net of refunds, ${data.totals.revenueCurrency}, last ${data.rangeLabel}.`}
            actions={
              <span className="text-[0.7rem] font-medium tabular-nums text-slate-300">
                {formatMoney(data.totals.revenue, data.totals.revenueCurrency)}
              </span>
            }
          />
          <PanelBody>
            <ActivityChart
              labels={data.series.labels}
              series={revenueSeries}
              height={220}
              valueKind="money"
              currency={data.totals.revenueCurrency}
            />
          </PanelBody>
        </Panel>

        <Panel>
          <PanelHeader
            title="Marketplace health"
            description="Where the portfolio sits right now."
          />
          <PanelBody className="space-y-6">
            <Donut
              segments={publicationSegments}
              total={marketplaceTotal}
              label="properties"
              size={140}
            />
            <div className="space-y-3 border-t border-white/[0.06] pt-4">
              {statusRows.map((row) => {
                const count = data.organizationStatus[row.key] ?? 0;
                const percent =
                  data.totals.organizations > 0
                    ? Math.round((count / data.totals.organizations) * 100)
                    : 0;
                return (
                  <div key={row.key} className="space-y-1.5">
                    <div className="flex items-center justify-between gap-2 text-[0.7rem]">
                      <span className="text-slate-400">{row.label}</span>
                      <span className="font-medium tabular-nums text-slate-200">
                        {count} · {percent}%
                      </span>
                    </div>
                    <div className="h-1.5 overflow-hidden rounded-full bg-white/[0.06]">
                      <div
                        className="h-full rounded-full"
                        style={{ width: `${percent}%`, backgroundColor: row.color }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </PanelBody>
        </Panel>
      </div>

      <Panel>
        <PanelHeader
          title="Recent organizations"
          description="The newest businesses on the platform."
          actions={
            <Link
              href="/platform/organizations"
              className="inline-flex items-center gap-1 text-[0.7rem] font-medium text-cyan-400 hover:text-cyan-300"
            >
              View all <ArrowUpRight className="size-3" />
            </Link>
          }
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
              {data.recentOrganizations.length === 0 && (
                <tr>
                  <td colSpan={7} className="p-empty">
                    No organizations yet.
                  </td>
                </tr>
              )}
              {data.recentOrganizations.map((organization) => (
                <tr key={organization.id}>
                  <td>
                    <Link
                      href={`/platform/organizations/${organization.id}`}
                      className="font-medium text-slate-200 hover:text-cyan-300"
                    >
                      {organization.name}
                    </Link>
                    <span className="block text-[0.65rem] text-slate-500">
                      {organization.email ?? organization.slug}
                    </span>
                  </td>
                  <td>
                    {organization.kycStatus ? (
                      <StatusPill status={organization.kycStatus} />
                    ) : (
                      <span className="text-slate-600">—</span>
                    )}
                  </td>
                  <td className="tabular-nums text-slate-300">{organization.hotelCount}</td>
                  <td className="tabular-nums text-slate-300">{organization.memberCount}</td>
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

      <div className="grid items-start gap-4 xl:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)]">
        <Panel>
          <PanelHeader
            title="Recent platform activity"
            description="Onboarding, verification and listing decisions."
            actions={
              <Link
                href="/platform/activity"
                className="inline-flex items-center gap-1 text-[0.7rem] font-medium text-cyan-400 hover:text-cyan-300"
              >
                Full audit trail <ArrowUpRight className="size-3" />
              </Link>
            }
          />
          <ul className="divide-y divide-white/[0.06]">
            {data.activity.slice(0, 8).map((entry) => {
              const Icon = entry.action.startsWith("organization.kyc")
                ? ShieldCheck
                : entry.action.startsWith("listing.")
                  ? Hotel
                  : entry.action.startsWith("membership.") || entry.action.startsWith("user.")
                    ? UserPlus
                    : entry.action.startsWith("auth.")
                      ? Sparkles
                      : Activity;
              const href = entry.organizationId
                ? entry.hotelId
                  ? `/platform/hotels/${entry.hotelId}`
                  : `/platform/organizations/${entry.organizationId}`
                : null;
              const content = (
                <>
                  <span className="mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-lg border border-white/[0.08] bg-white/[0.03] text-slate-400">
                    <Icon className="size-3.5" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-xs text-slate-200">
                      {entry.action.replaceAll(".", " · ").replaceAll("_", " ")}
                    </span>
                    <span className="block truncate text-[0.65rem] text-slate-500">
                      {entry.actor}
                      {entry.organizationName ? ` · ${entry.organizationName}` : ""}
                      {entry.hotelName ? ` · ${entry.hotelName}` : ""}
                    </span>
                  </span>
                  <span className="shrink-0 text-[0.65rem] text-slate-600">
                    {relativeTime(entry.createdAt)}
                  </span>
                </>
              );
              return (
                <li key={entry.id}>
                  {href ? (
                    <Link href={href} className="flex gap-3 px-5 py-3 hover:bg-white/[0.025]">
                      {content}
                    </Link>
                  ) : (
                    <div className="flex gap-3 px-5 py-3">{content}</div>
                  )}
                </li>
              );
            })}
          </ul>
        </Panel>

        <Panel>
          <PanelHeader
            title="Platform snapshot"
            description="Live totals outside the selected range."
          />
          <PanelBody className="grid gap-4 sm:grid-cols-2">
            {[
              { label: "Active operators", value: data.totals.operators },
              { label: "Active members", value: data.totals.members },
              { label: "Pending KYC", value: data.totals.pendingVerification },
              { label: "Listings in review", value: data.totals.pendingReviews },
            ].map((item) => (
              <div
                key={item.label}
                className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-4"
              >
                <p className="text-[0.65rem] font-semibold uppercase tracking-[0.12em] text-slate-500">
                  {item.label}
                </p>
                <p className="mt-1.5 text-xl font-semibold tabular-nums text-slate-100">
                  {formatNumber(item.value)}
                </p>
              </div>
            ))}
            <div className="sm:col-span-2">
              <div className="flex flex-wrap gap-2">
                <ButtonLink href="/platform/organizations/new" variant="primary">
                  <UserPlus className="size-3.5" /> Onboard a business
                </ButtonLink>
                <ButtonLink href="/platform/verification">
                  <ShieldCheck className="size-3.5" /> Review KYC
                </ButtonLink>
              </div>
            </div>
          </PanelBody>
        </Panel>
      </div>
    </div>
  );
}
