import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getDefaultHotel, getPublishedHotelBySlug } from "@/server/public/hotels";

export async function GET(request: Request) {
  try {
    const slug = new URL(request.url).searchParams.get("hotel");
    const hotel = slug ? await getPublishedHotelBySlug(slug) : await getDefaultHotel();
    if (!hotel || hotel.publicationStatus !== "PUBLISHED") {
      return NextResponse.json({ error: "not_found" }, { status: 404 });
    }
    const rooms = await prisma.room.findMany({
      where: { roomType: { hotelId: hotel.id } },
      select: { id: true, roomNumber: true, status: true, roomTypeId: true },
      orderBy: { roomNumber: "asc" },
      take: 100,
    });
    return NextResponse.json(rooms);
  } catch {
    return NextResponse.json({ error: "internal" }, { status: 500 });
  }
}
