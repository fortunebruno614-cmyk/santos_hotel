import Link from "next/link";
import { getConsoleContext } from "@/server/console/context";
import { accessibleHotels } from "@/server/auth/tenancy";
import { Permissions, hasOrgPermission } from "@/server/auth/roles";
import { submitHotelForReviewAction } from "@/server/console/hotel-actions";

const MESSAGES: Record<string, string> = {
  invalid_transition: "That property is not in a submittable state.",
  incomplete_listing: "The property needs its business details and inventory first.",
  not_found: "Property not found.",
};

export default async function AdminHotelsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const sp = await searchParams;
  const { member, hotel } = await getConsoleContext(Permissions.MANAGE_HOTELS);
  const hotels = await accessibleHotels(member);
  const canCreate = hasOrgPermission(member.role, Permissions.MANAGE_HOTELS);
  const error = MESSAGES[sp.error ?? ""] ?? null;

  return (
    <div className="space-y-4">
      {sp.submitted === "1" && (
        <p className="rounded-md border border-green-200 bg-green-50 px-3 py-2 text-sm text-green-800">
          Property submitted for marketplace review.
        </p>
      )}
      {error && (
        <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </p>
      )}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Hotels</h1>
          <p className="text-sm text-zinc-500">
            Properties in {member.organization.name}. The active property is marked.
          </p>
        </div>
        {canCreate && (
          <Link href="/admin/hotels/new" className="border px-4 py-2 rounded-md text-sm">
            Add hotel
          </Link>
        )}
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b text-left">
              <th className="py-2 pr-4">Property</th>
              <th className="py-2 pr-4">Slug</th>
              <th className="py-2 pr-4">Publication</th>
              <th className="py-2 pr-4">Currency</th>
              <th className="py-2 pr-4">Active</th>
              <th className="py-2">Action</th>
            </tr>
          </thead>
          <tbody>
            {hotels.map((row) => (
              <tr key={row.id} className="border-b last:border-0">
                <td className="py-2 pr-4 font-medium">{row.name}</td>
                <td className="py-2 pr-4 font-mono text-xs">{row.slug}</td>
                <td className="py-2 pr-4">{row.publicationStatus}</td>
                <td className="py-2 pr-4">{row.currency}</td>
                <td className="py-2 pr-4">{row.id === hotel.id ? "Yes" : ""}</td>
                <td className="py-2">
                  {row.publicationStatus === "DRAFT" && (
                    <form action={submitHotelForReviewAction}>
                      <input type="hidden" name="hotelId" value={row.id} />
                      <button className="border px-3 py-1 rounded-md text-xs">
                        Submit for review
                      </button>
                    </form>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <p className="text-xs text-zinc-500">
        Use the property selector in the header to switch context before adding rooms, rates
        or content.
      </p>
    </div>
  );
}
