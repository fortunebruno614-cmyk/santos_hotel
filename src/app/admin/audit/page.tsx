import Link from "next/link";
import { searchAudit } from "@/server/console/audit";
import { AuditSearchSchema } from "@/server/console/validation";

/** Audit trail (P7, admin only): who changed what, old → new values. */

function formatValues(values: unknown): string {
  if (values === null || values === undefined) return "—";
  if (typeof values !== "object") return String(values);
  const entries = Object.entries(values as Record<string, unknown>);
  if (entries.length === 0) return "—";
  return entries.map(([key, value]) => `${key}=${String(value)}`).join(", ");
}

export default async function AdminAuditPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const sp = await searchParams;
  const parsed = AuditSearchSchema.safeParse({
    action: sp.action ?? undefined,
    entityType: sp.entityType ?? undefined,
    entityId: sp.entityId ?? undefined,
    userId: sp.userId ?? undefined,
    from: sp.from ?? undefined,
    to: sp.to ?? undefined,
    page: sp.page ?? undefined,
    pageSize: sp.pageSize ?? undefined,
  });
  const query = parsed.success ? parsed.data : AuditSearchSchema.parse({});

  const result = await searchAudit(query);
  const pages = Math.max(1, Math.ceil(result.total / query.pageSize));

  const pageHref = (page: number) => {
    const next = new URLSearchParams();
    if (query.action) next.set("action", query.action);
    if (query.entityType) next.set("entityType", query.entityType);
    if (query.entityId) next.set("entityId", query.entityId);
    if (query.userId) next.set("userId", query.userId);
    if (query.from) next.set("from", query.from);
    if (query.to) next.set("to", query.to);
    if (page > 1) next.set("page", String(page));
    return `/admin/audit?${next.toString()}`;
  };

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold">Audit log</h1>
        <p className="text-sm text-zinc-500">
          Every mutating admin action with actor and old → new values. Retention and rotation
          are handled by the database admin, not the UI.
        </p>
      </div>

      <form method="get" action="/admin/audit" className="flex flex-wrap items-end gap-3 text-sm">
        <label className="flex flex-col gap-1">
          <span className="text-xs text-zinc-500">Action contains</span>
          <input
            name="action"
            defaultValue={query.action ?? ""}
            placeholder="room_type."
            className="border px-2 py-1 rounded-md w-40"
          />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-xs text-zinc-500">Entity type</span>
          <input
            name="entityType"
            defaultValue={query.entityType ?? ""}
            placeholder="hotel"
            className="border px-2 py-1 rounded-md w-36"
          />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-xs text-zinc-500">Entity id</span>
          <input
            name="entityId"
            defaultValue={query.entityId ?? ""}
            className="border px-2 py-1 rounded-md w-64"
          />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-xs text-zinc-500">From</span>
          <input
            type="date"
            name="from"
            defaultValue={query.from ?? ""}
            className="border px-2 py-1 rounded-md"
          />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-xs text-zinc-500">To</span>
          <input
            type="date"
            name="to"
            defaultValue={query.to ?? ""}
            className="border px-2 py-1 rounded-md"
          />
        </label>
        <button className="border px-3 py-1 rounded-md">Filter</button>
        <Link href="/admin/audit" className="text-zinc-500 underline">
          Reset
        </Link>
      </form>

      <p className="text-sm text-zinc-500">
        {result.total} entr{result.total === 1 ? "y" : "ies"} · page {result.page} of {pages}
      </p>

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b text-left">
              <th className="py-2 pr-3">When</th>
              <th className="py-2 pr-3">Actor</th>
              <th className="py-2 pr-3">Action</th>
              <th className="py-2 pr-3">Entity</th>
              <th className="py-2 pr-3">Old values</th>
              <th className="py-2">New values</th>
            </tr>
          </thead>
          <tbody>
            {result.rows.length === 0 && (
              <tr>
                <td colSpan={6} className="py-4 text-zinc-500">
                  No audit entries match this filter.
                </td>
              </tr>
            )}
            {result.rows.map((log) => (
              <tr key={log.id} className="border-b last:border-0 align-top">
                <td className="py-2 pr-3 whitespace-nowrap">{log.createdAt.slice(0, 16).replace("T", " ")}</td>
                <td className="py-2 pr-3">
                  {log.user ? (
                    <>
                      <span className="font-medium">{log.user.name}</span>
                      <span className="block text-xs text-zinc-500">{log.user.email}</span>
                    </>
                  ) : (
                    <span className="text-xs text-zinc-400">system/guest</span>
                  )}
                </td>
                <td className="py-2 pr-3 font-mono text-xs">{log.action}</td>
                <td className="py-2 pr-3">
                  <span className="block">{log.entityType}</span>
                  <span className="block text-xs text-zinc-500 font-mono break-all">{log.entityId}</span>
                </td>
                <td className="py-2 pr-3 text-xs max-w-xs break-all">{formatValues(log.oldValues)}</td>
                <td className="py-2 text-xs max-w-xs break-all">{formatValues(log.newValues)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="flex gap-3 text-sm">
        {result.page > 1 && (
          <Link href={pageHref(result.page - 1)} className="underline">
            ← Previous
          </Link>
        )}
        {result.page < pages && (
          <Link href={pageHref(result.page + 1)} className="underline">
            Next →
          </Link>
        )}
      </div>
    </div>
  );
}
