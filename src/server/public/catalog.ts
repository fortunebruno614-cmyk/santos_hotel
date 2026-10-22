import { prisma } from "@/lib/prisma";
import { RecordStatus } from "@/generated/prisma/enums";
import {
  bedForRoomType,
  fallbackImageForSlug,
  isSuiteName,
  type InventoryRoom,
  type PublicRoomType,
} from "@/lib/hotel";

/** Public room catalogue, shaped for the hotel UI. */
export async function loadPublicRoomTypes(): Promise<PublicRoomType[]> {
  const types = await prisma.roomType.findMany({
    where: { status: RecordStatus.ACTIVE },
    orderBy: { name: "asc" },
    include: {
      images: { orderBy: { sortOrder: "asc" } },
      amenities: { include: { amenity: true } },
      rooms: { select: { id: true } },
    },
  });

  return types.map((type) => {
    const images = type.images.map((image) => image.url);
    if (images.length === 0) images.push(fallbackImageForSlug(type.slug));
    const description = type.description ?? "";
    return {
      id: type.id,
      slug: type.slug,
      name: type.name,
      description,
      maxAdults: type.maxAdults,
      maxChildren: type.maxChildren,
      basePrice: type.basePrice.toString(),
      images,
      amenities: type.amenities.map((link) => link.amenity.name),
      totalRooms: type.rooms.length,
      isSuite: isSuiteName(type.name),
      bed: bedForRoomType(type.name, description),
    };
  });
}

/** Every physical room of every active room type, for the public room list. */
export async function loadRoomsInventory(): Promise<InventoryRoom[]> {
  const rooms = await prisma.room.findMany({
    where: { roomType: { status: RecordStatus.ACTIVE } },
    orderBy: { roomNumber: "asc" },
    include: { roomType: { select: { slug: true, name: true, basePrice: true } } },
  });

  return rooms.map((room) => ({
    id: room.id,
    roomNumber: room.roomNumber,
    floor: room.floor,
    typeSlug: room.roomType.slug,
    typeName: room.roomType.name,
    basePrice: room.roomType.basePrice.toString(),
    isSuite: isSuiteName(room.roomType.name),
  }));
}

export async function loadHotelProfile() {
  const hotel = await prisma.hotel.findFirst({ orderBy: { createdAt: "asc" } });
  return {
    name: hotel?.name ?? "Santo Hotel",
    description: hotel?.description ?? null,
    phone: hotel?.phone ?? null,
    email: hotel?.email ?? null,
    addressLine1: hotel?.addressLine1 ?? null,
    addressLine2: hotel?.addressLine2 ?? null,
    city: hotel?.city ?? null,
    postcode: hotel?.postcode ?? null,
    country: hotel?.country ?? null,
    currency: hotel?.currency ?? "NGN",
    checkInTime: hotel?.checkInTime ?? "15:00",
    checkOutTime: hotel?.checkOutTime ?? "11:00",
    cancellationWindowHours: hotel?.cancellationWindowHours ?? 48,
  };
}
