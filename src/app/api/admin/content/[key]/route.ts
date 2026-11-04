import { NextResponse } from "next/server";
import { guardApi, guardTenantHotel } from "@/server/auth/api";
import { AppRole, Permissions } from "@/server/auth/roles";
import { deleteContent } from "@/server/console/settings";
import { consoleErrorResponse } from "@/server/console/errors";

type Params = { params: Promise<{ key: string }> };

/** Reset a content slot to its built-in default (audited as `content.delete`). */
export async function DELETE(_request: Request, { params }: Params) {
  const auth = await guardApi({
    route: "/api/admin/content/[key]",
    roles: [AppRole.ADMIN],
    permission: Permissions.MANAGE_CONTENT,
  });
  if (auth instanceof NextResponse) return auth;
  const tenant = await guardTenantHotel(auth, Permissions.MANAGE_CONTENT);
  if (tenant instanceof NextResponse) return tenant;
  const { key } = await params;

  try {
    return NextResponse.json(
      await deleteContent(tenant.hotelId, key, { userId: auth.userId! }),
    );
  } catch (error) {
    return consoleErrorResponse(error);
  }
}
