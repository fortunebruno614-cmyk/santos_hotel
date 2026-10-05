import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { guardApi } from "@/server/auth/api";
import { AppRole, Permissions } from "@/server/auth/roles";

export async function GET() {
  const auth = await guardApi({
    route: "/api/admin/users",
    roles: [AppRole.ADMIN],
    permission: Permissions.MANAGE_USERS,
  });
  if (auth instanceof NextResponse) return auth;

  const users = await prisma.user.findMany({
    select: { id: true, name: true, email: true, role: true, isActive: true },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json(users);
}
