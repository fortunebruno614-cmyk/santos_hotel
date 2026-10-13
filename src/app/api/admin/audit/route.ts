import { NextResponse } from "next/server";
import { guardApi } from "@/server/auth/api";
import { AppRole, Permissions } from "@/server/auth/roles";
import { searchAudit } from "@/server/console/audit";
import { AuditSearchSchema } from "@/server/console/validation";

/**
 * Audit trail (P7): `GET /api/admin/audit?action=…&entityType=…&userId=…&from=…&to=…&page=…`
 *
 * Every mutating admin action lands here with its old/new values (see
 * `src/server/audit/write.ts`). Filters compose; rows are newest-first.
 */
export async function GET(request: Request) {
  const auth = await guardApi({
    route: "/api/admin/audit",
    roles: [AppRole.ADMIN],
    permission: Permissions.MANAGE_AUDIT,
  });
  if (auth instanceof NextResponse) return auth;

  const params = new URL(request.url).searchParams;
  const parsed = AuditSearchSchema.safeParse({
    action: params.get("action") ?? undefined,
    entityType: params.get("entityType") ?? undefined,
    entityId: params.get("entityId") ?? undefined,
    userId: params.get("userId") ?? undefined,
    from: params.get("from") ?? undefined,
    to: params.get("to") ?? undefined,
    page: params.get("page") ?? undefined,
    pageSize: params.get("pageSize") ?? undefined,
  });
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid_body" }, { status: 400 });
  }

  return NextResponse.json(await searchAudit(parsed.data));
}
