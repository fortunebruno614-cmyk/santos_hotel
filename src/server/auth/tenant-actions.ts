"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { getCurrentSession } from "@/server/auth/dal";
import { setSessionCookie } from "@/server/auth/service";
import {
  ACTIVE_HOTEL_COOKIE,
  assertHotelAccess,
  loadTenantMember,
} from "@/server/auth/tenancy";

/**
 * Context selectors. Both verify against the database before changing anything:
 * a client-supplied organization or hotel id is only ever a *request* to switch,
 * never proof of access.
 */

export async function switchOrganization(formData: FormData) {
  const session = await getCurrentSession();
  if (!session || session.kind !== "staff" || !session.userId) {
    redirect("/login");
  }
  const orgId = String(formData.get("orgId") ?? "");
  const member = await loadTenantMember(session.userId, orgId);
  if (!member || member.organizationId !== orgId) redirect("/unauthorized");

  const cookieStore = await cookies();
  cookieStore.delete(ACTIVE_HOTEL_COOKIE);
  await setSessionCookie({
    kind: "staff",
    role: session.role,
    userId: session.userId,
    email: session.email ?? undefined,
    orgId,
    platformRole: session.platformRole ?? undefined,
  });
  revalidatePath("/admin");
  redirect("/admin");
}

export async function switchHotel(formData: FormData) {
  const session = await getCurrentSession();
  if (!session || session.kind !== "staff" || !session.userId) {
    redirect("/login");
  }
  const member = await loadTenantMember(session.userId, session.orgId);
  if (!member) redirect("/unauthorized");
  const hotelId = String(formData.get("hotelId") ?? "");
  await assertHotelAccess(member, hotelId);

  const cookieStore = await cookies();
  cookieStore.set(ACTIVE_HOTEL_COOKIE, hotelId, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 30,
  });
  const next = String(formData.get("next") ?? "/admin");
  revalidatePath("/admin");
  redirect(next.startsWith("/") ? next : "/admin");
}
