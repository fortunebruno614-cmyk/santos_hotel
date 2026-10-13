import { NextResponse } from "next/server";
import { guardApi } from "@/server/auth/api";
import { AppRole, Permissions } from "@/server/auth/roles";
import { searchGuests } from "@/server/console/guests";
import { GuestSearchSchema } from "@/server/console/validation";

/**
 * Guest records (P7): `GET /api/admin/guests?q=name-or-email&page=…`.
 *
 * Permission-gated with VIEW_GUESTS — a signed-in guest session can never read
 * the customer list (the access map plus this guard enforce it).
 */
export async function GET(request: Request) {
  const auth = await guardApi({
    route: "/api/admin/guests",
    roles: [AppRole.STAFF, AppRole.ADMIN],
    permission: Permissions.VIEW_GUESTS,
  });
  if (auth instanceof NextResponse) return auth;

  const params = new URL(request.url).searchParams;
  const parsed = GuestSearchSchema.safeParse({
    q: params.get("q") ?? undefined,
    page: params.get("page") ?? undefined,
    pageSize: params.get("pageSize") ?? undefined,
  });
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid_body" }, { status: 400 });
  }

  return NextResponse.json(await searchGuests(parsed.data));
}
