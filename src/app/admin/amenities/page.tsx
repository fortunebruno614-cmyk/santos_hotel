import { prisma } from "@/lib/prisma";
import { AmenitiesManager } from "./amenities-manager";

/** Amenities catalog (P7 CRUD). */
export default async function AdminAmenitiesPage() {
  const amenities = await prisma.amenity.findMany({
    orderBy: { name: "asc" },
    include: { _count: { select: { roomTypes: true } } },
  });

  return (
    <AmenitiesManager
      amenities={amenities.map((row) => ({
        id: row.id,
        name: row.name,
        description: row.description,
        roomTypeCount: row._count.roomTypes,
      }))}
    />
  );
}
