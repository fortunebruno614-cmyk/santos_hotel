import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  try {
    const rooms = await prisma.room.findMany({
      select: { id: true, roomNumber: true, status: true, roomTypeId: true },
      orderBy: { roomNumber: "asc" },
      take: 100,
    });
    return NextResponse.json(rooms);
  } catch {
    return NextResponse.json({ error: "internal" }, { status: 500 });
  }
}
