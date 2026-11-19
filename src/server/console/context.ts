import { redirect } from "next/navigation";
import {
  TenancyError,
  requireTenantPage,
  resolveActiveHotel,
} from "@/server/auth/tenancy";
import type { Permission } from "@/server/auth/roles";

/**
 * Page-level console context: an ACTIVE tenant membership plus the hotel the
 * operator selected. Every console page uses this instead of ambient lookups.
 *
 * A membership can be active while the organization has no hotel yet, or a
 * STAFF member has not been assigned a property. That is a configuration
 * problem, not a crash: send the operator to a clear explanation instead of
 * letting `resolveActiveHotel` throw through the admin layout.
 */
export async function getConsoleContext(permission?: Permission) {
  const { session, member } = await requireTenantPage(permission);
  try {
    const hotel = await resolveActiveHotel(member);
    return { session, member, hotel };
  } catch (error) {
    if (error instanceof TenancyError && error.code === "not_found") {
      redirect("/unauthorized?reason=no-property");
    }
    throw error;
  }
}
