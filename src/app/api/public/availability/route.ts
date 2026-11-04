import { NextResponse } from "next/server";
import { StaySearchSchema } from "@/server/availability/validation";
import { parseDateOnly } from "@/server/availability/overlap";
import {
  findAvailability,
  StayValidationError,
} from "@/server/availability/service";
import { getDefaultHotel, getPublishedHotelBySlug } from "@/server/public/hotels";

/**
 * Public availability search (anonymous — already listed under `/api/public` in
 * src/config/access-map.ts, which is the P3 contract for route registration).
 *
 *   GET /api/public/availability?checkIn=2026-11-01&checkOut=2026-11-03&adults=2&children=1
 *
 * Returns the eligible room types and the physical rooms still free for the
 * window. Read-only: a search never mutates holds — releasing expired Pending
 * bookings happens inside the allocation transaction (createPendingBooking).
 */
export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  const slug = params.get("hotel");
  const hotel = slug ? await getPublishedHotelBySlug(slug) : await getDefaultHotel();
  if (!hotel || hotel.publicationStatus !== "PUBLISHED") {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }
  const parsed = StaySearchSchema.safeParse({
    checkIn: params.get("checkIn") ?? undefined,
    checkOut: params.get("checkOut") ?? undefined,
    adults: params.get("adults") ?? undefined,
    children: params.get("children") ?? undefined,
  });

  if (!parsed.success) {
    return NextResponse.json(
      { error: "invalid_query", issues: parsed.error.flatten().fieldErrors },
      { status: 400 },
    );
  }

  try {
    const result = await findAvailability({
      hotelId: hotel.id,
      checkIn: parseDateOnly(parsed.data.checkIn)!,
      checkOut: parseDateOnly(parsed.data.checkOut)!,
      adults: parsed.data.adults,
      children: parsed.data.children,
    });
    return NextResponse.json(result);
  } catch (error) {
    if (error instanceof StayValidationError) {
      return NextResponse.json({ error: error.code, message: error.message }, { status: 400 });
    }
    return NextResponse.json({ error: "internal" }, { status: 500 });
  }
}
