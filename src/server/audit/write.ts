import { prisma } from "@/lib/prisma";
import type { AppRole } from "@/server/auth/roles";
import type { Prisma } from "@/generated/prisma/client";

export type AuditAction =
  | "auth.login"
  | "auth.login_failed"
  | "auth.logout"
  | "auth.signup"
  | "auth.password_change"
  | "auth.access_denied"
  | "permission.change"
  | "user.create"
  | "user.update"
  | "user.delete";

export type AuditActor = {
  /** Staff/admin user id. Guest principals have no users row, so this stays null. */
  userId?: string | null;
  guestId?: string | null;
};

export async function writeAuditLog(opts: {
  userId?: string | null;
  action: AuditAction;
  entityType: string;
  entityId: string;
  oldValues?: Record<string, unknown> | null;
  newValues?: Record<string, unknown> | null;
}) {
  try {
    await prisma.auditLog.create({
      data: {
        userId: opts.userId ?? null,
        action: opts.action,
        entityType: opts.entityType,
        entityId: opts.entityId,
        ...(opts.oldValues ? { oldValues: opts.oldValues as Prisma.InputJsonValue } : {}),
        ...(opts.newValues ? { newValues: opts.newValues as Prisma.InputJsonValue } : {}),
      },
    });
  } catch (err) {
    // Audit failures must never block the request they describe.
    console.error("audit log write failed", err);
  }
}

export async function auditLogin(actor: AuditActor, role: AppRole, email?: string | null) {
  await writeAuditLog({
    userId: actor.userId ?? null,
    action: "auth.login",
    entityType: actor.userId ? "user" : "guest",
    entityId: actor.userId ?? actor.guestId ?? "unknown",
    newValues: { role, email: email ?? null },
  });
}

export async function auditLoginFailed(
  kind: "staff" | "guest",
  email: string,
  reason: "invalid_credentials" | "rate_limited",
  ip?: string | null,
) {
  await writeAuditLog({
    userId: null,
    action: "auth.login_failed",
    entityType: kind,
    entityId: "auth",
    newValues: { email, reason, ip: ip ?? null },
  });
}

export async function auditLogout(actor: AuditActor) {
  await writeAuditLog({
    userId: actor.userId ?? null,
    action: "auth.logout",
    entityType: actor.userId ? "user" : "guest",
    entityId: actor.userId ?? actor.guestId ?? "unknown",
  });
}

export async function auditSignup(actor: AuditActor, email?: string | null) {
  await writeAuditLog({
    userId: actor.userId ?? null,
    action: "auth.signup",
    entityType: actor.userId ? "user" : "guest",
    entityId: actor.userId ?? actor.guestId ?? "unknown",
    newValues: { email: email ?? null },
  });
}

export async function auditPermissionChange(
  actorUserId: string,
  targetUserId: string,
  oldRole: AppRole,
  newRole: AppRole,
) {
  await writeAuditLog({
    userId: actorUserId,
    action: "permission.change",
    entityType: "user",
    entityId: targetUserId,
    oldValues: { role: oldRole },
    newValues: { role: newRole },
  });
}

/** An authenticated principal was told "no" by a guard (403). 401s are not logged. */
export async function auditAccessDenied(
  actor: AuditActor & { role?: AppRole },
  route: string,
  reason: string,
) {
  await writeAuditLog({
    userId: actor.userId ?? null,
    action: "auth.access_denied",
    entityType: actor.userId ? "user" : "guest",
    entityId: actor.userId ?? actor.guestId ?? "unknown",
    newValues: { route, reason, role: actor.role ?? null, guestId: actor.guestId ?? null },
  });
}
