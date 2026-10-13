import { NextResponse } from "next/server";
import { guardApi } from "@/server/auth/api";
import { AppRole, Permissions } from "@/server/auth/roles";
import { createAmenity, listAmenities } from "@/server/console/catalog";
import { AmenityUpsertSchema } from "@/server/console/validation";
import { consoleErrorResponse } from "@/server/console/errors";
import { invalidBody } from "@/server/booking/http";

/** Amenities (P7 catalog CRUD): `GET /api/admin/amenities`, `POST …`. */
export async function GET() {
  const auth = await guardApi({
    route: "/api/admin/amenities",
    roles: [AppRole.STAFF, AppRole.ADMIN],
    permission: Permissions.MANAGE_ROOMS,
  });
  if (auth instanceof NextResponse) return auth;

  const rows = await listAmenities();
  return NextResponse.json(
    rows.map((row) => ({
      id: row.id,
      name: row.name,
      description: row.description,
      roomTypeCount: row._count.roomTypes,
    })),
  );
}

export async function POST(request: Request) {
  const auth = await guardApi({
    route: "/api/admin/amenities",
    roles: [AppRole.STAFF, AppRole.ADMIN],
    permission: Permissions.MANAGE_ROOMS,
  });
  if (auth instanceof NextResponse) return auth;

  const parsed = AmenityUpsertSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return invalidBody(parsed.error.flatten().fieldErrors);

  try {
    const created = await createAmenity(parsed.data, { userId: auth.userId! });
    return NextResponse.json({ id: created.id }, { status: 201 });
  } catch (error) {
    return consoleErrorResponse(error);
  }
}

