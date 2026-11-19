import Link from "next/link";
import {
  EmptyRow,
  Field,
  PageHeader,
  Pagination,
  ResultCount,
  TableShell,
  Toolbar,
} from "@/components/admin/ui";
import { Button } from "@/components/ui/button";
import { searchAudit } from "@/server/console/audit";
import { getConsoleContext } from "@/server/console/context";
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

  const { hotel } = await getConsoleContext();
  const result = await searchAudit(hotel.id, query);
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
    const search = next.toString();
    return search ? `/admin/audit?${search}` : "/admin/audit";
  };

  return (
    <div className="space-y-5">
      <PageHeader
        title="Audit log"
        description="Every mutating admin action with its actor and old → new values. Retention and rotation are handled by the database administrator, not this screen."
      />

      <Toolbar>
        <form method="get" action="/admin/audit" className="flex flex-wrap items-end gap-3">
          <Field label="Action contains" className="w-40">
            <input name="action" defaultValue={query.action ?? ""} placeholder="room_type." />
          </Field>
          <Field label="Entity type" className="w-36">
            <input name="entityType" defaultValue={query.entityType ?? ""} placeholder="hotel" />
          </Field>
          <Field label="Entity id" className="w-64">
            <input name="entityId" defaultValue={query.entityId ?? ""} />
          </Field>
          <Field label="From" className="w-40">
            <input type="date" name="from" defaultValue={query.from ?? ""} />
          </Field>
          <Field label="To" className="w-40">
            <input type="date" name="to" defaultValue={query.to ?? ""} />
          </Field>
          <Button type="submit" size="sm">
            Filter
          </Button>
          <Button asChild variant="ghost" size="sm">
            <Link href="/admin/audit">Reset</Link>
          </Button>
        </form>
      </Toolbar>

      <ResultCount>
        {result.total} entr{result.total === 1 ? "y" : "ies"} · page {result.page} of {pages}
      </ResultCount>

      <TableShell>
        <thead>
          <tr>
            <th>When</th>
            <th>Actor</th>
            <th>Action</th>
            <th>Entity</th>
            <th>Old values</th>
            <th>New values</th>
          </tr>
        </thead>
        <tbody>
          {result.rows.length === 0 && (
            <EmptyRow colSpan={6}>No audit entries match this filter.</EmptyRow>
          )}
          {result.rows.map((log) => (
            <tr key={log.id}>
              <td className="whitespace-nowrap text-muted-foreground">
                {log.createdAt.slice(0, 16).replace("T", " ")}
              </td>
              <td>
                {log.user ? (
                  <>
                    <span className="font-medium">{log.user.name}</span>
                    <span className="block text-xs text-muted-foreground">{log.user.email}</span>
                  </>
                ) : (
                  <span className="text-xs text-muted-foreground">system/guest</span>
                )}
              </td>
              <td>
                <span className="admin-mono rounded bg-muted px-1.5 py-0.5">{log.action}</span>
              </td>
              <td>
                <span className="block">{log.entityType}</span>
                <span className="admin-mono block break-all text-muted-foreground">
                  {log.entityId}
                </span>
              </td>
              <td className="max-w-xs break-all text-xs text-muted-foreground">
                {formatValues(log.oldValues)}
              </td>
              <td className="max-w-xs break-all text-xs">{formatValues(log.newValues)}</td>
            </tr>
          ))}
        </tbody>
      </TableShell>

      <Pagination page={result.page} pages={pages} hrefFor={pageHref} />
    </div>
  );
}
