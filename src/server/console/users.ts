import { prisma } from "@/lib/prisma";
import { UserRole } from "@/generated/prisma/enums";
import { writeAuditLog } from "@/server/audit/write";
import { hashPassword } from "@/server/auth/crypto";
import { ConsoleError } from "@/server/console/errors";
import type { UserCreateSchema, UserUpdateSchema } from "@/server/console/validation";
import type { z } from "zod";

/**
 * P7 user & permission management.
 *
 * Guards that must hold no matter which UI calls the service:
 *   - an admin can never demote, deactivate or delete themselves (the console
 *     must not be able to lock out its own operator),
 *   - the last active ADMIN can never be removed or demoted,
 *   - passwords are stored only as scrypt hashes and never appear in audit rows.
 */

export type UserCreate = z.infer<typeof UserCreateSchema>;
export type UserUpdate = z.infer<typeof UserUpdateSchema>;

const USER_PUBLIC_SELECT = {
  id: true,
  name: true,
  email: true,
  role: true,
  isActive: true,
  lastLoginAt: true,
  createdAt: true,
} as const;

export async function listUsers() {
  return prisma.user.findMany({ select: USER_PUBLIC_SELECT, orderBy: { createdAt: "desc" } });
}

async function countActiveAdmins(excludeUserId?: string) {
  return prisma.user.count({
    where: {
      role: UserRole.ADMIN,
      isActive: true,
      ...(excludeUserId ? { id: { not: excludeUserId } } : {}),
    },
  });
}

export async function createUser(input: UserCreate, actor: { userId: string }) {
  const existing = await prisma.user.findUnique({ where: { email: input.email } });
  if (existing) throw new ConsoleError("conflict", `a user with ${input.email} already exists`);

  const passwordHash = await hashPassword(input.password);
  const created = await prisma.user.create({
    data: {
      name: input.name,
      email: input.email,
      passwordHash,
      role: input.role,
      isActive: true,
    },
    select: USER_PUBLIC_SELECT,
  });

  await writeAuditLog({
    userId: actor.userId,
    action: "user.create",
    entityType: "user",
    entityId: created.id,
    oldValues: null,
    newValues: { name: created.name, email: created.email, role: created.role, isActive: true },
  });
  return created;
}

export async function updateUser(id: string, input: UserUpdate, actor: { userId: string }) {
  const target = await prisma.user.findUnique({ where: { id } });
  if (!target) throw new ConsoleError("not_found", "user not found");

  if (target.id === actor.userId && (input.role !== undefined || input.isActive !== undefined)) {
    throw new ConsoleError("cannot_change_self", "you cannot change your own role or access");
  }

  const losesAdmin =
    target.role === UserRole.ADMIN &&
    ((input.role !== undefined && input.role !== UserRole.ADMIN) ||
      (input.isActive !== undefined && !input.isActive));
  if (losesAdmin && (await countActiveAdmins(target.id)) === 0) {
    throw new ConsoleError("last_admin", "at least one active administrator must remain");
  }

  const oldValues: Record<string, unknown> = {};
  const newValues: Record<string, unknown> = {};
  const data: Record<string, unknown> = {};

  if (input.name !== undefined && input.name !== target.name) {
    data.name = input.name;
    oldValues.name = target.name;
    newValues.name = input.name;
  }
  if (input.role !== undefined && input.role !== target.role) {
    data.role = input.role;
    oldValues.role = target.role;
    newValues.role = input.role;
  }
  if (input.isActive !== undefined && input.isActive !== target.isActive) {
    data.isActive = input.isActive;
    oldValues.isActive = target.isActive;
    newValues.isActive = input.isActive;
  }
  if (input.password) {
    data.passwordHash = await hashPassword(input.password);
    newValues.password = "changed";
    oldValues.password = "unchanged";
  }

  if (Object.keys(data).length === 0) {
    return prisma.user.findUniqueOrThrow({ where: { id }, select: USER_PUBLIC_SELECT });
  }

  const updated = await prisma.user.update({
    where: { id },
    data,
    select: USER_PUBLIC_SELECT,
  });

  if (oldValues.role || newValues.role) {
    // Role changes keep their dedicated audit action (P3 contract).
    await writeAuditLog({
      userId: actor.userId,
      action: "permission.change",
      entityType: "user",
      entityId: id,
      oldValues: { role: oldValues.role ?? target.role },
      newValues: { role: newValues.role ?? target.role },
    });
  }
  const otherOld = { ...oldValues };
  delete otherOld.role;
  const otherNew = { ...newValues };
  delete otherNew.role;
  if (Object.keys(otherNew).length > 0) {
    await writeAuditLog({
      userId: actor.userId,
      action: "user.update",
      entityType: "user",
      entityId: id,
      oldValues: Object.keys(otherOld).length > 0 ? otherOld : null,
      newValues: otherNew,
    });
  }

  return updated;
}

export async function deleteUser(id: string, actor: { userId: string }) {
  const target = await prisma.user.findUnique({ where: { id } });
  if (!target) throw new ConsoleError("not_found", "user not found");
  if (target.id === actor.userId) {
    throw new ConsoleError("cannot_delete_self", "you cannot delete your own account");
  }
  if (target.role === UserRole.ADMIN && (await countActiveAdmins(target.id)) === 0) {
    throw new ConsoleError("last_admin", "at least one active administrator must remain");
  }

  await prisma.user.delete({ where: { id } });
  await writeAuditLog({
    userId: actor.userId,
    action: "user.delete",
    entityType: "user",
    entityId: id,
    oldValues: { name: target.name, email: target.email, role: target.role },
    newValues: null,
  });
  return { id };
}
