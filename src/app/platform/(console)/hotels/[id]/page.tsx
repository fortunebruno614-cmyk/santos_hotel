import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowUpRight, Building2, CalendarDays, Hotel, MapPin } from "lucide-react";
import {
  EmptyState,
  KpiCard,
  PageHeader,
  Panel,
  PanelBody,
  PanelHeader,
  StatusPill,
  formatDate,
  formatDateTime,
} from "@/components/platform/ui";
import { prisma } from "@/lib/prisma";
import { allowedPublicationTransitions } from "@/server/platform/listings";
import { transitionPublicationAction } from "@/server/platform/actions";
import { VerifyLocationForm } from "./verify-location-form";

const PUBLICATION_LABELS: Record<string, string> = {
  DRAFT: "Draft",
  SUBMITTED: "Submitted",
  UNDER_REVIEW: "Under review",
  PUBLISHED: "Published",
  PAUSED: "Paused",
  SUSPENDED: "Suspended",
  ARCHIVED: "Archived",
};

function transitionLabel(to: string) {
  if (to === "PUBLISHED") return "Publish";
  if (to === "PAUSED") return "Pause";
  if (to === "SUSPENDED") return "Suspend";
  if (to === "ARCHIVED") return "Archive";
  if (to === "UNDER_REVIEW") return "Start review";
  if (to === "DRAFT") return "Return to draft";
  if (to === "SUBMITTED") return "Submit";
  return PUBLICATION_LABELS[to] ?? to;
}

export default async function PlatformHotelPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const hotel = await prisma.hotel.findUnique({
    where: { id },
    include: {
      organization: { select: { id: true, name: true } },
      _count: { select: { roomTypes: true, rooms: true, bookings: true } },
    },
  });
  if (!hotel) notFound();

  const reviews = await prisma.listingReview.findMany({
    where: { hotelId: id },
    orderBy: { decidedAt: "desc" },
    take: 20,
  });
  const transitions = allowedPublicationTransitions(hotel.publicationStatus);
  const address = [
    hotel.addressLine1,
    hotel.addressLine2,
    hotel.city,
    hotel.postcode,
    hotel.country,
  ]
    .filter(Boolean)
    .join(", ");

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Property"
        title={hotel.name}
        description={
          <span className="flex flex-wrap items-center gap-2">
            <StatusPill status={hotel.publicationStatus} />
            <Link
              href={`/platform/organizations/${hotel.organization.id}`}
              className="inline-flex items-center gap-1 text-slate-400 hover:text-cyan-300"
            >
              <Building2 className="size-3.5" /> {hotel.organization.name}
            </Link>
            <span className="font-mono text-xs text-slate-500">/{hotel.slug}</span>
          </span>
        }
        actions={
          <>
            {hotel.publicationStatus === "PUBLISHED" && (
              <Link href={`/hotels/${hotel.slug}`} target="_blank" className="p-btn">
                <ArrowUpRight className="size-3.5" /> View listing
              </Link>
            )}
            <Link href="/platform/properties" className="p-btn">
              <Hotel className="size-3.5" /> All properties
            </Link>
          </>
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard
          label="Rooms"
          value={hotel._count.rooms}
          hint={`${hotel._count.roomTypes} room types`}
          icon={<Hotel className="size-4" />}
          accent="#3b82f6"
        />
        <KpiCard
          label="Bookings"
          value={hotel._count.bookings}
          hint="All time"
          icon={<CalendarDays className="size-4" />}
          accent="#22c55e"
        />
        <KpiCard
          label="Map position"
          value={hotel.locationVerification === "PLATFORM_VERIFIED" ? "Verified" : "Unverified"}
          hint={
            hotel.latitude != null && hotel.longitude != null
              ? `${hotel.latitude.toString()}, ${hotel.longitude.toString()}`
              : "No coordinates recorded"
          }
          icon={<MapPin className="size-4" />}
          accent={hotel.locationVerification === "PLATFORM_VERIFIED" ? "#22c55e" : "#f59e0b"}
        />
        <KpiCard
          label="Currency / timezone"
          value={hotel.currency}
          hint={hotel.timezone}
          icon={<Building2 className="size-4" />}
          accent="#06b6d4"
        />
      </div>

      <div className="grid items-start gap-4 xl:grid-cols-2">
        <Panel>
          <PanelHeader title="Business information" />
          <PanelBody className="space-y-4 text-sm">
            <p className="text-slate-400">{hotel.description ?? "No description yet."}</p>
            <dl className="grid gap-3 sm:grid-cols-2">
              <div>
                <dt className="text-[0.65rem] font-medium uppercase tracking-[0.1em] text-slate-500">
                  Address
                </dt>
                <dd className="mt-1 text-slate-200">{address || "Not set"}</dd>
              </div>
              <div>
                <dt className="text-[0.65rem] font-medium uppercase tracking-[0.1em] text-slate-500">
                  Contact
                </dt>
                <dd className="mt-1 text-slate-200">
                  {hotel.email ?? "—"} · {hotel.phone ?? "—"}
                </dd>
              </div>
              <div>
                <dt className="text-[0.65rem] font-medium uppercase tracking-[0.1em] text-slate-500">
                  Coordinates
                </dt>
                <dd className="mt-1 text-slate-200">
                  {hotel.latitude != null && hotel.longitude != null ? (
                    <a
                      className="text-cyan-400 underline-offset-4 hover:underline"
                      href={`https://www.google.com/maps?q=${hotel.latitude},${hotel.longitude}`}
                      target="_blank"
                      rel="noreferrer"
                    >
                      {hotel.latitude.toString()}, {hotel.longitude.toString()}
                    </a>
                  ) : (
                    "No verified position"
                  )}
                </dd>
              </div>
              <div>
                <dt className="text-[0.65rem] font-medium uppercase tracking-[0.1em] text-slate-500">
                  Location verification
                </dt>
                <dd className="mt-1 text-slate-200">
                  {hotel.locationVerification.replaceAll("_", " ").toLowerCase()}
                  {hotel.verifiedAt ? ` · ${formatDate(hotel.verifiedAt)}` : ""}
                </dd>
              </div>
            </dl>
          </PanelBody>
        </Panel>

        <Panel>
          <PanelHeader
            title="Publication"
            description={`Current state: ${PUBLICATION_LABELS[hotel.publicationStatus] ?? hotel.publicationStatus}.`}
            actions={<StatusPill status={hotel.publicationStatus} />}
          />
          <PanelBody className="space-y-4">
            <div className="flex flex-wrap gap-2">
              {transitions.map((to) => (
                <form key={to} action={transitionPublicationAction} className="flex flex-wrap items-center gap-1.5">
                  <input type="hidden" name="hotelId" value={hotel.id} />
                  <input type="hidden" name="to" value={to} />
                  {to === "UNDER_REVIEW" || to === "DRAFT" ? (
                    <input name="reason" placeholder="Decision reason" className="w-48 text-xs" />
                  ) : null}
                  <button
                    type="submit"
                    className={
                      to === "PUBLISHED"
                        ? "p-btn p-btn-primary"
                        : to === "SUSPENDED" || to === "ARCHIVED"
                          ? "p-btn p-btn-danger"
                          : "p-btn"
                    }
                  >
                    {transitionLabel(to)}
                  </button>
                </form>
              ))}
              {transitions.length === 0 && (
                <p className="text-xs text-slate-500">Archived listings are read-only.</p>
              )}
            </div>
            <p className="text-[0.68rem] leading-5 text-slate-500">
              Publishing requires a name, contact, address, city, country and at least one active
              room type with a physical room. Every transition is written to the listing review
              history and the audit trail.
            </p>
          </PanelBody>
        </Panel>
      </div>

      <Panel>
        <PanelHeader
          title="Verified map location"
          description="Only a platform operator can mark coordinates as verified."
        />
        <PanelBody>
          <VerifyLocationForm
            hotelId={hotel.id}
            initialLatitude={hotel.latitude?.toString() ?? ""}
            initialLongitude={hotel.longitude?.toString() ?? ""}
          />
        </PanelBody>
      </Panel>

      <Panel>
        <PanelHeader title="Review history" description="Publication decisions for this property." />
        <div className="p-table-wrap rounded-none border-0 bg-transparent">
          <table className="p-table">
            <thead>
              <tr>
                <th>From</th>
                <th>To</th>
                <th>Reason</th>
                <th className="text-right">Decided</th>
              </tr>
            </thead>
            <tbody>
              {reviews.length === 0 && (
                <tr>
                  <td colSpan={4} className="p-empty">
                    <EmptyState title="No reviews yet" description="Publication decisions will appear here." />
                  </td>
                </tr>
              )}
              {reviews.map((review) => (
                <tr key={review.id}>
                  <td>
                    <StatusPill status={review.fromStatus} />
                  </td>
                  <td>
                    <StatusPill status={review.toStatus} />
                  </td>
                  <td className="text-slate-400">{review.decisionReason ?? "—"}</td>
                  <td className="text-right whitespace-nowrap text-slate-400">
                    {formatDateTime(review.decidedAt)}
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
