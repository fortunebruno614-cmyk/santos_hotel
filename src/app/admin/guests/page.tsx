import Link from "next/link";
import {
  EmptyRow,
  Field,
  PageHeader,
  Pagination,
  ResultCount,
  StatusBadge,
  TableShell,
  Toolbar,
} from "@/components/admin/ui";
import { Button } from "@/components/ui/button";
import { searchGuests } from "@/server/console/guests";
import { getConsoleContext } from "@/server/console/context";
import { GuestSearchSchema } from "@/server/console/validation";

/** Guest records (P7): searchable customer list for the front desk. */
export default async function AdminGuestsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const sp = await searchParams;
  const parsed = GuestSearchSchema.safeParse({
    q: sp.q ?? undefined,
    page: sp.page ?? undefined,
    pageSize: sp.pageSize ?? undefined,
  });
  const query = parsed.success ? parsed.data : GuestSearchSchema.parse({});

  const { hotel } = await getConsoleContext();
  const result = await searchGuests(hotel.id, query);
  const pages = Math.max(1, Math.ceil(result.total / query.pageSize));

  const hrefFor = (page: number) => {
    const params = new URLSearchParams();
    if (query.q) params.set("q", query.q);
    if (page > 1) params.set("page", String(page));
    const search = params.toString();
    return search ? `/admin/guests?${search}` : "/admin/guests";
  };

  return (
    <div className="space-y-5">
      <PageHeader
        title="Guests"
        description="Everyone who has booked with the property. Open a guest to correct contact details or review their stay history."
      />

      <Toolbar>
        <form method="get" action="/admin/guests" className="flex flex-wrap items-end gap-3">
          <Field label="Search" className="w-64">
            <input
              name="q"
              defaultValue={query.q ?? ""}
              placeholder="Name, e-mail or phone…"
            />
          </Field>
          <Button type="submit" size="sm">
            Search
          </Button>
          <Button asChild variant="ghost" size="sm">
            <Link href="/admin/guests">Reset</Link>
          </Button>
        </form>
      </Toolbar>

      <ResultCount>
        {result.total} guest{result.total === 1 ? "" : "s"} · page {result.page} of {pages}
      </ResultCount>

      <TableShell>
        <thead>
          <tr>
            <th>Name</th>
            <th>E-mail</th>
            <th>Phone</th>
            <th className="text-right">Bookings</th>
            <th>Last stay</th>
            <th>Status</th>
          </tr>
        </thead>
        <tbody>
          {result.rows.length === 0 && <EmptyRow colSpan={6}>No guests match this search.</EmptyRow>}
          {result.rows.map((guest) => (
            <tr key={guest.id}>
              <td>
                <Link
                  href={`/admin/guests/${guest.id}`}
                  className="font-medium text-primary hover:underline"
                >
                  {guest.firstName} {guest.lastName}
                </Link>
              </td>
              <td className="admin-cell-muted">{guest.email ?? "—"}</td>
              <td className="admin-cell-muted">{guest.phone ?? "—"}</td>
              <td className="text-right tabular-nums">{guest.bookingCount}</td>
              <td>{guest.lastStay ?? "—"}</td>
              <td>
                <StatusBadge
                  status={guest.isActive ? "ACTIVE" : "INACTIVE"}
                  label={guest.isActive ? "Active" : "Inactive"}
                />
              </td>
            </tr>
          ))}
        </tbody>
      </TableShell>

      <Pagination page={result.page} pages={pages} hrefFor={hrefFor} />
    </div>
  );
}
