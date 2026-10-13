import { NextResponse } from "next/server";
import { guardApi } from "@/server/auth/api";
import { AppRole, Permissions } from "@/server/auth/roles";
import { createUser, listUsers } from "@/server/console/users";
import { UserCreateSchema } from "@/server/console/validation";
import { consoleErrorResponse } from "@/server/console/errors";
import { invalidBody } from "@/server/booking/http";

/**
 * Staff/admin accounts (P7).
 *
 *   GET  /api/admin/users           — list (name, email, role, active, last login)
 *   POST /api/admin/users           — create a staff or admin account
 *
 * Passwords are stored as scrypt hashes; the plain value is never returned or
 * written to the audit log.
 */
export async function GET() {
  const auth = await guardApi({
    route: "/api/admin/users",
    roles: [AppRole.ADMIN],
    permission: Permissions.MANAGE_USERS,
  });
  if (auth instanceof NextResponse) return auth;

  const users = await listUsers();
  return NextResponse.json(
    users.map((user) => ({
      ...user,
      lastLoginAt: user.lastLoginAt ? user.lastLoginAt.toISOString() : null,
      createdAt: user.createdAt.toISOString(),
    })),
  );
}

export async function POST(request: Request) {
  const auth = await guardApi({
    route: "/api/admin/users",
    roles: [AppRole.ADMIN],
    permission: Permissions.MANAGE_USERS,
  });
  if (auth instanceof NextResponse) return auth;

  const parsed = UserCreateSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return invalidBody(parsed.error.flatten().fieldErrors);

  try {
    const created = await createUser(parsed.data, { userId: auth.userId! });
    return NextResponse.json({ id: created.id }, { status: 201 });
  } catch (error) {
    return consoleErrorResponse(error);
  }
}
