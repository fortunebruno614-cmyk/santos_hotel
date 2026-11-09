import Link from "next/link";
import { notFound } from "next/navigation";
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
      _count: { select: { roomTypes: true, rooms: true } },
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
      <div>
        <Link href={`/platform/organizations/${hotel.organization.id}`} className="text-sm underline">
          ← {hotel.organization.name}
        </Link>
        <h1 className="text-2xl font-semibold">{hotel.name}</h1>
        <p className="text-sm text-zinc-500">
          {hotel.slug} · {PUBLICATION_LABELS[hotel.publicationStatus]} ·{" "}
          {hotel._count.roomTypes} room types · {hotel._count.rooms} rooms
        </p>
      </div>

      <section className="grid gap-4 md:grid-cols-2">
        <div className="rounded-md border p-4 text-sm">
          <h2 className="font-medium">Business information</h2>
          <p className="mt-2 text-zinc-600">{hotel.description ?? "No description yet."}</p>
          <dl className="mt-3 space-y-1">
            <div>
              <dt className="text-xs text-zinc-500">Address</dt>
              <dd>{address || "Not set"}</dd>
            </div>
            <div>
              <dt className="text-xs text-zinc-500">Contact</dt>
              <dd>
                {hotel.email ?? "—"} · {hotel.phone ?? "—"}
              </dd>
            </div>
            <div>
              <dt className="text-xs text-zinc-500">Timezone / currency</dt>
              <dd>
                {hotel.timezone} · {hotel.currency}
              </dd>
            </div>
            <div>
              <dt className="text-xs text-zinc-500">Map</dt>
              <dd>
                {hotel.latitude != null && hotel.longitude != null ? (
                  <a
                    className="underline"
                    href={`https://www.google.com/maps?q=${hotel.latitude},${hotel.longitude}`}
                    target="_blank"
                    rel="noreferrer"
                  >
                    {hotel.latitude.toString()}, {hotel.longitude.toString()} (
                    {hotel.locationVerification})
                  </a>
                ) : (
                  "No verified position"
                )}
              </dd>
            </div>
          </dl>
        </div>

        <div className="rounded-md border p-4 text-sm">
          <h2 className="font-medium">Publication</h2>
          <p className="mt-1 text-zinc-600">
            Current: <strong>{PUBLICATION_LABELS[hotel.publicationStatus]}</strong>
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            {transitions.map((to) => (
              <form key={to} action={transitionPublicationAction} className="flex items-center gap-1">
                <input type="hidden" name="hotelId" value={hotel.id} />
                <input type="hidden" name="to" value={to} />
                {to === "UNDER_REVIEW" || to === "DRAFT" ? (
                  <input
                    name="reason"
                    placeholder="Decision reason"
                    className="border px-2 py-1 rounded-md w-48"
                  />
                ) : null}
                <button className="border px-3 py-1 rounded-md">
                  {to === "PUBLISHED"
                    ? "Publish"
                    : to === "PAUSED"
                      ? "Pause"
                      : to === "SUSPENDED"
                        ? "Suspend"
                        : to === "ARCHIVED"
                          ? "Archive"
                          : PUBLICATION_LABELS[to]}
                </button>
              </form>
            ))}
            {transitions.length === 0 && (
              <p className="text-xs text-zinc-500">Archived listings are read-only.</p>
            )}
          </div>
          <p className="mt-3 text-xs text-zinc-500">
            Publishing requires name, contact, address, city, country, and at least one active
            room type with a physical room.
          </p>
        </div>
      </section>

      <VerifyLocationForm
        hotelId={hotel.id}
        initialLatitude={hotel.latitude?.toString() ?? ""}
        initialLongitude={hotel.longitude?.toString() ?? ""}
      />

      <section className="space-y-2">
        <h2 className="text-lg font-medium">Review history</h2>
        <ul className="space-y-1 text-sm">
          {reviews.map((review) => (
            <li key={review.id} className="border-b py-1 last:border-0">
              {review.fromStatus} → {review.toStatus} ·{" "}
              {review.decidedAt.toISOString().slice(0, 16).replace("T", " ")} UTC
              {review.decisionReason ? ` · ${review.decisionReason}` : ""}
            </li>
          ))}
          {reviews.length === 0 && <li className="text-zinc-500">No reviews yet.</li>}
        </ul>
      </section>
    </div>
  );
}
