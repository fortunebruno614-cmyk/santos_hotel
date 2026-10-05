import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { guardApi } from "@/server/auth/api";
import { AppRole, Permissions } from "@/server/auth/roles";

export async function GET() {
  const auth = await guardApi({
    route: "/api/admin/audit",
    roles: [AppRole.ADMIN],
    permission: Permissions.MANAGE_AUDIT,
  });
  if (auth instanceof NextResponse) return auth;

  const logs = await prisma.auditLog.findMany({
    take: 100,
    orderBy: { createdAt: "desc" },
    select: { id: true, action: true, entityType: true, entityId: true, createdAt: true },
  });

  return NextResponse.json(logs);
}
