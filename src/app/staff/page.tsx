import { redirect } from "next/navigation";
import { getCurrentSession } from "@/server/auth/dal";
import { loadTenantMember } from "@/server/auth/tenancy";

/**
 * `/staff` is a convenience entry point, not a screen. Signed-in tenant staff
 * continue to the console; everyone else lands on the staff sign-in page so the
 * bare URL never answers 404.
 */
export default async function StaffEntryPage() {
  const session = await getCurrentSession();
  if (session?.kind === "staff" && session.userId) {
    const member = await loadTenantMember(session.userId, session.orgId);
    if (member) redirect("/admin");
  }
  redirect("/staff/login");
}
