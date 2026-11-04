import { prisma } from "@/lib/prisma";
import { Prisma, RecordStatus, RoomStatus } from "@/generated/prisma/client";
import { writeAuditLog, type AuditAction } from "@/server/audit/write";
import { assertRoomTransition } from "@/server/booking/policy";
import { ConsoleError } from "@/server/console/errors";
import { requireHotelContext } from "@/server/pricing/context";
import type {
  AmenityUpsertSchema,
  PromotionUpsertSchema,
  RateUpsertSchema,
  RoomTypeUpsertSchema,
  RoomUpsertSchema,
} from "@/server/console/validation";
import type { z } from "zod";

/**
 * P7/M4 catalog services — tenant-scoped configuration entities (room types,
 * physical rooms, amenities, rates, promotions).
 *
 * Every function takes an explicit `hotelId`. Mutations re-read the row and
 * verify it belongs to that hotel (and therefore the caller's organization)
 * before changing it; a valid id from another tenant answers `not_found`.
 */

export type ConsoleActor = { userId: string };

type RoomTypeUpsert = z.infer<typeof RoomTypeUpsertSchema>;
type RoomUpsert = z.infer<typeof RoomUpsertSchema>;
type AmenityUpsert = z.infer<typeof AmenityUpsertSchema>;
type RateUpsert = z.infer<typeof RateUpsertSchema>;
type PromotionUpsert = z.infer<typeof PromotionUpsertSchema>;

type Db = Prisma.TransactionClient | typeof prisma;

async function audit(
  actor: ConsoleActor,
  action: AuditAction,
  entityType: string,
  entityId: string,
  oldValues: Record<string, unknown> | null,
  newValues: Record<string, unknown> | null,
  organizationId?: string | null,
  hotelId?: string | null,
) {
  await writeAuditLog({
    userId: actor.userId,
    organizationId: organizationId ?? null,
    hotelId: hotelId ?? null,
    action,
    entityType,
    entityId,
    oldValues,
    newValues,
  });
}

async function tenant(hotelId: string) {
  return requireHotelContext(hotelId);
}

function isUniqueViolation(error: unknown): boolean {
  return (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    (error.code === "P2002" || error.code === "P2025")
  );
}

// ---------------------------------------------------------------------------
// Room types
// ---------------------------------------------------------------------------

export function roomTypeAuditValues(row: {
  name: string;
  slug: string;
  maxAdults: number;
  maxChildren: number;
  basePrice: Prisma.Decimal;
  status: RecordStatus;
}) {
  return {
    name: row.name,
    slug: row.slug,
    maxAdults: row.maxAdults,
    maxChildren: row.maxChildren,
    basePrice: row.basePrice.toString(),
    status: row.status,
  };
}

export async function listRoomTypes(hotelId: string) {
  return prisma.roomType.findMany({
    where: { hotelId },
    orderBy: [{ status: "asc" }, { name: "asc" }],
    include: {
      _count: { select: { rooms: true } },
      amenities: { include: { amenity: { select: { id: true, name: true } } } },
    },
  });
}

async function assertAmenitiesInScope(
  client: Db,
  organizationId: string,
  amenityIds: string[],
) {
  if (amenityIds.length === 0) return;
  const rows = await client.amenity.findMany({
    where: {
      id: { in: amenityIds },
      OR: [{ scope: "PLATFORM" }, { organizationId }],
    },
    select: { id: true },
  });
  if (rows.length !== new Set(amenityIds).size) {
    throw new ConsoleError("not_found", "one or more amenities are not available to this hotel");
  }
}

export async function createRoomType(
  hotelId: string,
  input: RoomTypeUpsert,
  actor: ConsoleActor,
) {
  const hotel = await tenant(hotelId);
  const amenityIds = input.amenityIds ?? [];
  try {
    const created = await prisma.$transaction(async (tx) => {
      const clash = await tx.roomType.findFirst({
        where: { hotelId, OR: [{ name: input.name }, { slug: input.slug }] },
        select: { id: true },
      });
      if (clash) {
        throw new ConsoleError("conflict", "a room type with that name or slug already exists");
      }
      await assertAmenitiesInScope(tx, hotel.organizationId, amenityIds);
      const row = await tx.roomType.create({
        data: {
          hotelId,
          organizationId: hotel.organizationId,
          name: input.name,
          slug: input.slug,
          description: input.description ?? null,
          maxAdults: input.maxAdults,
          maxChildren: input.maxChildren,
          basePrice: input.basePrice,
          status: input.status,
        },
      });
      if (amenityIds.length > 0) {
        await tx.roomTypeAmenity.createMany({
          data: amenityIds.map((amenityId) => ({ roomTypeId: row.id, amenityId })),
          skipDuplicates: true,
        });
      }
      return row;
    });
    await audit(
      actor,
      "room_type.create",
      "room_type",
      created.id,
      null,
      roomTypeAuditValues(created),
      hotel.organizationId,
      hotelId,
    );
    return created;
  } catch (error) {
    if (isUniqueViolation(error)) {
      throw new ConsoleError("conflict", "a room type with that name or slug already exists");
    }
    throw error;
  }
}

export async function updateRoomType(
  hotelId: string,
  id: string,
  input: RoomTypeUpsert,
  actor: ConsoleActor,
) {
  const hotel = await tenant(hotelId);
  const existing = await prisma.roomType.findFirst({ where: { id, hotelId } });
  if (!existing) throw new ConsoleError("not_found", "room type not found");
  const amenityIds = input.amenityIds;

  try {
    const updated = await prisma.$transaction(async (tx) => {
      const clash = await tx.roomType.findFirst({
        where: {
          hotelId,
          id: { not: id },
          OR: [{ name: input.name }, { slug: input.slug }],
        },
        select: { id: true },
      });
      if (clash) {
        throw new ConsoleError("conflict", "a room type with that name or slug already exists");
      }
      if (amenityIds) {
        await assertAmenitiesInScope(tx, hotel.organizationId, amenityIds);
      }
      const row = await tx.roomType.update({
        where: { id },
        data: {
          name: input.name,
          slug: input.slug,
          description: input.description ?? null,
          maxAdults: input.maxAdults,
          maxChildren: input.maxChildren,
          basePrice: input.basePrice,
          status: input.status,
        },
      });
      if (amenityIds) {
        await tx.roomTypeAmenity.deleteMany({ where: { roomTypeId: id } });
        if (amenityIds.length > 0) {
          await tx.roomTypeAmenity.createMany({
            data: amenityIds.map((amenityId) => ({ roomTypeId: id, amenityId })),
            skipDuplicates: true,
          });
        }
      }
      return row;
    });
    await audit(
      actor,
      "room_type.update",
      "room_type",
      id,
      roomTypeAuditValues(existing),
      roomTypeAuditValues(updated),
      hotel.organizationId,
      hotelId,
    );
    return updated;
  } catch (error) {
    if (isUniqueViolation(error)) {
      throw new ConsoleError("conflict", "a room type with that name or slug already exists");
    }
    throw error;
  }
}

/** Deactivate instead of deleting when the type has rooms or history. */
export async function deleteRoomType(hotelId: string, id: string, actor: ConsoleActor) {
  const hotel = await tenant(hotelId);
  const existing = await prisma.roomType.findFirst({
    where: { id, hotelId },
    include: { _count: { select: { rooms: true } } },
  });
  if (!existing) throw new ConsoleError("not_found", "room type not found");

  if (existing._count.rooms > 0) {
    throw new ConsoleError(
      "in_use",
      "this room type still has rooms — reassign them first, or mark it inactive instead of deleting",
    );
  }

  await prisma.$transaction(async (tx) => {
    await tx.roomTypeAmenity.deleteMany({ where: { roomTypeId: id } });
    await tx.rate.deleteMany({ where: { roomTypeId: id } });
    await tx.roomType.delete({ where: { id } });
  });
  await audit(
    actor,
    "room_type.delete",
    "room_type",
    id,
    roomTypeAuditValues(existing),
    null,
    hotel.organizationId,
    hotelId,
  );
  return { id };
}

// ---------------------------------------------------------------------------
// Physical rooms
// ---------------------------------------------------------------------------

export function roomAuditValues(row: {
  roomNumber: string;
  floor: number | null;
  roomTypeId: string;
  status: RoomStatus;
  notes: string | null;
}) {
  return {
    roomNumber: row.roomNumber,
    floor: row.floor,
    roomTypeId: row.roomTypeId,
    status: row.status,
    notes: row.notes,
  };
}

export async function listRooms(hotelId: string) {
  return prisma.room.findMany({
    where: { roomType: { hotelId } },
    orderBy: { roomNumber: "asc" },
    include: { roomType: { select: { id: true, name: true, status: true } } },
  });
}

export async function createRoom(hotelId: string, input: RoomUpsert, actor: ConsoleActor) {
  const hotel = await tenant(hotelId);
  const roomType = await prisma.roomType.findFirst({
    where: { id: input.roomTypeId, hotelId },
  });
  if (!roomType) throw new ConsoleError("not_found", "room type not found");

  const clash = await prisma.room.findFirst({
    where: { hotelId, roomNumber: input.roomNumber },
    select: { id: true },
  });
  if (clash) throw new ConsoleError("conflict", `room ${input.roomNumber} already exists`);

  try {
    const created = await prisma.room.create({
      data: {
        hotelId,
        roomTypeId: input.roomTypeId,
        roomNumber: input.roomNumber,
        floor: input.floor ?? null,
        status: input.status,
        notes: input.notes ?? null,
      },
    });
    await audit(
      actor,
      "room.create",
      "room",
      created.id,
      null,
      roomAuditValues(created),
      hotel.organizationId,
      hotelId,
    );
    return created;
  } catch (error) {
    if (isUniqueViolation(error)) {
      throw new ConsoleError("conflict", `room ${input.roomNumber} already exists`);
    }
    throw error;
  }
}

export async function updateRoom(
  hotelId: string,
  id: string,
  input: RoomUpsert,
  actor: ConsoleActor,
) {
  const hotel = await tenant(hotelId);
  const existing = await prisma.room.findFirst({
    where: { id, roomType: { hotelId } },
  });
  if (!existing) throw new ConsoleError("not_found", "room not found");
  const roomType = await prisma.roomType.findFirst({
    where: { id: input.roomTypeId, hotelId },
  });
  if (!roomType) throw new ConsoleError("not_found", "room type not found");

  // A status change here still obeys the housekeeping transition table — the
  // same rule the board enforces (OCCUPIED → AVAILABLE is never allowed).
  if (input.status !== existing.status) {
    assertRoomTransition(existing.status, input.status);
  }

  const clash = await prisma.room.findFirst({
    where: { hotelId, roomNumber: input.roomNumber, id: { not: id } },
    select: { id: true },
  });
  if (clash) throw new ConsoleError("conflict", `room ${input.roomNumber} already exists`);

  try {
    const updated = await prisma.room.update({
      where: { id },
      data: {
        hotelId,
        roomTypeId: input.roomTypeId,
        roomNumber: input.roomNumber,
        floor: input.floor ?? null,
        status: input.status,
        notes: input.notes ?? null,
      },
    });
    await audit(
      actor,
      "room.update",
      "room",
      id,
      roomAuditValues(existing),
      roomAuditValues(updated),
      hotel.organizationId,
      hotelId,
    );
    return updated;
  } catch (error) {
    if (isUniqueViolation(error)) {
      throw new ConsoleError("conflict", `room ${input.roomNumber} already exists`);
    }
    throw error;
  }
}

export async function deleteRoom(hotelId: string, id: string, actor: ConsoleActor) {
  const hotel = await tenant(hotelId);
  const existing = await prisma.room.findFirst({
    where: { id, roomType: { hotelId } },
    include: { _count: { select: { bookingRooms: true, roomNights: true } } },
  });
  if (!existing) throw new ConsoleError("not_found", "room not found");
  if (existing._count.bookingRooms > 0 || existing._count.roomNights > 0) {
    throw new ConsoleError(
      "in_use",
      "this room has reservation history — set it out of service instead of deleting it",
    );
  }

  await prisma.room.delete({ where: { id } });
  await audit(
    actor,
    "room.delete",
    "room",
    id,
    roomAuditValues(existing),
    null,
    hotel.organizationId,
    hotelId,
  );
  return { id };
}

// ---------------------------------------------------------------------------
// Amenities
// ---------------------------------------------------------------------------

export async function listAmenities(hotelId: string) {
  const hotel = await tenant(hotelId);
  return prisma.amenity.findMany({
    where: {
      OR: [{ scope: "PLATFORM" }, { organizationId: hotel.organizationId }],
    },
    orderBy: { name: "asc" },
    include: { _count: { select: { roomTypes: true } } },
  });
}

export async function createAmenity(
  hotelId: string,
  input: AmenityUpsert,
  actor: ConsoleActor,
) {
  const hotel = await tenant(hotelId);
  const clash = await prisma.amenity.findFirst({
    where: {
      name: input.name,
      OR: [{ scope: "PLATFORM" }, { organizationId: hotel.organizationId }],
    },
    select: { id: true },
  });
  if (clash) throw new ConsoleError("conflict", "that amenity already exists");

  try {
    const created = await prisma.amenity.create({
      data: {
        scope: "TENANT",
        organizationId: hotel.organizationId,
        name: input.name,
        description: input.description ?? null,
      },
    });
    await audit(
      actor,
      "amenity.create",
      "amenity",
      created.id,
      null,
      { name: created.name, description: created.description },
      hotel.organizationId,
      hotelId,
    );
    return created;
  } catch (error) {
    if (isUniqueViolation(error)) throw new ConsoleError("conflict", "that amenity already exists");
    throw error;
  }
}

async function tenantAmenity(hotelId: string, id: string) {
  const hotel = await tenant(hotelId);
  const existing = await prisma.amenity.findFirst({
    where: { id, scope: "TENANT", organizationId: hotel.organizationId },
  });
  // Platform taxonomy is read-only to tenants.
  if (!existing) throw new ConsoleError("not_found", "amenity not found");
  return { existing, hotel };
}

export async function updateAmenity(
  hotelId: string,
  id: string,
  input: AmenityUpsert,
  actor: ConsoleActor,
) {
  const { existing, hotel } = await tenantAmenity(hotelId, id);
  const clash = await prisma.amenity.findFirst({
    where: {
      name: input.name,
      id: { not: id },
      OR: [{ scope: "PLATFORM" }, { organizationId: hotel.organizationId }],
    },
    select: { id: true },
  });
  if (clash) throw new ConsoleError("conflict", "that amenity already exists");
  try {
    const updated = await prisma.amenity.update({
      where: { id },
      data: { name: input.name, description: input.description ?? null },
    });
    await audit(
      actor,
      "amenity.update",
      "amenity",
      id,
      { name: existing.name, description: existing.description },
      { name: updated.name, description: updated.description },
      hotel.organizationId,
      hotelId,
    );
    return updated;
  } catch (error) {
    if (isUniqueViolation(error)) throw new ConsoleError("conflict", "that amenity already exists");
    throw error;
  }
}

export async function deleteAmenity(hotelId: string, id: string, actor: ConsoleActor) {
  const { existing, hotel } = await tenantAmenity(hotelId, id);
  const usage = await prisma.roomTypeAmenity.count({ where: { amenityId: id } });
  if (usage > 0) {
    throw new ConsoleError("in_use", "this amenity is still linked to room types");
  }
  await prisma.amenity.delete({ where: { id } });
  await audit(
    actor,
    "amenity.delete",
    "amenity",
    id,
    { name: existing.name },
    null,
    hotel.organizationId,
    hotelId,
  );
  return { id };
}

// ---------------------------------------------------------------------------
// Rates
// ---------------------------------------------------------------------------

function rateAuditValues(row: {
  roomTypeId: string;
  name: string;
  amount: Prisma.Decimal;
  startDate: Date;
  endDate: Date;
  status: RecordStatus;
}) {
  return {
    roomTypeId: row.roomTypeId,
    name: row.name,
    amount: row.amount.toString(),
    startDate: row.startDate.toISOString().slice(0, 10),
    endDate: row.endDate.toISOString().slice(0, 10),
    status: row.status,
  };
}

export async function listRates(hotelId: string, roomTypeId?: string) {
  return prisma.rate.findMany({
    where: {
      roomType: { hotelId },
      ...(roomTypeId ? { roomTypeId } : {}),
    },
    orderBy: [{ startDate: "desc" }, { name: "asc" }],
    include: { roomType: { select: { name: true } } },
  });
}

export async function createRate(hotelId: string, input: RateUpsert, actor: ConsoleActor) {
  const hotel = await tenant(hotelId);
  const roomType = await prisma.roomType.findFirst({
    where: { id: input.roomTypeId, hotelId },
  });
  if (!roomType) throw new ConsoleError("not_found", "room type not found");

  const created = await prisma.rate.create({
    data: {
      roomTypeId: input.roomTypeId,
      name: input.name,
      amount: input.amount,
      startDate: new Date(`${input.startDate}T00:00:00.000Z`),
      endDate: new Date(`${input.endDate}T00:00:00.000Z`),
      status: input.status,
    },
  });
  await audit(
    actor,
    "rate.create",
    "rate",
    created.id,
    null,
    rateAuditValues(created),
    hotel.organizationId,
    hotelId,
  );
  return created;
}

export async function updateRate(
  hotelId: string,
  id: string,
  input: RateUpsert,
  actor: ConsoleActor,
) {
  const hotel = await tenant(hotelId);
  const existing = await prisma.rate.findFirst({
    where: { id, roomType: { hotelId } },
  });
  if (!existing) throw new ConsoleError("not_found", "rate not found");
  const roomType = await prisma.roomType.findFirst({
    where: { id: input.roomTypeId, hotelId },
  });
  if (!roomType) throw new ConsoleError("not_found", "room type not found");

  const updated = await prisma.rate.update({
    where: { id },
    data: {
      roomTypeId: input.roomTypeId,
      name: input.name,
      amount: input.amount,
      startDate: new Date(`${input.startDate}T00:00:00.000Z`),
      endDate: new Date(`${input.endDate}T00:00:00.000Z`),
      status: input.status,
    },
  });
  await audit(
    actor,
    "rate.update",
    "rate",
    id,
    rateAuditValues(existing),
    rateAuditValues(updated),
    hotel.organizationId,
    hotelId,
  );
  return updated;
}

export async function deleteRate(hotelId: string, id: string, actor: ConsoleActor) {
  const hotel = await tenant(hotelId);
  const existing = await prisma.rate.findFirst({
    where: { id, roomType: { hotelId } },
  });
  if (!existing) throw new ConsoleError("not_found", "rate not found");
  await prisma.rate.delete({ where: { id } });
  await audit(
    actor,
    "rate.delete",
    "rate",
    id,
    rateAuditValues(existing),
    null,
    hotel.organizationId,
    hotelId,
  );
  return { id };
}

// ---------------------------------------------------------------------------
// Promotions
// ---------------------------------------------------------------------------

function promotionAuditValues(row: {
  code: string;
  type: string;
  value: Prisma.Decimal;
  startAt: Date;
  endAt: Date;
  maxUses: number | null;
  status: RecordStatus;
}) {
  return {
    code: row.code,
    type: row.type,
    value: row.value.toString(),
    startAt: row.startAt.toISOString(),
    endAt: row.endAt.toISOString(),
    maxUses: row.maxUses,
    status: row.status,
  };
}

export async function listPromotions(hotelId: string) {
  return prisma.promotion.findMany({
    where: { hotelId },
    orderBy: [{ status: "asc" }, { code: "asc" }],
    include: { _count: { select: { bookings: true } } },
  });
}

export async function createPromotion(
  hotelId: string,
  input: PromotionUpsert,
  actor: ConsoleActor,
) {
  const hotel = await tenant(hotelId);
  const code = input.code.toUpperCase();
  const clash = await prisma.promotion.findFirst({
    where: { hotelId, code },
    select: { id: true },
  });
  if (clash) throw new ConsoleError("conflict", `promotion code ${code} already exists`);

  try {
    const created = await prisma.promotion.create({
      data: {
        hotelId,
        code,
        type: input.type,
        value: input.value,
        startAt: new Date(input.startAt),
        endAt: new Date(input.endAt),
        maxUses: input.maxUses ?? null,
        status: input.status,
      },
    });
    await audit(
      actor,
      "promotion.create",
      "promotion",
      created.id,
      null,
      promotionAuditValues(created),
      hotel.organizationId,
      hotelId,
    );
    return created;
  } catch (error) {
    if (isUniqueViolation(error)) {
      throw new ConsoleError("conflict", `promotion code ${code} already exists`);
    }
    throw error;
  }
}

export async function updatePromotion(
  hotelId: string,
  id: string,
  input: PromotionUpsert,
  actor: ConsoleActor,
) {
  const hotel = await tenant(hotelId);
  const existing = await prisma.promotion.findFirst({ where: { id, hotelId } });
  if (!existing) throw new ConsoleError("not_found", "promotion not found");
  const code = input.code.toUpperCase();
  const clash = await prisma.promotion.findFirst({
    where: { hotelId, code, id: { not: id } },
    select: { id: true },
  });
  if (clash) throw new ConsoleError("conflict", `promotion code ${code} already exists`);
  try {
    const updated = await prisma.promotion.update({
      where: { id },
      data: {
        code,
        type: input.type,
        value: input.value,
        startAt: new Date(input.startAt),
        endAt: new Date(input.endAt),
        maxUses: input.maxUses ?? null,
        status: input.status,
      },
    });
    await audit(
      actor,
      "promotion.update",
      "promotion",
      id,
      promotionAuditValues(existing),
      promotionAuditValues(updated),
      hotel.organizationId,
      hotelId,
    );
    return updated;
  } catch (error) {
    if (isUniqueViolation(error)) {
      throw new ConsoleError("conflict", `promotion code ${code} already exists`);
    }
    throw error;
  }
}

export async function deletePromotion(hotelId: string, id: string, actor: ConsoleActor) {
  const hotel = await tenant(hotelId);
  const existing = await prisma.promotion.findFirst({
    where: { id, hotelId },
    include: { _count: { select: { bookings: true } } },
  });
  if (!existing) throw new ConsoleError("not_found", "promotion not found");
  if (existing._count.bookings > 0) {
    throw new ConsoleError(
      "in_use",
      "this promotion has been redeemed — mark it inactive instead of deleting it",
    );
  }
  await prisma.promotion.delete({ where: { id } });
  await audit(
    actor,
    "promotion.delete",
    "promotion",
    id,
    promotionAuditValues(existing),
    null,
    hotel.organizationId,
    hotelId,
  );
  return { id };
}
