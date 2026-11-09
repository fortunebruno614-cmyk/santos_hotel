"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { getCurrentSession } from "@/server/auth/dal";
import { ACTIVE_HOTEL_COOKIE, requireTenantContext } from "@/server/auth/tenancy";
import { Permissions } from "@/server/auth/roles";
import { ConsoleError } from "@/server/console/errors";
import { createHotel, HotelCreateSchema } from "@/server/console/hotels";
import { transitionHotelPublication } from "@/server/platform/listings";

function text(form: FormData, key: string) {
  const value = form.get(key);
  return typeof value === "string" && value.trim() !== "" ? value.trim() : undefined;
}

export async function createTenantHotelAction(formData: FormData) {
  const session = await getCurrentSession();
  if (!session || session.kind !== "staff" || !session.userId) {
    redirect("/staff/login");
  }
  let member;
  try {
    member = await requireTenantContext(session, Permissions.MANAGE_HOTELS);
  } catch {
    redirect("/unauthorized");
  }

  const latitude = text(formData, "latitude");
  const longitude = text(formData, "longitude");
  const parsed = HotelCreateSchema.safeParse({
    name: text(formData, "name"),
    slug: text(formData, "slug"),
    description: text(formData, "description") ?? null,
    phone: text(formData, "phone") ?? null,
    email: text(formData, "email") ?? null,
    addressLine1: text(formData, "addressLine1") ?? null,
    addressLine2: text(formData, "addressLine2") ?? null,
    city: text(formData, "city") ?? null,
    postcode: text(formData, "postcode") ?? null,
    country: text(formData, "country") ?? null,
    timezone: text(formData, "timezone") ?? "Africa/Lagos",
    currency: (text(formData, "currency") ?? "NGN").toUpperCase(),
    latitude: latitude ? Number(latitude) : null,
    longitude: longitude ? Number(longitude) : null,
  });
  if (!parsed.success) {
    const first = Object.values(parsed.error.flatten().fieldErrors)[0]?.[0];
    redirect(`/admin/hotels/new?error=${encodeURIComponent(first ?? "invalid_body")}`);
  }

  let hotel;
  try {
    hotel = await createHotel(member.organizationId, parsed.data, {
      userId: session.userId,
    });
  } catch (error) {
    const code = error instanceof ConsoleError ? error.code : "internal";
    redirect(`/admin/hotels/new?error=${encodeURIComponent(code)}`);
  }

  const cookieStore = await cookies();
  cookieStore.set(ACTIVE_HOTEL_COOKIE, hotel.id, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 30,
  });
  revalidatePath("/admin");
  redirect("/admin?hotel=created");
}


/** Tenant submits a draft property for Santo marketplace review (REQ-014). */
export async function submitHotelForReviewAction(formData: FormData) {
  const session = await getCurrentSession();
  if (!session || session.kind !== "staff" || !session.userId) {
    redirect("/staff/login");
  }
  let member;
  try {
    member = await requireTenantContext(session, Permissions.MANAGE_HOTELS);
  } catch {
    redirect("/unauthorized");
  }
  const hotelId = String(formData.get("hotelId") ?? "");
  try {
    if (!member.orgWide && !member.hotelIds.includes(hotelId)) {
      redirect("/unauthorized");
    }
    await transitionHotelPublication(hotelId, "SUBMITTED", {
      userId: session.userId,
    });
  } catch (error) {
    const code = error instanceof ConsoleError ? error.code : "internal";
    redirect(`/admin/hotels?error=${encodeURIComponent(code)}`);
  }
  revalidatePath("/admin/hotels");
  redirect("/admin/hotels?submitted=1");
}
