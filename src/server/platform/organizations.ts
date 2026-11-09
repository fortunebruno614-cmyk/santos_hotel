import { prisma } from "@/lib/prisma";
import { writeAuditLog } from "@/server/audit/write";
import { hashPassword } from "@/server/auth/crypto";
import { ConsoleError } from "@/server/console/errors";
import { createHotel, HotelCreateSchema } from "@/server/console/hotels";
import type { Hotel } from "@/generated/prisma/client";
import { z } from "zod";

/**
 * Platform-operator services: the Santo marketplace governance axis. These are
 * never reachable with a tenant role (REQ-026).
 */

export const OrganizationCreateSchema = z.object({
  organization: z.object({
    name: z.string().trim().min(2).max(120),
    slug: z
      .string()
      .trim()
      .min(2)
      .max(80)
      .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "expected a lowercase slug like santo-group"),
    email: z.string().trim().toLowerCase().email().max(200).optional().nullable(),
    phone: z.string().trim().max(40).optional().nullable(),
    country: z.string().trim().max(100).optional().nullable(),
  }),
  owner: z.object({
    name: z.string().trim().min(2).max(80),
    email: z.string().trim().toLowerCase().email().max(200),
    password: z.string().min(8).max(200),
  }),
  hotel: HotelCreateSchema.optional(),
});

export type OrganizationCreateInput = z.infer<typeof OrganizationCreateSchema>;

export async function listOrganizations() {
  return prisma.organization.findMany({
    orderBy: { createdAt: "desc" },
    include: {
      _count: { select: { hotels: true, members: true } },
      hotels: {
        orderBy: { createdAt: "asc" },
        select: {
          id: true,
          name: true,
          slug: true,
          city: true,
          country: true,
          currency: true,
          publicationStatus: true,
        },
      },
    },
  });
}

export async function getOrganizationDetail(id: string) {
  return prisma.organization.findUnique({
    where: { id },
    include: {
      hotels: { orderBy: { createdAt: "asc" } },
      members: {
        orderBy: { createdAt: "asc" },
        include: { user: { select: { id: true, name: true, email: true, isActive: true } } },
      },
    },
  });
}

export async function createOrganizationWithOwner(
  input: OrganizationCreateInput,
  actor: { userId: string },
) {
  const clash = await prisma.organization.findUnique({
    where: { slug: input.organization.slug },
    select: { id: true },
  });
  if (clash) throw new ConsoleError("conflict", "that organization slug is already in use");

  if (input.hotel) {
    const hotelClash = await prisma.hotel.findUnique({
      where: { slug: input.hotel.slug },
      select: { id: true },
    });
    if (hotelClash) {
      throw new ConsoleError("conflict", `the property slug ${input.hotel.slug} is already in use`);
    }
  }

  const existingUser = await prisma.user.findUnique({
    where: { email: input.owner.email },
  });

  const created = await prisma.$transaction(async (tx) => {
    const organization = await tx.organization.create({
      data: {
        name: input.organization.name,
        slug: input.organization.slug,
        email: input.organization.email ?? null,
        phone: input.organization.phone ?? null,
        country: input.organization.country ?? null,
        status: "ACTIVE",
      },
    });

    const passwordHash = existingUser
      ? existingUser.passwordHash
      : await hashPassword(input.owner.password);
    const owner = existingUser
      ? await tx.user.update({
          where: { id: existingUser.id },
          data: { name: input.owner.name, role: "ADMIN", isActive: true },
        })
      : await tx.user.create({
          data: {
            name: input.owner.name,
            email: input.owner.email,
            passwordHash,
            role: "ADMIN",
            isActive: true,
          },
        });

    const member = await tx.organizationMember.create({
      data: {
        organizationId: organization.id,
        userId: owner.id,
        role: "OWNER",
        status: "ACTIVE",
        activatedAt: new Date(),
      },
    });

    return { organization, owner, member };
  });

  await writeAuditLog({
    userId: actor.userId,
    organizationId: created.organization.id,
    action: "organization.create",
    entityType: "organization",
    entityId: created.organization.id,
    newValues: {
      name: created.organization.name,
      slug: created.organization.slug,
      owner: created.owner.email,
    },
  });
  await writeAuditLog({
    userId: actor.userId,
    organizationId: created.organization.id,
    action: "membership.invite",
    entityType: "organization_member",
    entityId: created.member.id,
    newValues: { userId: created.owner.id, email: created.owner.email, role: "OWNER" },
  });

  let hotel: Hotel | null = null;
  if (input.hotel) {
    hotel = await createHotel(created.organization.id, input.hotel, {
      userId: actor.userId,
      platform: true,
    });
  }

  return { ...created, hotel };
}

export async function setOrganizationStatus(
  organizationId: string,
  status: "ACTIVE" | "SUSPENDED" | "CLOSED",
  actor: { userId: string },
) {
  const organization = await prisma.organization.findUnique({ where: { id: organizationId } });
  if (!organization) throw new ConsoleError("not_found", "organization not found");
  if (organization.status === status) return organization;

  const updated = await prisma.$transaction(async (tx) => {
    const row = await tx.organization.update({
      where: { id: organizationId },
      data: { status },
    });
    if (status !== "ACTIVE") {
      // New bookings stop; existing confirmed reservations remain serviceable.
      await tx.hotel.updateMany({
        where: { organizationId, publicationStatus: { in: ["PUBLISHED", "PAUSED"] } },
        data: { publicationStatus: status === "CLOSED" ? "ARCHIVED" : "SUSPENDED" },
      });
    }
    return row;
  });

  await writeAuditLog({
    userId: actor.userId,
    organizationId,
    action:
      status === "SUSPENDED"
        ? "organization.suspend"
        : status === "CLOSED"
          ? "organization.close"
          : "organization.update",
    entityType: "organization",
    entityId: organizationId,
    oldValues: { status: organization.status },
    newValues: { status },
  });
  return updated;
}
