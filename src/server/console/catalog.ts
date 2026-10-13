import { prisma } from "@/lib/prisma";
import { Prisma, RecordStatus, RoomStatus } from "@/generated/prisma/client";
import { writeAuditLog, type AuditAction } from "@/server/audit/write";
import { assertRoomTransition } from "@/server/booking/policy";
import { ConsoleError } from "@/server/console/errors";
import type {
  AmenityUpsertSchema,
  PromotionUpsertSchema,
  RateUpsertSchema,
  RoomTypeUpsertSchema,
  RoomUpsertSchema,
} from "@/server/console/validation";
import type { z } from "zod";

/**
 * P7 catalog services — the hotel's configuration entities (room types,
 * physical rooms, amenities, rates, promotions) with create/update/delete.
 *
 * Every mutation:
 *   1. re-reads the row it is about to change (never trusts the client),
 *   2. refuses conflicts (duplicate room number / code / name) and destructive
 *      deletes of rows still in use (`ConsoleError`),
 *   3. writes an `AuditLog` with the old and new values after the change.
 *
 * Availability and pricing keep reading these tables exactly as before — this
 * module only *writes* them.
 */

export type ConsoleActor = { userId: string };

type RoomTypeUpsert = z.infer<typeof RoomTypeUpsertSchema>;
type RoomUpsert = z.infer<typeof RoomUpsertSchema>;
type AmenityUpsert = z.infer<typeof AmenityUpsertSchema>;
type RateUpsert = z.infer<typeof RateUpsertSchema>;
type PromotionUpsert = z.infer<typeof PromotionUpsertSchema>;

async function audit(
  actor: ConsoleActor,
  action: AuditAction,
  entityType: string,
  entityId: string,
  oldValues: Record<string, unknown> | null,
  newValues: Record<string, unknown> | null,
) {
  await writeAuditLog({
    userId: actor.userId,
    action,
    entityType,
    entityId,
    oldValues,
    newValues,
  });
}

async function hotelIdOrThrow(client: Prisma.TransactionClient | typeof prisma): Promise<string> {
  const hotel = await client.hotel.findFirst({ orderBy: { createdAt: "asc" } });
  if (!hotel) throw new ConsoleError("not_found", "no hotel row — run the database seed");
  return hotel.id;
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

export async function listRoomTypes() {
  return prisma.roomType.findMany({
    orderBy: [{ status: "asc" }, { name: "asc" }],
    include: {
      _count: { select: { rooms: true } },
      amenities: { include: { amenity: { select: { id: true, name: true } } } },
    },
  });
}

export async function createRoomType(input: RoomTypeUpsert, actor: ConsoleActor) {
  const hotelId = await hotelIdOrThrow(prisma);
  const amenityIds = input.amenityIds ?? [];
  try {
    const created = await prisma.$transaction(async (tx) => {
      // Uniqueness is checked here instead of relying on the unique index:
      // the local dev database (PGlite wire server) poisons the connection on
      // any SQL-level error inside a transaction, so conflicts must surface
      // as application errors. The index still guards against races.
      const clash = await tx.roomType.findFirst({
        where: { OR: [{ name: input.name }, { slug: input.slug }] },
        select: { id: true },
      });
      if (clash) {
        throw new ConsoleError("conflict", "a room type with that name or slug already exists");
      }
      const row = await tx.roomType.create({
        data: {
          hotelId,
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
    await audit(actor, "room_type.create", "room_type", created.id, null, roomTypeAuditValues(created));
    return created;
  } catch (error) {
    if (isUniqueViolation(error)) {
      throw new ConsoleError("conflict", `a room type with that name or slug already exists`);
    }
    throw error;
  }
}

export async function updateRoomType(id: string, input: RoomTypeUpsert, actor: ConsoleActor) {
  const existing = await prisma.roomType.findUnique({ where: { id } });
  if (!existing) throw new ConsoleError("not_found", "room type not found");
  const amenityIds = input.amenityIds;

  try {
    const updated = await prisma.$transaction(async (tx) => {
      const clash = await tx.roomType.findFirst({
        where: {
          id: { not: id },
          OR: [{ name: input.name }, { slug: input.slug }],
        },
        select: { id: true },
      });
      if (clash) {
        throw new ConsoleError("conflict", "a room type with that name or slug already exists");
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
    );
    return updated;
  } catch (error) {
    if (isUniqueViolation(error)) {
      throw new ConsoleError("conflict", `a room type with that name or slug already exists`);
    }
    throw error;
  }
}

/** Deactivate instead of deleting when the type has rooms or history. */
export async function deleteRoomType(id: string, actor: ConsoleActor) {
  const existing = await prisma.roomType.findUnique({
    where: { id },
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
  await audit(actor, "room_type.delete", "room_type", id, roomTypeAuditValues(existing), null);
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

export async function listRooms() {
  return prisma.room.findMany({
    orderBy: { roomNumber: "asc" },
    include: { roomType: { select: { id: true, name: true, status: true } } },
  });
}

export async function createRoom(input: RoomUpsert, actor: ConsoleActor) {
  const roomType = await prisma.roomType.findUnique({ where: { id: input.roomTypeId } });
  if (!roomType) throw new ConsoleError("not_found", "room type not found");

  const clash = await prisma.room.findUnique({
    where: { roomNumber: input.roomNumber },
    select: { id: true },
  });
  if (clash) throw new ConsoleError("conflict", `room ${input.roomNumber} already exists`);

  try {
    const created = await prisma.room.create({
      data: {
        roomTypeId: input.roomTypeId,
        roomNumber: input.roomNumber,
        floor: input.floor ?? null,
        status: input.status,
        notes: input.notes ?? null,
      },
    });
    await audit(actor, "room.create", "room", created.id, null, roomAuditValues(created));
    return created;
  } catch (error) {
    if (isUniqueViolation(error)) {
      throw new ConsoleError("conflict", `room ${input.roomNumber} already exists`);
    }
    throw error;
  }
}

export async function updateRoom(id: string, input: RoomUpsert, actor: ConsoleActor) {
  const existing = await prisma.room.findUnique({ where: { id } });
  if (!existing) throw new ConsoleError("not_found", "room not found");
  const roomType = await prisma.roomType.findUnique({ where: { id: input.roomTypeId } });
  if (!roomType) throw new ConsoleError("not_found", "room type not found");

  // A status change here still obeys the housekeeping transition table — the
  // same rule the board enforces (OCCUPIED → AVAILABLE is never allowed).
  if (input.status !== existing.status) {
    assertRoomTransition(existing.status, input.status);
  }

  const clash = await prisma.room.findFirst({
    where: { roomNumber: input.roomNumber, id: { not: id } },
    select: { id: true },
  });
  if (clash) throw new ConsoleError("conflict", `room ${input.roomNumber} already exists`);

  try {
    const updated = await prisma.room.update({
      where: { id },
      data: {
        roomTypeId: input.roomTypeId,
        roomNumber: input.roomNumber,
        floor: input.floor ?? null,
        status: input.status,
        notes: input.notes ?? null,
      },
    });
    await audit(actor, "room.update", "room", id, roomAuditValues(existing), roomAuditValues(updated));
    return updated;
  } catch (error) {
    if (isUniqueViolation(error)) {
      throw new ConsoleError("conflict", `room ${input.roomNumber} already exists`);
    }
    throw error;
  }
}

export async function deleteRoom(id: string, actor: ConsoleActor) {
  const existing = await prisma.room.findUnique({
    where: { id },
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
  await audit(actor, "room.delete", "room", id, roomAuditValues(existing), null);
  return { id };
}

// ---------------------------------------------------------------------------
// Amenities
// ---------------------------------------------------------------------------

export async function listAmenities() {
  return prisma.amenity.findMany({
    orderBy: { name: "asc" },
    include: { _count: { select: { roomTypes: true } } },
  });
}

export async function createAmenity(input: AmenityUpsert, actor: ConsoleActor) {
  const clash = await prisma.amenity.findFirst({
    where: { name: input.name },
    select: { id: true },
  });
  if (clash) throw new ConsoleError("conflict", "that amenity already exists");

  try {
    const created = await prisma.amenity.create({
      data: { name: input.name, description: input.description ?? null },
    });
    await audit(actor, "amenity.create", "amenity", created.id, null, {
      name: created.name,
      description: created.description,
    });
    return created;
  } catch (error) {
    if (isUniqueViolation(error)) throw new ConsoleError("conflict", "that amenity already exists");
    throw error;
  }
}

export async function updateAmenity(id: string, input: AmenityUpsert, actor: ConsoleActor) {
  const existing = await prisma.amenity.findUnique({ where: { id } });
  if (!existing) throw new ConsoleError("not_found", "amenity not found");
  const clash = await prisma.amenity.findFirst({
    where: { name: input.name, id: { not: id } },
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
    );
    return updated;
  } catch (error) {
    if (isUniqueViolation(error)) throw new ConsoleError("conflict", "that amenity already exists");
    throw error;
  }
}

export async function deleteAmenity(id: string, actor: ConsoleActor) {
  const existing = await prisma.amenity.findUnique({
    where: { id },
    include: { _count: { select: { roomTypes: true } } },
  });
  if (!existing) throw new ConsoleError("not_found", "amenity not found");
  if (existing._count.roomTypes > 0) {
    throw new ConsoleError("in_use", "this amenity is still linked to room types");
  }
  await prisma.amenity.delete({ where: { id } });
  await audit(actor, "amenity.delete", "amenity", id, { name: existing.name }, null);
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

export async function listRates(roomTypeId?: string) {
  return prisma.rate.findMany({
    ...(roomTypeId ? { where: { roomTypeId } } : {}),
    orderBy: [{ startDate: "desc" }, { name: "asc" }],
    include: { roomType: { select: { name: true } } },
  });
}

export async function createRate(input: RateUpsert, actor: ConsoleActor) {
  const roomType = await prisma.roomType.findUnique({ where: { id: input.roomTypeId } });
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
  await audit(actor, "rate.create", "rate", created.id, null, rateAuditValues(created));
  return created;
}

export async function updateRate(id: string, input: RateUpsert, actor: ConsoleActor) {
  const existing = await prisma.rate.findUnique({ where: { id } });
  if (!existing) throw new ConsoleError("not_found", "rate not found");
  const roomType = await prisma.roomType.findUnique({ where: { id: input.roomTypeId } });
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
  await audit(actor, "rate.update", "rate", id, rateAuditValues(existing), rateAuditValues(updated));
  return updated;
}

export async function deleteRate(id: string, actor: ConsoleActor) {
  const existing = await prisma.rate.findUnique({ where: { id } });
  if (!existing) throw new ConsoleError("not_found", "rate not found");
  await prisma.rate.delete({ where: { id } });
  await audit(actor, "rate.delete", "rate", id, rateAuditValues(existing), null);
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

export async function listPromotions() {
  return prisma.promotion.findMany({
    orderBy: [{ status: "asc" }, { code: "asc" }],
    include: { _count: { select: { bookings: true } } },
  });
}

export async function createPromotion(input: PromotionUpsert, actor: ConsoleActor) {
  const code = input.code.toUpperCase();
  const clash = await prisma.promotion.findFirst({
    where: { code },
    select: { id: true },
  });
  if (clash) throw new ConsoleError("conflict", `promotion code ${code} already exists`);

  try {
    const created = await prisma.promotion.create({
      data: {
        code: input.code.toUpperCase(),
        type: input.type,
        value: input.value,
        startAt: new Date(input.startAt),
        endAt: new Date(input.endAt),
        maxUses: input.maxUses ?? null,
        status: input.status,
      },
    });
    await audit(actor, "promotion.create", "promotion", created.id, null, promotionAuditValues(created));
    return created;
  } catch (error) {
    if (isUniqueViolation(error)) {
      throw new ConsoleError("conflict", `promotion code ${input.code.toUpperCase()} already exists`);
    }
    throw error;
  }
}

export async function updatePromotion(id: string, input: PromotionUpsert, actor: ConsoleActor) {
  const existing = await prisma.promotion.findUnique({ where: { id } });
  if (!existing) throw new ConsoleError("not_found", "promotion not found");
  const code = input.code.toUpperCase();
  const clash = await prisma.promotion.findFirst({
    where: { code, id: { not: id } },
    select: { id: true },
  });
  if (clash) throw new ConsoleError("conflict", `promotion code ${code} already exists`);
  try {
    const updated = await prisma.promotion.update({
      where: { id },
      data: {
        code: input.code.toUpperCase(),
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
    );
    return updated;
  } catch (error) {
    if (isUniqueViolation(error)) {
      throw new ConsoleError("conflict", `promotion code ${input.code.toUpperCase()} already exists`);
    }
    throw error;
  }
}

export async function deletePromotion(id: string, actor: ConsoleActor) {
  const existing = await prisma.promotion.findUnique({
    where: { id },
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
  await audit(actor, "promotion.delete", "promotion", id, promotionAuditValues(existing), null);
  return { id };
}
