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
  | "user.delete"
  | "guest.update"
  | "booking.create"
  | "booking.modify"
  | "booking.transition"
  | "booking.cancel"
  | "booking.note"
  | "room.create"
  | "room.update"
  | "room.delete"
  | "room.status"
  | "room_type.create"
  | "room_type.update"
  | "room_type.delete"
  | "amenity.create"
  | "amenity.update"
  | "amenity.delete"
  | "rate.create"
  | "rate.update"
  | "rate.delete"
  | "promotion.create"
  | "promotion.update"
  | "promotion.delete"
  | "settings.update"
  | "content.create"
  | "content.update"
  | "content.delete"
  | "payment.initiate"
  | "payment.succeeded"
  | "payment.failed"
  | "payment.refund"
  | "payment.refund_failed"
  | "payment.desk_capture"
  | "payment.orphaned"
  | "listing.submit"
  | "listing.review"
  | "listing.publish"
  | "listing.pause"
  | "listing.suspend"
  | "listing.archive"
  | "listing.verify_location"
  | "hotel.create"
  | "hotel.update"
  | "organization.create"
  | "organization.update"
  | "organization.suspend"
  | "organization.close"
  | "membership.invite"
  | "membership.update"
  | "membership.revoke"
  | "platform.support_access";

export type AuditActor = {
  /** Staff/admin user id. Guest principals have no users row, so this stays null. */
  userId?: string | null;
  guestId?: string | null;
};

/**
 * Audit completeness is observable: every failed write increments this counter
 * (exported for health checks/tests) instead of only reaching stdout (M3).
 */
let auditWriteFailures = 0;

export function auditFailureCount(): number {
  return auditWriteFailures;
}

export async function writeAuditLog(opts: {
  userId?: string | null;
  action: AuditAction;
  entityType: string;
  entityId: string;
  organizationId?: string | null;
  hotelId?: string | null;
  actorType?: "staff" | "guest" | "system" | "provider" | null;
  actorGuestId?: string | null;
  ipAddress?: string | null;
  purpose?: string | null;
  outcome?: "success" | "denied" | "failure" | null;
  oldValues?: Record<string, unknown> | null;
  newValues?: Record<string, unknown> | null;
}) {
  try {
    await prisma.auditLog.create({
      data: {
        userId: opts.userId ?? null,
        organizationId: opts.organizationId ?? null,
        hotelId: opts.hotelId ?? null,
        actorType:
          opts.actorType ??
          (opts.userId ? "staff" : opts.actorGuestId || opts.action.startsWith("auth.") ? "guest" : "system"),
        actorGuestId: opts.actorGuestId ?? null,
        ipAddress: opts.ipAddress ?? null,
        purpose: opts.purpose ?? null,
        outcome: opts.outcome ?? "success",
        action: opts.action,
        entityType: opts.entityType,
        entityId: opts.entityId,
        ...(opts.oldValues ? { oldValues: opts.oldValues as Prisma.InputJsonValue } : {}),
        ...(opts.newValues ? { newValues: opts.newValues as Prisma.InputJsonValue } : {}),
      },
    });
  } catch (err) {
    auditWriteFailures += 1;
    // Audit failures must never block the request they describe, but they are
    // counted so a silently degrading trail can be alerted on (NFR-019).
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

export type LoginFailureReason =
  | "invalid_credentials"
  | "rate_limited"
  | "invalid_token"
  | "email_missing"
  | "email_unverified"
  | "provider_not_allowed"
  | "account_disabled"
  | "signup_disabled"
  | "staff_account"
  | "identity_conflict";

export async function auditLoginFailed(
  kind: "staff" | "guest",
  email: string,
  reason: LoginFailureReason,
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
