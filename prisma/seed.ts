import "../scripts/load-env";
import { prisma } from "../src/lib/prisma";
import { PromotionType, RecordStatus } from "../src/generated/prisma/enums";

const AMENITIES = [
  { name: "Wi-Fi", description: "High-speed wireless internet" },
  { name: "Air Conditioning", description: "Individually controlled A/C" },
  { name: "TV", description: "Flat-screen television" },
  { name: "Mini Fridge", description: "In-room mini fridge" },
  { name: "Private Bathroom", description: "En-suite bathroom" },
];

const ROOM_TYPES = [
  {
    slug: "deluxe-king",
    name: "Deluxe King",
    description: "Spacious room with a king bed, city view and work desk.",
    maxAdults: 2,
    maxChildren: 1,
    basePrice: 450,
    amenities: ["Wi-Fi", "Air Conditioning", "TV", "Mini Fridge", "Private Bathroom"],
    rooms: [
      { roomNumber: "101", floor: 1 },
      { roomNumber: "102", floor: 1 },
      { roomNumber: "103", floor: 1 },
      { roomNumber: "104", floor: 1 },
    ],
  },
  {
    slug: "executive-suite",
    name: "Executive Suite",
    description: "Suite with separate living area, king bed and lounge access.",
    maxAdults: 2,
    maxChildren: 2,
    basePrice: 850,
    amenities: ["Wi-Fi", "Air Conditioning", "TV", "Mini Fridge", "Private Bathroom"],
    rooms: [
      { roomNumber: "201", floor: 2 },
      { roomNumber: "202", floor: 2 },
    ],
  },
  {
    slug: "family-room",
    name: "Family Room",
    description: "Two queen beds, ideal for families travelling together.",
    maxAdults: 4,
    maxChildren: 2,
    basePrice: 650,
    amenities: ["Wi-Fi", "Air Conditioning", "TV", "Private Bathroom"],
    rooms: [
      { roomNumber: "301", floor: 3 },
      { roomNumber: "302", floor: 3 },
      { roomNumber: "303", floor: 3 },
    ],
  },
];

async function main() {
  const hotel = await prisma.hotel.upsert({
    where: { slug: "santo-hotel" },
    update: { name: "Santo Hotel" },
    create: {
      name: "Santo Hotel",
      slug: "santo-hotel",
      description: "Single-tenant hotel booking demo environment.",
      timezone: "Asia/Kuala_Lumpur",
      currency: "MYR",
    },
  });

  const amenities = new Map<string, string>();
  for (const amenity of AMENITIES) {
    const record = await prisma.amenity.upsert({
      where: { name: amenity.name },
      update: { description: amenity.description },
      create: amenity,
    });
    amenities.set(record.name, record.id);
  }

  for (const type of ROOM_TYPES) {
    const roomType = await prisma.roomType.upsert({
      where: { slug: type.slug },
      update: {
        name: type.name,
        description: type.description,
        maxAdults: type.maxAdults,
        maxChildren: type.maxChildren,
        basePrice: type.basePrice,
        status: RecordStatus.ACTIVE,
      },
      create: {
        hotelId: hotel.id,
        slug: type.slug,
        name: type.name,
        description: type.description,
        maxAdults: type.maxAdults,
        maxChildren: type.maxChildren,
        basePrice: type.basePrice,
      },
    });

    for (const amenityName of type.amenities) {
      const amenityId = amenities.get(amenityName);
      if (!amenityId) continue;
      await prisma.roomTypeAmenity.upsert({
        where: {
          roomTypeId_amenityId: { roomTypeId: roomType.id, amenityId },
        },
        update: {},
        create: { roomTypeId: roomType.id, amenityId },
      });
    }

    for (const room of type.rooms) {
      await prisma.room.upsert({
        where: { roomNumber: room.roomNumber },
        update: { roomTypeId: roomType.id, floor: room.floor },
        create: {
          roomTypeId: roomType.id,
          roomNumber: room.roomNumber,
          floor: room.floor,
        },
      });
    }

    const rateName = "Standard 2026";
    const existingRate = await prisma.rate.findFirst({
      where: { roomTypeId: roomType.id, name: rateName },
    });

    const rateData = {
      amount: type.basePrice,
      currency: "MYR",
      startDate: new Date("2026-01-01"),
      endDate: new Date("2026-12-31"),
      status: RecordStatus.ACTIVE,
    };

    if (existingRate) {
      await prisma.rate.update({ where: { id: existingRate.id }, data: rateData });
    } else {
      await prisma.rate.create({
        data: { roomTypeId: roomType.id, name: rateName, ...rateData },
      });
    }
  }

  await prisma.promotion.upsert({
    where: { code: "STAY10" },
    update: {},
    create: {
      code: "STAY10",
      type: PromotionType.PERCENTAGE,
      value: 10,
      startAt: new Date("2026-01-01T00:00:00+08:00"),
      endAt: new Date("2026-12-31T23:59:59+08:00"),
      maxUses: 100,
    },
  });

  const [roomTypes, rooms, rateCount, amenityCount] = await Promise.all([
    prisma.roomType.count(),
    prisma.room.count(),
    prisma.rate.count(),
    prisma.amenity.count(),
  ]);

  console.log(
    `Seed complete: ${roomTypes} room types, ${rooms} rooms, ${rateCount} rates, ${amenityCount} amenities, promotion STAY10.`,
  );
}

main()
  .catch((error) => {
    console.error("Seed failed:", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
