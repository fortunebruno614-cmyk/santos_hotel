import Link from "next/link";
import { listOrganizations } from "@/server/platform/organizations";
import { listPublishedHotels } from "@/server/public/hotels";
import { listPendingKycSubmissions } from "@/server/onboarding/kyc";

export default async function PlatformHomePage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const sp = await searchParams;
  const [organizations, published, pendingKyc] = await Promise.all([
    listOrganizations(),
    listPublishedHotels(),
    listPendingKycSubmissions(),
  ]);
  const hotelCount = organizations.reduce((sum, org) => sum + org._count.hotels, 0);

  return (
    <div className="space-y-6">
      {sp.created === "1" && (
        <p className="rounded-md border border-green-200 bg-green-50 px-3 py-2 text-sm text-green-800">
          Organization created. The owner can now sign in at /staff/login.
        </p>
      )}
      <div>
        <h1 className="text-2xl font-semibold">Marketplace</h1>
        <p className="text-sm text-zinc-500">
          {organizations.length} organizations · {hotelCount} properties · {published.length}{" "}
          published
        </p>
      </div>

      {pendingKyc.length > 0 && (
        <section className="rounded-xl border border-amber-200 bg-amber-50/70 p-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <h2 className="font-medium text-amber-900">Business verification queue</h2>
              <p className="text-xs text-amber-800">
                {pendingKyc.length} submission{pendingKyc.length === 1 ? "" : "s"} awaiting review.
              </p>
            </div>
          </div>
          <ul className="mt-3 space-y-1.5 text-sm">
            {pendingKyc.map((entry) => (
              <li key={entry.organizationId} className="flex flex-wrap items-center gap-2">
                <Link
                  href={`/platform/organizations/${entry.organizationId}`}
                  className="font-medium text-amber-900 underline-offset-4 hover:underline"
                >
                  {entry.legalName}
                </Link>
                <span className="text-xs text-amber-800">
                  {entry.organizationName} · {entry.documentName} · submitted{" "}
                  {entry.submittedAt.slice(0, 10)}
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}

      <div className="space-y-3">
        {organizations.map((org) => (
          <section key={org.id} className="rounded-md border p-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <Link
                  href={`/platform/organizations/${org.id}`}
                  className="font-medium underline"
                >
                  {org.name}
                </Link>
                <p className="text-xs text-zinc-500">
                  {org.slug} · {org.status} · {org._count.members} members
                </p>
              </div>
              <span className="text-xs text-zinc-500">
                {org._count.hotels} propert{org._count.hotels === 1 ? "y" : "ies"}
              </span>
            </div>
            <ul className="mt-3 space-y-1 text-sm">
              {org.hotels.map((hotel) => (
                <li key={hotel.id} className="flex flex-wrap items-center gap-2">
                  <Link href={`/platform/hotels/${hotel.id}`} className="underline">
                    {hotel.name}
                  </Link>
                  <span className="text-xs text-zinc-500">
                    {hotel.city ?? "—"}, {hotel.country ?? "—"} · {hotel.currency} ·{" "}
                    {hotel.publicationStatus}
                  </span>
                </li>
              ))}
              {org.hotels.length === 0 && (
                <li className="text-xs text-zinc-500">No properties yet.</li>
              )}
            </ul>
          </section>
        ))}
        {organizations.length === 0 && (
          <div className="rounded-md border p-6 text-sm text-zinc-500">
            No organizations yet.{" "}
            <Link href="/platform/organizations/new" className="underline">
              Onboard the first hotel business
            </Link>
            .
          </div>
        )}
      </div>
    </div>
  );
}
