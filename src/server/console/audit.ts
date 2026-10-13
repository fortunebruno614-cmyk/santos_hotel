import { prisma } from "@/lib/prisma";
import { Prisma } from "@/generated/prisma/client";
import { parseDateOnly } from "@/server/availability/overlap";
import type { AuditSearchInput } from "@/server/console/validation";

/**
 * P7 audit trail search — shared by `GET /api/admin/audit` and the
 * `/admin/audit` page. Filters compose (action prefix, entity, actor, day
 * range); rows are newest-first.
 */

export type AuditLogRow = {
  id: string;
  action: string;
  entityType: string;
  entityId: string;
  oldValues: unknown;
  newValues: unknown;
  createdAt: string;
  user: { id: string; name: string; email: string } | null;
};

export type AuditSearchResult = {
  rows: AuditLogRow[];
  total: number;
  page: number;
  pageSize: number;
};

export async function searchAudit(query: AuditSearchInput): Promise<AuditSearchResult> {
  const conditions: Prisma.AuditLogWhereInput[] = [];
  if (query.action) conditions.push({ action: { contains: query.action, mode: "insensitive" } });
  if (query.entityType) conditions.push({ entityType: query.entityType });
  if (query.entityId) conditions.push({ entityId: query.entityId });
  if (query.userId) conditions.push({ userId: query.userId });
  const from = query.from ? parseDateOnly(query.from) : null;
  const to = query.to ? parseDateOnly(query.to) : null;
  if (from || to) {
    conditions.push({
      createdAt: {
        ...(from ? { gte: from } : {}),
        ...(to ? { lt: new Date(to.getTime() + 86_400_000) } : {}),
      },
    });
  }
  const where: Prisma.AuditLogWhereInput = conditions.length > 0 ? { AND: conditions } : {};

  const [total, logs] = await Promise.all([
    prisma.auditLog.count({ where }),
    prisma.auditLog.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (query.page - 1) * query.pageSize,
      take: query.pageSize,
      select: {
        id: true,
        action: true,
        entityType: true,
        entityId: true,
        oldValues: true,
        newValues: true,
        createdAt: true,
        user: { select: { id: true, name: true, email: true } },
      },
    }),
  ]);

  return {
    total,
    page: query.page,
    pageSize: query.pageSize,
    rows: logs.map((log) => ({ ...log, createdAt: log.createdAt.toISOString() })),
  };
}
