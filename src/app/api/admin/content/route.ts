import { NextResponse } from "next/server";
import { guardApi } from "@/server/auth/api";
import { AppRole, Permissions } from "@/server/auth/roles";
import { listContent, upsertContent } from "@/server/console/settings";
import { ContentUpsertSchema } from "@/server/console/validation";
import { consoleErrorResponse } from "@/server/console/errors";
import { invalidBody } from "@/server/booking/http";

/**
 * Website content (P7, admin only).
 *
 *   GET  /api/admin/content            — every slot (stored value or default)
 *   POST /api/admin/content            — create/update a slot (upsert by key)
 *   DELETE /api/admin/content/{key}    — reset a slot back to its default
 */
export async function GET() {
  const auth = await guardApi({
    route: "/api/admin/content",
    roles: [AppRole.ADMIN],
    permission: Permissions.MANAGE_CONTENT,
  });
  if (auth instanceof NextResponse) return auth;

  return NextResponse.json(await listContent());
}

export async function POST(request: Request) {
  const auth = await guardApi({
    route: "/api/admin/content",
    roles: [AppRole.ADMIN],
    permission: Permissions.MANAGE_CONTENT,
  });
  if (auth instanceof NextResponse) return auth;

  const parsed = ContentUpsertSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return invalidBody(parsed.error.flatten().fieldErrors);

  try {
    return NextResponse.json(await upsertContent(parsed.data, { userId: auth.userId! }));
  } catch (error) {
    return consoleErrorResponse(error);
  }
}
