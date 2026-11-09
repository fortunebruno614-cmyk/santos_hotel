import { prisma } from "@/lib/prisma";
import { writeAuditLog } from "@/server/audit/write";
import { hashPassword } from "@/server/auth/crypto";
import { ConsoleError } from "@/server/console/errors";
import type { PlatformRole } from "@/generated/prisma/client";
import { z } from "zod";

export const PlatformAdminCreateSchema = z.object({
  name: z.string().trim().min(2).max(80),
  email: z.string().trim().toLowerCase().email().max(200),
  password: z.string().min(8).max(200),
});

export type PlatformAdminCreate = z.infer<typeof PlatformAdminCreateSchema>;

export async function countPlatformAdmins() {
  return prisma.user.count({ where: { platformRole: { not: null } } });
}

/**
 * First-run bootstrap. This is allowed only while the platform has no
 * operators at all, so a public deployment cannot be claimed after setup.
 */
export async function createFirstPlatformAdmin(input: PlatformAdminCreate) {
  if ((await countPlatformAdmins()) > 0) {
    throw new ConsoleError("conflict", "platform operators already exist");
  }
  const existing = await prisma.user.findUnique({ where: { email: input.email } });
  if (existing) throw new ConsoleError("conflict", "that e-mail is already registered");

  const user = await prisma.user.create({
    data: {
      name: input.name,
      email: input.email,
      passwordHash: await hashPassword(input.password),
      role: "ADMIN",
      platformRole: "ADMIN",
      isActive: true,
    },
  });
  await writeAuditLog({
    userId: user.id,
    actorType: "staff",
    action: "permission.change",
    entityType: "user",
    entityId: user.id,
    newValues: { platformRole: "ADMIN", bootstrap: true },
  });
  return user;
}

export async function createPlatformOperator(
  input: PlatformAdminCreate & { platformRole: PlatformRole },
  actor: { userId: string },
) {
  const existing = await prisma.user.findUnique({ where: { email: input.email } });
  if (existing) throw new ConsoleError("conflict", "that e-mail is already registered");
  const user = await prisma.user.create({
    data: {
      name: input.name,
      email: input.email,
      passwordHash: await hashPassword(input.password),
      role: "ADMIN",
      platformRole: input.platformRole,
      isActive: true,
    },
  });
  await writeAuditLog({
    userId: actor.userId,
    action: "permission.change",
    entityType: "user",
    entityId: user.id,
    newValues: { platformRole: input.platformRole },
  });
  return user;
}

export async function listPlatformOperators() {
  return prisma.user.findMany({
    where: { platformRole: { not: null } },
    orderBy: { createdAt: "asc" },
    select: {
      id: true,
      name: true,
      email: true,
      platformRole: true,
      isActive: true,
      createdAt: true,
    },
  });
}
