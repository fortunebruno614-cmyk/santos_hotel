import "../scripts/load-env";
import { prisma } from "../src/lib/prisma";
import { OrganizationStatus, PromotionType, RecordStatus } from "../src/generated/prisma/enums";
import { hashPassword } from "../src/server/auth/crypto";

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
    basePrice: 144000,
    amenities: ["Wi-Fi", "Air Conditioning", "TV", "Mini Fridge", "Private Bathroom"],
    images: ["/images/santo-room.jpg", "/images/santo-lobby.jpg"],
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
    basePrice: 272000,
    amenities: ["Wi-Fi", "Air Conditioning", "TV", "Mini Fridge", "Private Bathroom"],
    images: ["/images/santo-suite.jpg", "/images/santo-pool.jpg"],
    rooms: [
      { roomNumber: "201", floor: 2 },
      { roomNumber: "202", floor: 2 },
      { roomNumber: "203", floor: 2 },
      { roomNumber: "204", floor: 2 },
    ],
  },
  {
    slug: "family-room",
    name: "Family Room",
    description: "Two queen beds, ideal for families travelling together.",
    maxAdults: 4,
    maxChildren: 2,
    basePrice: 208000,
    amenities: ["Wi-Fi", "Air Conditioning", "TV", "Private Bathroom"],
    images: ["/images/santo-twin.jpg", "/images/santo-room.jpg"],
    rooms: [
      { roomNumber: "301", floor: 3 },
      { roomNumber: "302", floor: 3 },
      { roomNumber: "303", floor: 3 },
      { roomNumber: "304", floor: 3 },
    ],
  },
];

// P3 authentication seed — dev-only credentials, never real accounts.
const ACCOUNTS = [
  {
    entity: "user",
    name: "Alice Admin",
    email: "admin@santohotel.test",
    password: "Admin123!",
    role: "ADMIN" as const,
  },
  {
    entity: "user",
    name: "Sam Staff",
    email: "staff@santohotel.test",
    password: "Staff123!",
    role: "STAFF" as const,
  },
  {
    entity: "guest",
    firstName: "Gina",
    lastName: "Guest",
    email: "guest@santohotel.test",
    password: "Guest123!",
    role: "GUEST" as const,
  },
] as const;

async function seedAccounts() {
  let users = 0;
  let guests = 0;

  for (const account of ACCOUNTS) {
    const passwordHash = await hashPassword(account.password);

    if (account.entity === "user") {
      const existing = await prisma.user.findUnique({ where: { email: account.email } });
      if (existing) {
        await prisma.user.update({
          where: { id: existing.id },
          data: { role: account.role, passwordHash, isActive: true },
        });
      } else {
        await prisma.user.create({
          data: {
            name: account.name,
            email: account.email,
            passwordHash,
            role: account.role,
          },
        });
      }
      users += 1;
      continue;
    }

    const existing = await prisma.guest.findUnique({ where: { email: account.email } });
    if (existing) {
      await prisma.guest.update({
        where: { id: existing.id },
        data: { passwordHash, isActive: true },
      });
    } else {
      await prisma.guest.create({
        data: {
          firstName: account.firstName,
          lastName: account.lastName,
          email: account.email,
          passwordHash,
        },
      });
    }
    guests += 1;
  }

  return { users, guests };
}

async function main() {
  const organization = await prisma.organization.upsert({
    where: { slug: "santo-hotel" },
    update: { name: "Santo Hotel" },
    create: {
      name: "Santo Hotel",
      slug: "santo-hotel",
      status: OrganizationStatus.ACTIVE,
    },
  });

  const hotel = await prisma.hotel.upsert({
    where: { slug: "santo-hotel" },
    update: {
      name: "Santo Hotel",
      organizationId: organization.id,
      latitude: 6.426588,
      longitude: 3.429399,
      locationVerification: "PLATFORM_VERIFIED",
      locationPrecision: "APPROXIMATE",
    },
    create: {
      name: "Santo Hotel",
      slug: "santo-hotel",
      organizationId: organization.id,
      description: "Single-tenant hotel booking demo environment.",
      // Public map location (MR-07): street midpoint of Adetokunbo Ademola
      // Street, Victoria Island, Lagos — verified against OpenStreetMap
      // (way 8564522), so a fresh database renders a pin instead of
      // "Map location unavailable".
      addressLine1: "Adetokunbo Ademola Street",
      addressLine2: "Victoria Island",
      city: "Lagos",
      postcode: "500001",
      country: "Nigeria",
      latitude: 6.426588,
      longitude: 3.429399,
      locationVerification: "PLATFORM_VERIFIED",
      locationPrecision: "APPROXIMATE",
      timezone: "Asia/Kuala_Lumpur",
      currency: "NGN",
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
        organizationId: organization.id,
        name: type.name,
        description: type.description,
        maxAdults: type.maxAdults,
        maxChildren: type.maxChildren,
        basePrice: type.basePrice,
        status: RecordStatus.ACTIVE,
      },
      create: {
        hotelId: hotel.id,
        organizationId: organization.id,
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
        update: { roomTypeId: roomType.id, hotelId: hotel.id, floor: room.floor },
        create: {
          roomTypeId: roomType.id,
          hotelId: hotel.id,
          roomNumber: room.roomNumber,
          floor: room.floor,
        },
      });
    }

    for (const [index, url] of type.images.entries()) {
      const existingImage = await prisma.roomImage.findFirst({
        where: { roomTypeId: roomType.id, url },
      });
      if (!existingImage) {
        await prisma.roomImage.create({
          data: {
            roomTypeId: roomType.id,
            url,
            altText: `${type.name} at Santo Hotel`,
            sortOrder: index,
          },
        });
      }
    }

    const rateName = "Standard 2026";
    const existingRate = await prisma.rate.findFirst({
      where: { roomTypeId: roomType.id, name: rateName },
    });

    const rateData = {
      amount: type.basePrice,
      currency: "NGN",
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
    update: { hotelId: hotel.id },
    create: {
      hotelId: hotel.id,
      code: "STAY10",
      type: PromotionType.PERCENTAGE,
      value: 10,
      startAt: new Date("2026-01-01T00:00:00+08:00"),
      endAt: new Date("2026-12-31T23:59:59+08:00"),
      maxUses: 100,
    },
  });

  const accounts = await seedAccounts();

  // Tenant memberships are what the staff console authorizes against; a User
  // row alone is not enough. ADMIN -> OWNER, STAFF -> STAFF (MRD role mapping).
  for (const account of ACCOUNTS.filter((entry) => entry.entity === "user")) {
    const user = await prisma.user.findUnique({ where: { email: account.email } });
    if (!user) continue;
    await prisma.organizationMember.upsert({
      where: {
        organizationId_userId: { organizationId: organization.id, userId: user.id },
      },
      update: {
        role: account.role === "ADMIN" ? "OWNER" : "STAFF",
        status: "ACTIVE",
      },
      create: {
        organizationId: organization.id,
        userId: user.id,
        role: account.role === "ADMIN" ? "OWNER" : "STAFF",
        status: "ACTIVE",
        activatedAt: new Date(),
      },
    });
  }

  const [roomTypes, rooms, rateCount, amenityCount] = await Promise.all([
    prisma.roomType.count(),
    prisma.room.count(),
    prisma.rate.count(),
    prisma.amenity.count(),
  ]);

  console.log(
    `Seed complete: ${roomTypes} room types, ${rooms} rooms, ${rateCount} rates, ${amenityCount} amenities, promotion STAY10, ${accounts.users} staff accounts, ${accounts.guests} guest accounts.`,
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
