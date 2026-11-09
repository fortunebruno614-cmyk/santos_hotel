import { NextResponse } from "next/server";
import { guardApi, guardTenantHotel } from "@/server/auth/api";
import { AppRole, Permissions } from "@/server/auth/roles";
import { ConsoleError, consoleErrorResponse } from "@/server/console/errors";
import { createHotel, HotelCreateSchema } from "@/server/console/hotels";
import { ACTIVE_HOTEL_COOKIE } from "@/server/auth/tenancy";
import { invalidBody } from "@/server/booking/http";

/**
 * Tenant property creation. The organization comes from the session
 * membership, never from the request body; the new hotel becomes the active
 * console context on success.
 */
export async function POST(request: Request) {
  const auth = await guardApi({
    route: "/api/admin/hotels",
    roles: [AppRole.STAFF, AppRole.ADMIN],
    permission: Permissions.MANAGE_HOTELS,
  });
  if (auth instanceof NextResponse) return auth;
  const tenant = await guardTenantHotel(auth, Permissions.MANAGE_HOTELS);
  if (tenant instanceof NextResponse) return tenant;

  const parsed = HotelCreateSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return invalidBody(parsed.error.flatten().fieldErrors);

  try {
    const hotel = await createHotel(tenant.member.organizationId, parsed.data, {
      userId: auth.userId!,
    });
    const response = NextResponse.json(
      { id: hotel.id, slug: hotel.slug, name: hotel.name },
      { status: 201 },
    );
    response.cookies.set(ACTIVE_HOTEL_COOKIE, hotel.id, {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: 60 * 60 * 24 * 30,
    });
    return response;
  } catch (error) {
    if (error instanceof ConsoleError) return consoleErrorResponse(error);
    throw error;
  }
}
