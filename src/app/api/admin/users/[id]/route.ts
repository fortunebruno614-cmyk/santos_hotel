import { NextResponse } from "next/server";
import { guardApi } from "@/server/auth/api";
import { AppRole, Permissions } from "@/server/auth/roles";
import { deleteUser, updateUser } from "@/server/console/users";
import { UserUpdateSchema } from "@/server/console/validation";
import { consoleErrorResponse } from "@/server/console/errors";
import { invalidBody } from "@/server/booking/http";

type Params = { params: Promise<{ id: string }> };

/**
 * One staff/admin account.
 *
 *   PATCH  /api/admin/users/{id}  — name, role, isActive, password
 *   DELETE /api/admin/users/{id}  — remove the account (never self, never the
 *                                   last active administrator)
 *
 * Both are audited (`permission.change` for role moves, `user.update` /
 * `user.delete` for the rest) with the old and new values.
 */
export async function PATCH(request: Request, { params }: Params) {
  const auth = await guardApi({
    route: "/api/admin/users/:id",
    roles: [AppRole.ADMIN],
    permission: Permissions.MANAGE_USERS,
  });
  if (auth instanceof NextResponse) return auth;

  const { id } = await params;
  const parsed = UserUpdateSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return invalidBody(parsed.error.flatten().fieldErrors);

  try {
    const updated = await updateUser(id, parsed.data, { userId: auth.userId! });
    return NextResponse.json({
      id: updated.id,
      name: updated.name,
      role: updated.role,
      isActive: updated.isActive,
    });
  } catch (error) {
    return consoleErrorResponse(error);
  }
}

export async function DELETE(_request: Request, { params }: Params) {
  const auth = await guardApi({
    route: "/api/admin/users/:id",
    roles: [AppRole.ADMIN],
    permission: Permissions.MANAGE_USERS,
  });
  if (auth instanceof NextResponse) return auth;

  const { id } = await params;
  try {
    return NextResponse.json(await deleteUser(id, { userId: auth.userId! }));
  } catch (error) {
    return consoleErrorResponse(error);
  }
}
