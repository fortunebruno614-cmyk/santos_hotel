import Link from "next/link";
import { searchGuests } from "@/server/console/guests";
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

  const result = await searchGuests(query);
  const pages = Math.max(1, Math.ceil(result.total / query.pageSize));

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold">Guests</h1>

      <form method="get" action="/admin/guests" className="flex flex-wrap items-end gap-3 text-sm">
        <label className="flex flex-col gap-1">
          <span className="text-xs text-zinc-500">Search</span>
          <input
            name="q"
            defaultValue={query.q ?? ""}
            placeholder="Name, e-mail or phone…"
            className="border px-2 py-1 rounded-md w-64"
          />
        </label>
        <button className="border px-3 py-1 rounded-md">Search</button>
        <Link href="/admin/guests" className="text-zinc-500 underline">
          Reset
        </Link>
      </form>

      <p className="text-sm text-zinc-500">
        {result.total} guest{result.total === 1 ? "" : "s"} · page {result.page} of {pages}
      </p>

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b text-left">
              <th className="py-2 pr-4">Name</th>
              <th className="py-2 pr-4">E-mail</th>
              <th className="py-2 pr-4">Phone</th>
              <th className="py-2 pr-4">Bookings</th>
              <th className="py-2 pr-4">Last stay</th>
              <th className="py-2">Status</th>
            </tr>
          </thead>
          <tbody>
            {result.rows.length === 0 && (
              <tr>
                <td colSpan={6} className="py-4 text-zinc-500">
                  No guests match this search.
                </td>
              </tr>
            )}
            {result.rows.map((guest) => (
              <tr key={guest.id} className="border-b last:border-0">
                <td className="py-2 pr-4">
                  <Link href={`/admin/guests/${guest.id}`} className="underline font-medium">
                    {guest.firstName} {guest.lastName}
                  </Link>
                </td>
                <td className="py-2 pr-4">{guest.email ?? "—"}</td>
                <td className="py-2 pr-4">{guest.phone ?? "—"}</td>
                <td className="py-2 pr-4">{guest.bookingCount}</td>
                <td className="py-2 pr-4">{guest.lastStay ?? "—"}</td>
                <td className="py-2">{guest.isActive ? "Active" : "Inactive"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
