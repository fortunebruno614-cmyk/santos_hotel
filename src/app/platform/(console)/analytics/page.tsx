import Link from "next/link";
import { Building2, CalendarDays, CreditCard, Hotel } from "lucide-react";
import { ActivityChart, type ActivitySeries } from "@/components/platform/activity-chart";
import {
  Donut,
  KpiCard,
  PageHeader,
  Panel,
  PanelBody,
  PanelHeader,
  formatCompactMoney,
  formatMoney,
  formatNumber,
} from "@/components/platform/ui";
import {
  PLATFORM_RANGES,
  getPlatformDashboard,
  parsePlatformRange,
} from "@/server/platform/dashboard";

export default async function PlatformAnalyticsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const sp = await searchParams;
  const range = parsePlatformRange(sp.range);
  const data = await getPlatformDashboard(range);

  const series: ActivitySeries[] = [
    { key: "organizations", label: "Organizations", color: "#06b6d4", values: data.series.organizations, area: true },
    { key: "properties", label: "Properties", color: "#3b82f6", values: data.series.properties },
    { key: "bookings", label: "Bookings", color: "#22c55e", values: data.series.bookings },
  ];

  const revenue: ActivitySeries[] = [
    { key: "revenue", label: "Revenue", color: "#a855f7", values: data.series.revenue, area: true },
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
  const publicationTotal = publicationSegments.reduce((sum, segment) => sum + segment.value, 0);

  const verificationRate =
    data.totals.organizations > 0
      ? Math.round((data.totals.approvedVerification / data.totals.organizations) * 100)
      : 0;

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Insight"
        title="Marketplace analytics"
        description="Real onboarding, listing and booking activity across every tenant. Amounts are net of refunds."
        actions={
          <div className="inline-flex items-center gap-1 rounded-xl border border-white/[0.07] bg-[#0b1220] p-1">
            {PLATFORM_RANGES.map((option) => (
              <Link
                key={option.value}
                href={`/platform/analytics?range=${option.value}`}
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
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard
          label="New organizations"
          value={formatNumber(data.newInRange.organizations)}
          hint={`Previous period ${data.deltas.organizations >= 0 ? "lower" : "higher"}`}
          delta={data.deltas.organizations}
          series={data.series.organizations}
          accent="#06b6d4"
          icon={<Building2 className="size-4" />}
        />
        <KpiCard
          label="New properties"
          value={formatNumber(data.newInRange.properties)}
          hint={`${data.totals.publishedProperties} published in total`}
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
          hint={`Last ${data.rangeLabel}`}
          delta={data.deltas.revenue}
          series={data.series.revenue}
          accent="#a855f7"
          icon={<CreditCard className="size-4" />}
        />
      </div>

      <Panel>
        <PanelHeader
          title="Onboarding and demand"
          description="New organizations and properties against booking volume."
          actions={
            <span className="text-[0.7rem] text-slate-500">
              {data.from.slice(0, 10)} → {data.to.slice(0, 10)}
            </span>
          }
        />
        <PanelBody>
          <ActivityChart labels={data.series.labels} series={series} height={330} />
        </PanelBody>
      </Panel>

      <div className="grid items-start gap-4 xl:grid-cols-[minmax(0,1.5fr)_minmax(320px,1fr)]">
        <Panel>
          <PanelHeader
            title="Revenue trend"
            description={`Captured payments in ${data.totals.revenueCurrency}, net of refunds.`}
          />
          <PanelBody>
            <ActivityChart
              labels={data.series.labels}
              series={revenue}
              height={260}
              formatValue={(value) => formatCompactMoney(value, data.totals.revenueCurrency)}
              formatAxis={(value) => formatCompactMoney(value, data.totals.revenueCurrency)}
            />
          </PanelBody>
        </Panel>

        <div className="space-y-4">
          <Panel>
            <PanelHeader title="Listing mix" description="Portfolio by publication state." />
            <PanelBody>
              <Donut
                segments={publicationSegments}
                total={publicationTotal}
                label="properties"
                size={140}
              />
            </PanelBody>
          </Panel>

          <Panel>
            <PanelHeader title="Trust and readiness" />
            <PanelBody className="space-y-4">
              {[
                { label: "Verified / clear KYC", value: verificationRate },
                {
                  label: "Published properties",
                  value:
                    data.totals.properties > 0
                      ? Math.round((data.totals.publishedProperties / data.totals.properties) * 100)
                      : 0,
                },
                {
                  label: "Active organizations",
                  value:
                    data.totals.organizations > 0
                      ? Math.round((data.totals.activeOrganizations / data.totals.organizations) * 100)
                      : 0,
                },
              ].map((metric) => (
                <div key={metric.label} className="space-y-1.5">
                  <div className="flex items-center justify-between text-[0.7rem]">
                    <span className="text-slate-400">{metric.label}</span>
                    <span className="font-medium tabular-nums text-slate-200">
                      {metric.value}%
                    </span>
                  </div>
                  <div className="h-1.5 overflow-hidden rounded-full bg-white/[0.06]">
                    <div
                      className="h-full rounded-full bg-cyan-400"
                      style={{ width: `${metric.value}%` }}
                    />
                  </div>
                </div>
              ))}
              <p className="border-t border-white/[0.06] pt-3 text-[0.68rem] leading-5 text-slate-500">
                Percentages are derived from the current database, not a static target. KYC
                readiness counts approved submissions plus organizations with no pending review.
              </p>
            </PanelBody>
          </Panel>
        </div>
      </div>
    </div>
  );
}
