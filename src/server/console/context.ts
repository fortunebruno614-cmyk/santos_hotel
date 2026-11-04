import { requireTenantPage } from "@/server/auth/tenancy";
import { resolveActiveHotel } from "@/server/auth/tenancy";
import type { Permission } from "@/server/auth/roles";

/**
 * Page-level console context: an ACTIVE tenant membership plus the hotel the
 * operator selected. Every console page uses this instead of ambient lookups.
 */
export async function getConsoleContext(permission?: Permission) {
  const { session, member } = await requireTenantPage(permission);
  const hotel = await resolveActiveHotel(member);
  return { session, member, hotel };
}
