import Link from "next/link";
import { bookingStatusLabel } from "@/components/labels";
import { getDashboard } from "@/server/console/dashboard";

/**
 * P7 dashboard — today at a glance: arrivals, departures, in-house guests,
 * tonight's occupancy and the 7-night availability board. Every figure comes
 * from the same tables the rest of the console writes, in the hotel's own
 * timezone (`hotelToday`).
 */
export default async function AdminPage() {
  const data = await getDashboard();

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-baseline justify-between gap-3">
        <h1 className="text-2xl font-semibold">Dashboard</h1>
        <p className="text-sm text-zinc-500">
          {data.today} · check-in {data.checkInTime} · check-out {data.checkOutTime} ·{" "}
          {data.currency}
        </p>
      </div>

      <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="Arrivals today" value={String(data.arrivals.length)} hint="due in" />
        <Stat
          label="Departures today"
          value={String(data.departures.length)}
          hint={`${data.checkedOutToday} already checked out`}
        />
        <Stat label="In house" value={String(data.inHouse.length)} hint="checked in now" />
        <Stat
          label="Occupancy tonight"
          value={`${data.occupancy.percent}%`}
          hint={`${data.occupancy.sold}/${data.occupancy.sellable} rooms sold`}
        />
      </ul>

      <ul className="grid gap-3 sm:grid-cols-4">
        <Stat label="Available" value={String(data.housekeeping.available)} hint="rooms ready" />
        <Stat label="Cleaning" value={String(data.housekeeping.cleaning)} hint="rooms" />
        <Stat label="Maintenance" value={String(data.housekeeping.maintenance)} hint="rooms" />
        <Stat
          label="Out of service"
          value={String(data.housekeeping.outOfService)}
          hint="rooms"
        />
      </ul>

      <section className="space-y-2">
        <h2 className="text-lg font-medium">Arrivals</h2>
        <BookingTable
          rows={data.arrivals}
          empty="No arrivals scheduled for today."
          currency={data.currency}
        />
      </section>

      <section className="space-y-2">
        <h2 className="text-lg font-medium">Departures</h2>
        <BookingTable
          rows={data.departures}
          empty="No guests are due to check out today."
          currency={data.currency}
        />
      </section>

      <section className="space-y-2">
        <div className="flex items-baseline justify-between">
          <h2 className="text-lg font-medium">Availability board — next {data.board.nights.length} nights</h2>
          <Link href="/admin/rooms" className="text-sm underline">
            Manage rooms →
          </Link>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-left">
                <th className="py-2 pr-3">Room</th>
                <th className="py-2 pr-3">Type</th>
                {data.board.nights.map((night) => (
                  <th key={night} className="py-2 pr-2 text-center whitespace-nowrap">
                    {night.slice(5)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {data.board.rooms.map((room) => (
                <tr key={room.id} className="border-b last:border-0">
                  <td className="py-1 pr-3 font-medium">{room.roomNumber}</td>
                  <td className="py-1 pr-3">{room.roomTypeName}</td>
                  {room.cells.map((cell) => (
                    <td
                      key={cell.night}
                      className={`py-1 pr-2 text-center text-xs whitespace-nowrap ${
                        cell.kind === "sold"
                          ? "bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900"
                          : cell.kind === "blocked"
                            ? "bg-red-100 text-red-700"
                            : "text-zinc-400"
                      }`}
                      title={cell.bookingReference ?? cell.kind}
                    >
                      {cell.kind === "sold" ? cell.bookingReference?.slice(-6) : cell.kind === "blocked" ? "×" : "·"}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="text-xs text-zinc-500">
          Filled = sold night (last 6 of the reference) · × = blocked (maintenance/out of
          service) · · = free
        </p>
      </section>
    </div>
  );
}

function Stat({ label, value, hint }: { label: string; value: string; hint: string }) {
  return (
    <li className="border rounded-md p-4">
      <p className="text-sm text-zinc-500">{label}</p>
      <p className="text-2xl font-semibold">{value}</p>
      <p className="text-xs text-zinc-500">{hint}</p>
    </li>
  );
}

type Row = {
  id: string;
  bookingReference: string;
  guestName: string;
  roomNumbers: string[];
  total: string;
  bookingStatus: string;
  paymentStatus: string;
  notes: string | null;
};

function BookingTable({
  rows,
  empty,
  currency,
}: {
  rows: Row[];
  empty: string;
  currency: string;
}) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b text-left">
            <th className="py-2 pr-4">Reference</th>
            <th className="py-2 pr-4">Guest</th>
            <th className="py-2 pr-4">Rooms</th>
            <th className="py-2 pr-4">Status</th>
            <th className="py-2 pr-4">Payment</th>
            <th className="py-2">Total</th>
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 && (
            <tr>
              <td colSpan={6} className="py-4 text-zinc-500">
                {empty}
              </td>
            </tr>
          )}
          {rows.map((row) => (
            <tr key={row.id} className="border-b last:border-0">
              <td className="py-2 pr-4">
                <Link href={`/admin/bookings/${row.id}`} className="font-mono underline">
                  {row.bookingReference}
                </Link>
              </td>
              <td className="py-2 pr-4">{row.guestName}</td>
              <td className="py-2 pr-4">{row.roomNumbers.join(", ")}</td>
              <td className="py-2 pr-4">{bookingStatusLabel(row.bookingStatus)}</td>
              <td className="py-2 pr-4">{row.paymentStatus}</td>
              <td className="py-2">
                {row.total} {currency}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
