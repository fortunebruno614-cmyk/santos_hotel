import { NextResponse } from "next/server";
import { guardApi } from "@/server/auth/api";
import { AppRole, Permissions } from "@/server/auth/roles";
import { getGuestDetail, updateGuest } from "@/server/console/guests";
import { GuestUpdateSchema } from "@/server/console/validation";
import { consoleErrorResponse } from "@/server/console/errors";
import { invalidBody } from "@/server/booking/http";

type Params = { params: Promise<{ id: string }> };

/** Guest record: `GET /api/admin/guests/{id}`, `PATCH` (contact/ID corrections). */
export async function GET(_request: Request, { params }: Params) {
  const auth = await guardApi({
    route: "/api/admin/guests/[id]",
    roles: [AppRole.STAFF, AppRole.ADMIN],
    permission: Permissions.VIEW_GUESTS,
  });
  if (auth instanceof NextResponse) return auth;
  const { id } = await params;

  try {
    return NextResponse.json(await getGuestDetail(id));
  } catch (error) {
    return consoleErrorResponse(error);
  }
}

export async function PATCH(request: Request, { params }: Params) {
  const auth = await guardApi({
    route: "/api/admin/guests/[id]",
    roles: [AppRole.STAFF, AppRole.ADMIN],
    permission: Permissions.VIEW_GUESTS,
  });
  if (auth instanceof NextResponse) return auth;
  const { id } = await params;

  const parsed = GuestUpdateSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return invalidBody(parsed.error.flatten().fieldErrors);

  try {
    const updated = await updateGuest(id, parsed.data, { userId: auth.userId! });
    return NextResponse.json({ id: updated.id });
  } catch (error) {
    return consoleErrorResponse(error);
  }
}
