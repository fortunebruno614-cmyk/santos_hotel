import type { CurrentSession } from "@/server/auth/dal";
import type { TenantMember } from "@/server/auth/tenancy";
import type { StaffActor } from "@/server/booking/service";

/** Builds the tenant-scoped staff principal the services enforce against. */
export function staffActor(session: CurrentSession, member: TenantMember): StaffActor {
  return {
    kind: "staff",
    userId: session.userId!,
    email: session.email ?? null,
    organizationId: member.organizationId,
    organizationWide: member.orgWide,
    hotelIds: member.orgWide ? undefined : member.hotelIds,
  };
}
