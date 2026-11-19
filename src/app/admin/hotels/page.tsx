import Link from "next/link";
import { Plus } from "lucide-react";
import {
  Notice,
  PageHeader,
  StatusBadge,
  TableShell,
} from "@/components/admin/ui";
import { Button } from "@/components/ui/button";
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
    <div className="space-y-5">
      <PageHeader
        title="Hotels"
        description={`Properties in ${member.organization.name}. The property selected in the header is marked as active.`}
        actions={
          canCreate ? (
            <Button asChild size="sm">
              <Link href="/admin/hotels/new">
                <Plus /> Add hotel
              </Link>
            </Button>
          ) : undefined
        }
      />

      {sp.submitted === "1" && (
        <Notice tone="success" title="Submitted for review">
          Property submitted for marketplace review.
        </Notice>
      )}
      {error && <Notice tone="danger">{error}</Notice>}

      <TableShell>
        <thead>
          <tr>
            <th>Property</th>
            <th>Slug</th>
            <th>Publication</th>
            <th>Currency</th>
            <th>Active</th>
            <th className="text-right">Action</th>
          </tr>
        </thead>
        <tbody>
          {hotels.map((row) => (
            <tr key={row.id}>
              <td className="admin-cell-strong">{row.name}</td>
              <td>
                <span className="admin-mono text-muted-foreground">{row.slug}</span>
              </td>
              <td>
                <StatusBadge status={row.publicationStatus} />
              </td>
              <td>{row.currency}</td>
              <td>
                {row.id === hotel.id ? (
                  <StatusBadge status="ACTIVE" label="Active" />
                ) : (
                  <span className="text-muted-foreground">—</span>
                )}
              </td>
              <td className="text-right">
                {row.publicationStatus === "DRAFT" && (
                  <form action={submitHotelForReviewAction}>
                    <input type="hidden" name="hotelId" value={row.id} />
                    <Button type="submit" variant="outline" size="sm">
                      Submit for review
                    </Button>
                  </form>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </TableShell>

      <p className="text-xs text-muted-foreground">
        Use the property selector in the header to switch context before adding rooms, rates or
        content.
      </p>
    </div>
  );
}
