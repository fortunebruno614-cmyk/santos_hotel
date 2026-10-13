import { prisma } from "@/lib/prisma";
import { RoomTypesManager } from "./room-types-manager";

/** Room type catalog (P7 CRUD): server loads the rows, the manager mutates them. */
export default async function AdminRoomTypesPage() {
  const [roomTypes, amenities] = await Promise.all([
    prisma.roomType.findMany({
      orderBy: [{ status: "asc" }, { name: "asc" }],
      include: {
        _count: { select: { rooms: true } },
        amenities: { include: { amenity: { select: { id: true, name: true } } } },
      },
    }),
    prisma.amenity.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true } }),
  ]);

  return (
    <RoomTypesManager
      roomTypes={roomTypes.map((row) => ({
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
      }))}
      amenities={amenities}
    />
  );
}
