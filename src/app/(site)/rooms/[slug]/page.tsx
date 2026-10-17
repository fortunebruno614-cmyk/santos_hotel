import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { RecordStatus } from "@/generated/prisma/enums";
import { loadHotelProfile } from "@/server/public/catalog";
import { parsePublicStay } from "@/server/public/search";
import { findAvailability } from "@/server/availability/service";
import { computeTypePrices } from "@/server/pricing/service";
import { loadHotelContext } from "@/server/pricing/context";
import { parseDateOnly } from "@/server/availability/overlap";
import {
  bedForRoomType,
  fallbackImageForSlug,
  isSuiteName,
  type ListingRoom,
} from "@/lib/hotel";
import { RoomDetailContent } from "./room-detail";

export default async function RoomDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const { slug } = await params;
  const sp = await searchParams;

  const roomType = await prisma.roomType.findUnique({
    where: { slug },
    include: {
      images: { orderBy: { sortOrder: "asc" } },
      amenities: { include: { amenity: true } },
      rooms: { orderBy: { roomNumber: "asc" } },
    },
  });
  if (!roomType || roomType.status !== RecordStatus.ACTIVE) notFound();

  const [hotel, context, parsed] = await Promise.all([
    loadHotelProfile(),
    loadHotelContext(),
    Promise.resolve(parsePublicStay(sp)),
  ]);

  const images = roomType.images.map((image) => image.url);
  if (images.length === 0) images.push(fallbackImageForSlug(roomType.slug));

  const description = roomType.description ?? "";
  const room: ListingRoom = {
    id: roomType.id,
    slug: roomType.slug,
    name: roomType.name,
    description,
    maxAdults: roomType.maxAdults,
    maxChildren: roomType.maxChildren,
    basePrice: roomType.basePrice.toString(),
    images,
    amenities: roomType.amenities.map((link) => link.amenity.name),
    totalRooms: roomType.rooms.length,
    isSuite: isSuiteName(roomType.name),
    bed: bedForRoomType(roomType.name, description),
  };

  let availableRooms: Array<{ id: string; roomNumber: string; floor: number | null }> = [];
  let nightlyRate = room.basePrice;
  let stayTotal: string | null = null;
  let estimate:
    | { subtotal: string; taxes: string; fees: string; total: string }
    | null = null;
  let searchFailed = false;

  if (parsed.stay) {
    const checkIn = parseDateOnly(parsed.stay.checkIn);
    const checkOut = parseDateOnly(parsed.stay.checkOut);
    if (checkIn && checkOut) {
      try {
        const availability = await findAvailability({
          checkIn,
          checkOut,
          adults: parsed.stay.adults,
          children: parsed.stay.children,
        });
        const match = availability.roomTypes.find((type) => type.id === roomType.id);
        availableRooms = (match?.availableRooms ?? []).map((physical) => ({
          id: physical.id,
          roomNumber: physical.roomNumber,
          floor: physical.floor,
        }));

        const prices = await computeTypePrices([roomType.id], checkIn, checkOut);
        const price = prices.get(roomType.id);
        if (price) {
          nightlyRate = price.nightlyRate;
          stayTotal = price.stayTotal;
          const subtotal = Number(price.stayTotal);
          const taxes = Math.round(subtotal * context.taxRatePercent) / 100;
          const fees = context.serviceFee;
          estimate = {
            subtotal: subtotal.toFixed(2),
            taxes: taxes.toFixed(2),
            fees: fees.toFixed(2),
            total: (subtotal + taxes + fees).toFixed(2),
          };
        }
      } catch {
        searchFailed = true;
      }
    }
  }

  return (
    <RoomDetailContent
      room={room}
      hotel={hotel}
      context={{ taxRatePercent: context.taxRatePercent, serviceFee: context.serviceFee }}
      stay={parsed.stay}
      stayError={parsed.error}
      availableRooms={availableRooms}
      nightlyRate={nightlyRate}
      stayTotal={stayTotal}
      estimate={estimate}
      searchFailed={searchFailed}
    />
  );
}
