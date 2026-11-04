import { cache } from "react";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import {
  AppRole,
  hasOrgPermission,
  hasPlatformPermission,
  permissionsForOrgRole,
  type Permission,
  type PlatformPermission,
} from "@/server/auth/roles";
import { getCurrentSession, type CurrentSession } from "@/server/auth/dal";
import type { Prisma } from "@/generated/prisma/client";
import type {
  MemberStatus,
  OrganizationRole,
  OrganizationStatus,
  PlatformRole,
} from "@/generated/prisma/enums";

/**
 * Tenant context resolution (M3).
 *
 * Two rules are non-negotiable:
 *   1. Tenant identity always comes from the database, never from a URL, body,
 *      header or email domain (MRD business rule 11).
 *   2. A missing context is an error, never "all rows" (MRD business rule 12).
 *
 * A staff session carries only the selected `orgId`; the membership, its status
 * and the hotel scope are re-read on every request. A seven-day token therefore
 * cannot outlive a revoked membership.
 */

export const ACTIVE_HOTEL_COOKIE = "active_hotel";

export type TenancyErrorCode = "unauthenticated" | "forbidden" | "not_found";

export class TenancyError extends Error {
  readonly code: TenancyErrorCode;
  constructor(code: TenancyErrorCode, message: string = code) {
    super(message);
    this.name = "TenancyError";
    this.code = code;
  }
}

export type TenantMember = {
  id: string;
  organizationId: string;
  userId: string;
  role: OrganizationRole;
  status: MemberStatus;
  organization: {
    id: string;
    name: string;
    slug: string;
    status: OrganizationStatus;
  };
  /** Explicit property scope for STAFF members; empty for OWNER/MANAGER. */
  hotelIds: string[];
  /** OWNER and MANAGER implicitly cover every hotel in the organization. */
  orgWide: boolean;
  permissions: Permission[];
};

const MEMBER_INCLUDE = {
  organization: { select: { id: true, name: true, slug: true, status: true } },
  hotels: { select: { hotelId: true } },
} as const;

type MemberRow = Prisma.OrganizationMemberGetPayload<{ include: typeof MEMBER_INCLUDE }>;

function toTenantMember(row: MemberRow): TenantMember {
  const orgWide = row.role === "OWNER" || row.role === "MANAGER";
  return {
    id: row.id,
    organizationId: row.organizationId,
    userId: row.userId,
    role: row.role,
    status: row.status,
    organization: row.organization,
    hotelIds: row.hotels.map((hotel) => hotel.hotelId),
    orgWide,
    permissions: permissionsForOrgRole(row.role),
  };
}

/**
 * Loads the active membership for a staff user. When `orgId` is supplied it is
 * honoured only if the user really is an ACTIVE member of that organization.
 */
export async function loadTenantMember(
  userId: string,
  orgId?: string | null,
): Promise<TenantMember | null> {
  const rows = await prisma.organizationMember.findMany({
    where: {
      userId,
      status: "ACTIVE",
      organization: { status: "ACTIVE" },
    },
    include: MEMBER_INCLUDE,
    orderBy: { createdAt: "asc" },
  });
  const row = orgId ? rows.find((entry) => entry.organizationId === orgId) : rows[0];
  return row ? toTenantMember(row) : null;
}

/** Page-level tenant context; null when the signed-in user is not a member. */
export const getTenantContext = cache(async (): Promise<TenantMember | null> => {
  const session = await getCurrentSession();
  if (!session || session.kind !== "staff" || !session.userId) return null;
  if (session.role === AppRole.GUEST) return null;
  return loadTenantMember(session.userId, session.orgId);
});

/** API-level guard: authenticate + membership + permission, deny by default. */
export async function requireTenantContext(
  session: CurrentSession | null,
  permission?: Permission,
): Promise<TenantMember> {
  if (!session || session.kind !== "staff" || !session.userId) {
    throw new TenancyError("unauthenticated");
  }
  const member = await loadTenantMember(session.userId, session.orgId);
  if (!member) throw new TenancyError("forbidden", "no active organization membership");
  if (permission && !hasOrgPermission(member.role, permission)) {
    throw new TenancyError("forbidden", "permission_denied");
  }
  return member;
}

function canAccessHotel(member: TenantMember, hotelId: string): boolean {
  return member.orgWide || member.hotelIds.includes(hotelId);
}

/**
 * Asserts that a hotel belongs to the member's organization and that the member
 * is scoped to it. Outside the organization, the answer is `not_found` — never
 * `forbidden` — so resource existence is not disclosed.
 */
export async function assertHotelAccess(
  member: TenantMember,
  hotelId: string,
  permission?: Permission,
): Promise<{ id: string; organizationId: string; name: string; slug: string }> {
  if (permission && !hasOrgPermission(member.role, permission)) {
    throw new TenancyError("forbidden", "permission_denied");
  }
  const hotel = await prisma.hotel.findFirst({
    where: { id: hotelId, organizationId: member.organizationId },
    select: { id: true, organizationId: true, name: true, slug: true },
  });
  if (!hotel || !canAccessHotel(member, hotel.id)) {
    throw new TenancyError("not_found", "hotel not found");
  }
  return hotel;
}

/** Every hotel the member may administer, in a stable order. */
export async function accessibleHotels(member: TenantMember) {
  return prisma.hotel.findMany({
    where: {
      organizationId: member.organizationId,
      ...(member.orgWide ? {} : { id: { in: member.hotelIds } }),
    },
    orderBy: { createdAt: "asc" },
    select: { id: true, name: true, slug: true, publicationStatus: true, currency: true },
  });
}

/**
 * Resolves the hotel a page/API list is acting on: the signed `active_hotel`
 * cookie when it is in scope, otherwise the first accessible hotel. This is
 * only for surfaces that are not addressed by a concrete resource id.
 */
export async function resolveActiveHotel(member: TenantMember) {
  const hotels = await accessibleHotels(member);
  if (hotels.length === 0) {
    throw new TenancyError("not_found", "no accessible hotel");
  }
  const cookieStore = await cookies();
  const selected = cookieStore.get(ACTIVE_HOTEL_COOKIE)?.value;
  return hotels.find((hotel) => hotel.id === selected) ?? hotels[0];
}

/**
 * Convenience for API handlers: resolve the membership, then the concrete
 * hotel (explicit resource id when supplied, otherwise the active hotel
 * cookie), and verify property scope. Throws `TenancyError` on any failure.
 */
export async function tenantHotelFor(
  session: CurrentSession | null,
  permission: Permission | undefined,
  resolveHotelId?: () => Promise<string>,
): Promise<{ member: TenantMember; hotelId: string }> {
  const member = await requireTenantContext(session, permission);
  const hotelId = resolveHotelId
    ? await resolveHotelId()
    : (await resolveActiveHotel(member)).id;
  await assertHotelAccess(member, hotelId, permission);
  return { member, hotelId };
}

/** Page guard: require an active tenant membership (and optionally a permission). */
export async function requireTenantPage(permission?: Permission): Promise<{
  session: CurrentSession;
  member: TenantMember;
}> {
  const session = await getCurrentSession();
  if (!session) redirect("/login");
  if (session.kind !== "staff") redirect("/unauthorized");
  const member = await loadTenantMember(session.userId!, session.orgId);
  if (!member) redirect("/unauthorized");
  if (permission && !hasOrgPermission(member.role, permission)) redirect("/unauthorized");
  return { session, member };
}

/** Memberships for the organization switcher (all statuses, active first). */
export async function listUserMemberships(userId: string) {
  return prisma.organizationMember.findMany({
    where: { userId, status: "ACTIVE", organization: { status: "ACTIVE" } },
    orderBy: { createdAt: "asc" },
    include: { organization: { select: { id: true, name: true, slug: true } } },
  });
}

/** Page guard for the Santo platform console. */
export async function requirePlatformPage(permission?: PlatformPermission): Promise<{
  session: CurrentSession;
  platformRole: PlatformRole;
}> {
  const session = await getCurrentSession();
  if (!session) redirect("/login");
  if (session.kind !== "staff" || !session.userId) redirect("/unauthorized");
  const user = await prisma.user.findUnique({
    where: { id: session.userId },
    select: { platformRole: true, isActive: true },
  });
  if (!user?.isActive || !user.platformRole) redirect("/unauthorized");
  if (permission && !hasPlatformPermission(user.platformRole, permission)) {
    redirect("/unauthorized");
  }
  return { session, platformRole: user.platformRole };
}

/** API-level platform guard, separate from tenant permissions (REQ-026). */
export async function requirePlatform(
  session: CurrentSession | null,
  permission?: PlatformPermission,
): Promise<PlatformRole> {
  if (!session || session.kind !== "staff" || !session.userId) {
    throw new TenancyError("unauthenticated");
  }
  const user = await prisma.user.findUnique({
    where: { id: session.userId },
    select: { platformRole: true, isActive: true },
  });
  if (!user?.isActive || !user.platformRole) {
    throw new TenancyError("forbidden", "not_a_platform_operator");
  }
  if (permission && !hasPlatformPermission(user.platformRole, permission)) {
    throw new TenancyError("forbidden", "permission_denied");
  }
  return user.platformRole;
}

// ---------------------------------------------------------------------------
// Resource -> hotel resolution (the only sanctioned way to derive context)
// ---------------------------------------------------------------------------

export async function hotelOfRoom(roomId: string): Promise<string> {
  const room = await prisma.room.findUnique({
    where: { id: roomId },
    select: { hotelId: true, roomType: { select: { hotelId: true } } },
  });
  const hotelId = room?.hotelId ?? room?.roomType.hotelId;
  if (!hotelId) throw new TenancyError("not_found", "room not found");
  return hotelId;
}

export async function hotelOfRoomType(roomTypeId: string): Promise<string> {
  const roomType = await prisma.roomType.findUnique({
    where: { id: roomTypeId },
    select: { hotelId: true },
  });
  if (!roomType) throw new TenancyError("not_found", "room type not found");
  return roomType.hotelId;
}

export async function hotelOfRate(rateId: string): Promise<string> {
  const rate = await prisma.rate.findUnique({
    where: { id: rateId },
    select: { roomType: { select: { hotelId: true } } },
  });
  const hotelId = rate?.roomType.hotelId;
  if (!hotelId) throw new TenancyError("not_found", "rate not found");
  return hotelId;
}

export async function hotelOfPromotion(promotionId: string): Promise<string> {
  const promotion = await prisma.promotion.findUnique({
    where: { id: promotionId },
    select: { hotelId: true },
  });
  if (!promotion?.hotelId) throw new TenancyError("not_found", "promotion not found");
  return promotion.hotelId;
}

export async function hotelOfBooking(bookingId: string): Promise<string> {
  const booking = await prisma.booking.findUnique({
    where: { id: bookingId },
    select: { hotelId: true },
  });
  if (!booking?.hotelId) throw new TenancyError("not_found", "reservation not found");
  return booking.hotelId;
}

export async function hotelOfPayment(paymentId: string): Promise<string> {
  const payment = await prisma.payment.findUnique({
    where: { id: paymentId },
    select: { hotelId: true, booking: { select: { hotelId: true } } },
  });
  const hotelId = payment?.hotelId ?? payment?.booking.hotelId;
  if (!hotelId) throw new TenancyError("not_found", "payment not found");
  return hotelId;
}

/** True when a guest has at least one reservation at the given hotel. */
export async function guestBelongsToHotel(guestId: string, hotelId: string): Promise<boolean> {
  const count = await prisma.booking.count({ where: { guestId, hotelId } });
  return count > 0;
}
