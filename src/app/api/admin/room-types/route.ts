import { NextResponse } from "next/server";
import { guardApi } from "@/server/auth/api";
import { AppRole, Permissions } from "@/server/auth/roles";
import { createRoomType, listRoomTypes, type ConsoleActor } from "@/server/console/catalog";
import { RoomTypeUpsertSchema } from "@/server/console/validation";
import { consoleErrorResponse } from "@/server/console/errors";
import { invalidBody } from "@/server/booking/http";

/**
 * Room types (P7 catalog CRUD).
 *
 *   GET  /api/admin/room-types
 *   POST /api/admin/room-types        { name, slug, maxAdults, basePrice, … }
 *
 * Staff may manage the catalog (MANAGE_ROOMS); every mutation is audited.
 */
export async function GET() {
  const auth = await guardApi({
    route: "/api/admin/room-types",
    roles: [AppRole.STAFF, AppRole.ADMIN],
    permission: Permissions.MANAGE_ROOMS,
  });
  if (auth instanceof NextResponse) return auth;

  const rows = await listRoomTypes();
  return NextResponse.json(
    rows.map((row) => ({
      id: row.id,
      name: row.name,
      slug: row.slug,
      description: row.description,
      maxAdults: row.maxAdults,
      maxChildren: row.maxChildren,
      basePrice: row.basePrice.toString(),
      status: row.status,
      roomCount: row._count.rooms,
      amenities: row.amenities.map((link) => link.amenity),
    })),
  );
}

export async function POST(request: Request) {
  const auth = await guardApi({
    route: "/api/admin/room-types",
    roles: [AppRole.STAFF, AppRole.ADMIN],
    permission: Permissions.MANAGE_ROOMS,
  });
  if (auth instanceof NextResponse) return auth;

  const parsed = RoomTypeUpsertSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return invalidBody(parsed.error.flatten().fieldErrors);

  const actor: ConsoleActor = { userId: auth.userId! };
  try {
    const created = await createRoomType(parsed.data, actor);
    return NextResponse.json({ id: created.id }, { status: 201 });
  } catch (error) {
    return consoleErrorResponse(error);
  }
}
