import { prisma } from "@/lib/prisma";
import { MemberStatus, OrganizationRole, UserRole } from "@/generated/prisma/enums";
import { writeAuditLog } from "@/server/audit/write";
import { hashPassword } from "@/server/auth/crypto";
import { ConsoleError } from "@/server/console/errors";
import type {
  MemberCreateSchema,
  MemberUpdateSchema,
  UserCreateSchema,
  UserUpdateSchema,
} from "@/server/console/validation";
import type { z } from "zod";

/**
 * P7/M4 organization members and their login accounts.
 *
 * Tenant access is membership-driven (OrganizationMember). The legacy
 * `User.role` column is kept consistent for the access map but never grants
 * permissions on its own. Guards:
 *   - a member can never demote/deactivate/delete themselves,
 *   - the last active OWNER of an organization can never be removed/demoted,
 *   - revocation preserves historical attribution (the user row remains).
 */

export type UserCreate = z.infer<typeof UserCreateSchema>;
export type UserUpdate = z.infer<typeof UserUpdateSchema>;
export type MemberCreate = z.infer<typeof MemberCreateSchema>;
export type MemberUpdate = z.infer<typeof MemberUpdateSchema>;

const USER_PUBLIC_SELECT = {
  id: true,
  name: true,
  email: true,
  role: true,
  isActive: true,
  lastLoginAt: true,
  createdAt: true,
} as const;

function legacyRole(role: OrganizationRole): UserRole {
  return role === OrganizationRole.OWNER ? UserRole.ADMIN : UserRole.STAFF;
}

async function countActiveOwners(organizationId: string, excludeMemberId?: string) {
  return prisma.organizationMember.count({
    where: {
      organizationId,
      role: OrganizationRole.OWNER,
      status: MemberStatus.ACTIVE,
      user: { isActive: true },
      ...(excludeMemberId ? { id: { not: excludeMemberId } } : {}),
    },
  });
}

async function validateHotelScope(organizationId: string, hotelIds: string[]) {
  if (hotelIds.length === 0) return;
  const count = await prisma.hotel.count({
    where: { organizationId, id: { in: hotelIds } },
  });
  if (count !== new Set(hotelIds).size) {
    throw new ConsoleError("not_found", "one or more hotels are outside this organization");
  }
}

// ---------------------------------------------------------------------------
// Memberships (the tenant access list)
// ---------------------------------------------------------------------------

export async function listMembers(organizationId: string) {
  return prisma.organizationMember.findMany({
    where: { organizationId },
    orderBy: [{ status: "asc" }, { createdAt: "asc" }],
    include: {
      user: { select: USER_PUBLIC_SELECT },
      hotels: { select: { hotelId: true } },
    },
  });
}

export async function createMember(
  organizationId: string,
  input: MemberCreate,
  actor: { userId: string },
) {
  await validateHotelScope(organizationId, input.hotelIds ?? []);

  const existingUser = await prisma.user.findUnique({ where: { email: input.email } });
  const clash = existingUser
    ? await prisma.organizationMember.findUnique({
        where: {
          organizationId_userId: {
            organizationId,
            userId: existingUser.id,
          },
        },
      })
    : null;
  if (clash) throw new ConsoleError("conflict", `${input.email} is already a member`);

  const user = existingUser
    ? await prisma.user.update({
        where: { id: existingUser.id },
        data: { name: input.name, isActive: true },
        select: USER_PUBLIC_SELECT,
      })
    : await prisma.user.create({
        data: {
          name: input.name,
          email: input.email,
          passwordHash: await hashPassword(input.password),
          role: legacyRole(input.role),
          isActive: true,
        },
        select: USER_PUBLIC_SELECT,
      });

  const member = await prisma.organizationMember.create({
    data: {
      organizationId,
      userId: user.id,
      role: input.role,
      status: MemberStatus.ACTIVE,
      activatedAt: new Date(),
      hotels: {
        create: (input.hotelIds ?? []).map((hotelId) => ({ hotelId })),
      },
    },
  });

  await writeAuditLog({
    userId: actor.userId,
    organizationId,
    action: "membership.invite",
    entityType: "organization_member",
    entityId: member.id,
    newValues: { userId: user.id, email: user.email, role: member.role },
  });
  return { ...member, user };
}

export async function updateMember(
  organizationId: string,
  memberId: string,
  input: MemberUpdate,
  actor: { userId: string },
) {
  const member = await prisma.organizationMember.findFirst({
    where: { id: memberId, organizationId },
  });
  if (!member) throw new ConsoleError("not_found", "member not found");

  if (member.userId === actor.userId) {
    throw new ConsoleError("cannot_change_self", "you cannot change your own access");
  }
  if (input.hotelIds) await validateHotelScope(organizationId, input.hotelIds);

  const losesOwner =
    member.role === OrganizationRole.OWNER &&
    ((input.role !== undefined && input.role !== OrganizationRole.OWNER) ||
      (input.status !== undefined && input.status !== MemberStatus.ACTIVE));
  if (losesOwner && (await countActiveOwners(organizationId, member.id)) === 0) {
    throw new ConsoleError("last_owner", "at least one active owner must remain");
  }

  const data: Record<string, unknown> = {};
  const oldValues: Record<string, unknown> = {};
  const newValues: Record<string, unknown> = {};
  if (input.role !== undefined && input.role !== member.role) {
    data.role = input.role;
    oldValues.role = member.role;
    newValues.role = input.role;
  }
  if (input.status !== undefined && input.status !== member.status) {
    data.status = input.status;
    if (input.status === MemberStatus.REVOKED) data.revokedAt = new Date();
    if (input.status === MemberStatus.ACTIVE) {
      data.activatedAt = member.activatedAt ?? new Date();
      data.revokedAt = null;
    }
    oldValues.status = member.status;
    newValues.status = input.status;
  }
  if (input.name) {
    await prisma.user.update({ where: { id: member.userId }, data: { name: input.name } });
    oldValues.name = "changed";
    newValues.name = input.name;
  }

  const updated = await prisma.$transaction(async (tx) => {
    const row = await tx.organizationMember.update({ where: { id: member.id }, data });
    if (input.hotelIds) {
      await tx.organizationMemberHotel.deleteMany({ where: { memberId: member.id } });
      if (input.hotelIds.length > 0) {
        await tx.organizationMemberHotel.createMany({
          data: input.hotelIds.map((hotelId) => ({ memberId: member.id, hotelId })),
        });
      }
    }
    return row;
  });

  await writeAuditLog({
    userId: actor.userId,
    organizationId,
    action: "membership.update",
    entityType: "organization_member",
    entityId: member.id,
    oldValues,
    newValues: { ...newValues, hotelIds: input.hotelIds ?? undefined },
  });
  return updated;
}

export async function revokeMember(
  organizationId: string,
  memberId: string,
  actor: { userId: string },
) {
  return updateMember(
    organizationId,
    memberId,
    { status: MemberStatus.REVOKED } as MemberUpdate,
    actor,
  );
}

// ---------------------------------------------------------------------------
// Legacy account helpers (kept for the existing user API, now org-scoped)
// ---------------------------------------------------------------------------

export async function listUsers(organizationId: string) {
  const members = await listMembers(organizationId);
  return members.map((member) => ({
    ...member.user,
    memberId: member.id,
    organizationRole: member.role,
    membershipStatus: member.status,
    hotelIds: member.hotels.map((hotel) => hotel.hotelId),
  }));
}

export async function createUser(
  organizationId: string,
  input: UserCreate,
  actor: { userId: string },
) {
  const member = await createMember(
    organizationId,
    {
      name: input.name,
      email: input.email,
      password: input.password,
      role:
        input.role === UserRole.ADMIN ? OrganizationRole.OWNER : OrganizationRole.STAFF,
      hotelIds: [],
    },
    actor,
  );
  return {
    ...member.user,
    memberId: member.id,
    organizationRole: member.role,
    membershipStatus: member.status,
    hotelIds: [] as string[],
  };
}

export async function updateUser(
  organizationId: string,
  memberId: string,
  input: UserUpdate,
  actor: { userId: string },
) {
  const member = await prisma.organizationMember.findFirst({
    where: { id: memberId, organizationId },
    include: { user: { select: USER_PUBLIC_SELECT } },
  });
  if (!member) throw new ConsoleError("not_found", "member not found");
  if (member.userId === actor.userId && (input.role !== undefined || input.isActive !== undefined)) {
    throw new ConsoleError("cannot_change_self", "you cannot change your own role or access");
  }

  const nextOrgRole =
    input.role === undefined
      ? undefined
      : input.role === UserRole.ADMIN
        ? OrganizationRole.OWNER
        : OrganizationRole.STAFF;
  const losesOwner =
    member.role === OrganizationRole.OWNER &&
    ((nextOrgRole !== undefined && nextOrgRole !== OrganizationRole.OWNER) ||
      (input.isActive !== undefined && !input.isActive));
  if (
    losesOwner &&
    member.status === MemberStatus.ACTIVE &&
    (await countActiveOwners(organizationId, member.id)) === 0
  ) {
    throw new ConsoleError("last_owner", "at least one active owner must remain");
  }

  const data: Record<string, unknown> = {};
  const oldValues: Record<string, unknown> = {};
  const newValues: Record<string, unknown> = {};
  if (input.name !== undefined) {
    data.name = input.name;
    oldValues.name = "changed";
    newValues.name = input.name;
  }
  if (input.role !== undefined && input.role !== member.user.role) {
    data.role = input.role;
    oldValues.role = member.user.role;
    newValues.role = input.role;
  }
  if (input.isActive !== undefined && input.isActive !== member.user.isActive) {
    data.isActive = input.isActive;
    oldValues.isActive = member.user.isActive;
    newValues.isActive = input.isActive;
  }
  if (input.password) {
    data.passwordHash = await hashPassword(input.password);
    oldValues.password = "unchanged";
    newValues.password = "changed";
  }

  if (Object.keys(data).length === 0) return member.user;

  const updated = await prisma.$transaction(async (tx) => {
    const user = await tx.user.update({
      where: { id: member.userId },
      data,
      select: USER_PUBLIC_SELECT,
    });
    if (nextOrgRole !== undefined && nextOrgRole !== member.role) {
      await tx.organizationMember.update({
        where: { id: member.id },
        data: { role: nextOrgRole },
      });
    }
    return user;
  });

  if (oldValues.role || newValues.role) {
    await writeAuditLog({
      userId: actor.userId,
      organizationId,
      action: "permission.change",
      entityType: "user",
      entityId: member.userId,
      oldValues: { role: oldValues.role },
      newValues: { role: newValues.role },
    });
  }
  const otherOld = { ...oldValues };
  delete otherOld.role;
  const otherNew = { ...newValues };
  delete otherNew.role;
  if (Object.keys(otherNew).length > 0) {
    await writeAuditLog({
      userId: actor.userId,
      organizationId,
      action: "user.update",
      entityType: "user",
      entityId: member.userId,
      oldValues: Object.keys(otherOld).length > 0 ? otherOld : null,
      newValues: otherNew,
    });
  }
  return updated;
}

export async function deleteUser(
  organizationId: string,
  memberId: string,
  actor: { userId: string },
) {
  const member = await prisma.organizationMember.findFirst({
    where: { id: memberId, organizationId },
    include: { user: { select: USER_PUBLIC_SELECT } },
  });
  if (!member) throw new ConsoleError("not_found", "member not found");
  if (member.userId === actor.userId) {
    throw new ConsoleError("cannot_delete_self", "you cannot delete your own account");
  }
  if (
    member.role === OrganizationRole.OWNER &&
    member.status === MemberStatus.ACTIVE &&
    (await countActiveOwners(organizationId, member.id)) === 0
  ) {
    throw new ConsoleError("last_owner", "at least one active owner must remain");
  }

  // Revocation, not deletion: historical audit/booking attribution must survive.
  await prisma.organizationMember.delete({ where: { id: member.id } });
  await writeAuditLog({
    userId: actor.userId,
    organizationId,
    action: "membership.revoke",
    entityType: "organization_member",
    entityId: member.id,
    oldValues: { email: member.user.email, role: member.role },
    newValues: null,
  });
  return { id: member.id };
}
