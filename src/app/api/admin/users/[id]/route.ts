import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { guardApi } from "@/server/auth/api";
import { AppRole, Permissions } from "@/server/auth/roles";
import { auditPermissionChange } from "@/server/audit/write";

const RoleSchema = z.object({
  role: z.enum([AppRole.ADMIN, AppRole.STAFF]),
});

type Params = { params: Promise<{ id: string }> };

export async function PATCH(request: Request, { params }: Params) {
  const auth = await guardApi({
    route: "/api/admin/users/:id",
    roles: [AppRole.ADMIN],
    permission: Permissions.MANAGE_USERS,
  });
  if (auth instanceof NextResponse) return auth;

  const { id } = await params;
  const body = await request.json().catch(() => null);
  const parsed = RoleSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid_body" }, { status: 400 });
  }

  const target = await prisma.user.findUnique({ where: { id } });
  if (!target) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  const oldRole = target.role;
  const newRole = parsed.data.role;

  // Never let an admin lock the last administrator out of the console.
  if (target.id === auth.userId && newRole !== AppRole.ADMIN) {
    return NextResponse.json({ error: "cannot_demote_self" }, { status: 400 });
  }

  if (oldRole !== newRole) {
    await prisma.user.update({ where: { id }, data: { role: newRole } });
    await auditPermissionChange(auth.userId!, target.id, oldRole, newRole);
  }

  return NextResponse.json({ id: target.id, role: newRole });
}
