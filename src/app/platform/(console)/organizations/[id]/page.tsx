import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowUpRight, Building2, CalendarDays, Hotel, ShieldCheck, Users } from "lucide-react";
import {
  EmptyState,
  KpiCard,
  PageHeader,
  Panel,
  PanelHeader,
  StatusPill,
  formatDate,
  formatNumber,
} from "@/components/platform/ui";
import { getOrganizationDetail } from "@/server/platform/organizations";
import { setOrganizationStatusAction } from "@/server/platform/actions";
import { getOrganizationKycSummary } from "@/server/onboarding/kyc";
import { PlatformHotelForm } from "./hotel-form";
import { KycPanel } from "./kyc-panel";

export default async function PlatformOrganizationPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const { id } = await params;
  const sp = await searchParams;
  const organization = await getOrganizationDetail(id);
  if (!organization) notFound();
  const kyc = await getOrganizationKycSummary(organization.id);

  const published = organization.hotels.filter(
    (hotel) => hotel.publicationStatus === "PUBLISHED",
  ).length;

  return (
    <div className="space-y-6">
      {sp.created === "1" && (
        <div className="rounded-xl border border-emerald-400/20 bg-emerald-400/10 px-4 py-3 text-sm text-emerald-300">
          Organization created. Add its first property and finish the business verification below.
        </div>
      )}
      <PageHeader
        eyebrow="Organization"
        title={organization.name}
        description={
          <span className="flex flex-wrap items-center gap-2">
            <StatusPill status={organization.status} />
            <span className="font-mono text-xs text-slate-500">{organization.slug}</span>
            <span>{organization.email ?? "no e-mail"}</span>
            <span className="text-slate-600">·</span>
            <span>Since {formatDate(organization.createdAt)}</span>
          </span>
        }
        actions={
          <>
            {organization.status !== "ACTIVE" && (
              <form action={setOrganizationStatusAction}>
                <input type="hidden" name="organizationId" value={organization.id} />
                <input type="hidden" name="status" value="ACTIVE" />
                <button type="submit" className="p-btn p-btn-primary">
                  Activate organization
                </button>
              </form>
            )}
            {organization.status !== "SUSPENDED" && (
              <form action={setOrganizationStatusAction}>
                <input type="hidden" name="organizationId" value={organization.id} />
                <input type="hidden" name="status" value="SUSPENDED" />
                <button type="submit" className="p-btn p-btn-danger">
                  Suspend
                </button>
              </form>
            )}
          </>
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard
          label="Properties"
          value={formatNumber(organization.hotels.length)}
          hint={`${published} published`}
          icon={<Hotel className="size-4" />}
          accent="#3b82f6"
        />
        <KpiCard
          label="Members"
          value={formatNumber(organization.members.length)}
          hint={`${organization.members.filter((member) => member.status === "ACTIVE").length} active`}
          icon={<Users className="size-4" />}
          accent="#06b6d4"
        />
        <KpiCard
          label="Verification"
          value={kyc?.status === "APPROVED" ? "Verified" : kyc?.status === "REJECTED" ? "Rejected" : "Pending"}
          hint={kyc ? (kyc.registrationNumber ?? "No registration number") : "No KYC submitted"}
          icon={<ShieldCheck className="size-4" />}
          accent={kyc?.status === "APPROVED" ? "#22c55e" : "#f59e0b"}
        />
        <KpiCard
          label="Created"
          value={formatDate(organization.createdAt)}
          hint={organization.phone ?? "No phone on file"}
          icon={<CalendarDays className="size-4" />}
          accent="#a855f7"
        />
      </div>

      <KycPanel organizationId={organization.id} kyc={kyc} />

      <Panel>
        <PanelHeader
          title="Properties"
          description="Every physical property in this organization."
          actions={
            <Link href="/platform/properties" className="inline-flex items-center gap-1 text-[0.7rem] font-medium text-cyan-400 hover:text-cyan-300">
              All properties <ArrowUpRight className="size-3" />
            </Link>
          }
        />
        <div className="p-table-wrap rounded-none border-0 bg-transparent">
          <table className="p-table">
            <thead>
              <tr>
                <th>Property</th>
                <th>Location</th>
                <th>Publication</th>
                <th className="text-right">Rooms</th>
                <th className="text-right">Bookings</th>
                <th className="text-right">Open</th>
              </tr>
            </thead>
            <tbody>
              {organization.hotels.length === 0 && (
                <tr>
                  <td colSpan={6} className="p-empty">
                    <EmptyState
                      title="No properties yet"
                      description="Add the first property below to start the onboarding."
                    />
                  </td>
                </tr>
              )}
              {organization.hotels.map((hotel) => (
                <tr key={hotel.id}>
                  <td>
                    <Link
                      href={`/platform/hotels/${hotel.id}`}
                      className="inline-flex items-center gap-2 font-medium text-slate-200 hover:text-cyan-300"
                    >
                      <span className="flex size-7 items-center justify-center rounded-md border border-white/[0.08] bg-white/[0.03] text-cyan-400">
                        <Building2 className="size-3.5" />
                      </span>
                      {hotel.name}
                    </Link>
                    <span className="block pl-9 text-[0.65rem] text-slate-500">/{hotel.slug}</span>
                  </td>
                  <td className="text-slate-400">
                    {[hotel.city, hotel.country].filter(Boolean).join(", ") || "—"}
                  </td>
                  <td>
                    <StatusPill status={hotel.publicationStatus} />
                  </td>
                  <td className="text-right tabular-nums text-slate-300">{hotel._count.rooms}</td>
                  <td className="text-right tabular-nums text-slate-300">
                    {hotel._count.bookings}
                  </td>
                  <td className="text-right">
                    <Link
                      href={`/platform/hotels/${hotel.id}`}
                      className="inline-flex size-7 items-center justify-center rounded-md border border-white/[0.08] text-slate-400 hover:text-cyan-300"
                      aria-label={`Open ${hotel.name}`}
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

      <div className="grid items-start gap-4 xl:grid-cols-[minmax(0,1.4fr)_minmax(300px,1fr)]">
        <Panel>
          <PanelHeader
            title="Add a property"
            description="Creates a draft property inside this organization."
          />
          <div className="p-5">
            <PlatformHotelForm organizationId={organization.id} />
          </div>
        </Panel>

        <Panel>
          <PanelHeader title="Members" description="Users with access to this tenant." />
          <ul className="divide-y divide-white/[0.06]">
            {organization.members.length === 0 && (
              <li className="px-5 py-6 text-xs text-slate-500">No members.</li>
            )}
            {organization.members.map((member) => (
              <li key={member.id} className="flex items-center gap-3 px-5 py-3">
                <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-white/[0.05] text-[0.65rem] font-semibold text-slate-300">
                  {(member.user.name || member.user.email)
                    .split(/\s+/)
                    .map((part) => part[0])
                    .join("")
                    .slice(0, 2)
                    .toUpperCase()}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-xs font-medium text-slate-200">{member.user.name}</p>
                  <p className="truncate text-[0.65rem] text-slate-500">{member.user.email}</p>
                </div>
                <div className="flex flex-col items-end gap-1">
                  <StatusPill status={member.role} />
                  <span className="text-[0.6rem] uppercase tracking-wide text-slate-600">
                    {member.status}
                  </span>
                </div>
              </li>
            ))}
          </ul>
        </Panel>
      </div>
    </div>
  );
}
