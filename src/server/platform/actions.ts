"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { getCurrentSession } from "@/server/auth/dal";
import { requirePlatform, TenancyError } from "@/server/auth/tenancy";
import { setSessionCookie } from "@/server/auth/service";
import { ConsoleError } from "@/server/console/errors";
import {
  createFirstPlatformAdmin,
  PlatformAdminCreateSchema,
} from "@/server/platform/admins";
import {
  createOrganizationWithOwner,
  setOrganizationStatus,
} from "@/server/platform/organizations";
import {
  transitionHotelPublication,
  verifyHotelLocation,
} from "@/server/platform/listings";
import { createHotel, HotelCreateSchema } from "@/server/console/hotels";
import type { PropertyPublicationStatus } from "@/generated/prisma/client";
import { z } from "zod";

function failure(path: string, error: unknown): never {
  const code =
    error instanceof ConsoleError
      ? error.code
      : error instanceof TenancyError
        ? error.code
        : "internal";
  redirect(`${path}?error=${encodeURIComponent(code)}`);
}

async function platformActor() {
  const session = await getCurrentSession();
  if (!session || session.kind !== "staff" || !session.userId) {
    redirect("/platform/login");
  }
  try {
    await requirePlatform(session);
  } catch {
    redirect("/platform/login?error=forbidden");
  }
  return { userId: session.userId };
}

function text(form: FormData, key: string) {
  const value = form.get(key);
  return typeof value === "string" && value.trim() !== "" ? value.trim() : undefined;
}

function hotelInputFromForm(form: FormData) {
  const latitude = text(form, "latitude");
  const longitude = text(form, "longitude");
  return HotelCreateSchema.parse({
    name: text(form, "hotelName"),
    slug: text(form, "hotelSlug"),
    description: text(form, "hotelDescription") ?? null,
    phone: text(form, "hotelPhone") ?? null,
    email: text(form, "hotelEmail") ?? null,
    addressLine1: text(form, "addressLine1") ?? null,
    addressLine2: text(form, "addressLine2") ?? null,
    city: text(form, "city") ?? null,
    postcode: text(form, "postcode") ?? null,
    country: text(form, "country") ?? null,
    timezone: text(form, "timezone") ?? "Africa/Lagos",
    currency: (text(form, "currency") ?? "NGN").toUpperCase(),
    latitude: latitude ? Number(latitude) : null,
    longitude: longitude ? Number(longitude) : null,
  });
}

export async function setupPlatformAction(formData: FormData) {
  const parsed = PlatformAdminCreateSchema.safeParse({
    name: text(formData, "name"),
    email: text(formData, "email"),
    password: text(formData, "password"),
  });
  if (!parsed.success) redirect("/platform/setup?error=invalid_body");

  let user;
  try {
    user = await createFirstPlatformAdmin(parsed.data);
  } catch (error) {
    failure("/platform/setup", error);
  }

  await setSessionCookie({
    kind: "staff",
    role: "ADMIN",
    userId: user.id,
    email: user.email,
    platformRole: "ADMIN",
  });
  redirect("/platform");
}

export async function createOrganizationAction(formData: FormData) {
  const actor = await platformActor();
  const parsed = z
    .object({
      organizationName: z.string().trim().min(2).max(120),
      organizationSlug: z
        .string()
        .trim()
        .min(2)
        .max(80)
        .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
      organizationEmail: z.string().trim().toLowerCase().email().max(200).optional(),
      organizationPhone: z.string().trim().max(40).optional(),
      organizationCountry: z.string().trim().max(100).optional(),
      ownerName: z.string().trim().min(2).max(80),
      ownerEmail: z.string().trim().toLowerCase().email().max(200),
      ownerPassword: z.string().min(8).max(200),
    })
    .safeParse({
      organizationName: text(formData, "organizationName"),
      organizationSlug: text(formData, "organizationSlug"),
      organizationEmail: text(formData, "organizationEmail"),
      organizationPhone: text(formData, "organizationPhone"),
      organizationCountry: text(formData, "organizationCountry"),
      ownerName: text(formData, "ownerName"),
      ownerEmail: text(formData, "ownerEmail"),
      ownerPassword: formData.get("ownerPassword"),
    });
  if (!parsed.success) {
    redirect("/platform/organizations/new?error=invalid_body");
  }

  try {
    const hotel = hotelInputFromForm(formData);
    await createOrganizationWithOwner(
      {
        organization: {
          name: parsed.data.organizationName,
          slug: parsed.data.organizationSlug,
          email: parsed.data.organizationEmail ?? null,
          phone: parsed.data.organizationPhone ?? null,
          country: parsed.data.organizationCountry ?? null,
        },
        owner: {
          name: parsed.data.ownerName,
          email: parsed.data.ownerEmail,
          password: parsed.data.ownerPassword,
        },
        hotel,
      },
      actor,
    );
  } catch (error) {
    failure("/platform/organizations/new", error);
  }

  revalidatePath("/platform");
  redirect("/platform?created=1");
}

export async function createHotelForOrganizationAction(formData: FormData) {
  const actor = await platformActor();
  const organizationId = text(formData, "organizationId");
  if (!organizationId) redirect("/platform?error=invalid_body");
  try {
    await createHotel(organizationId, hotelInputFromForm(formData), {
      userId: actor.userId,
      platform: true,
    });
  } catch (error) {
    failure(`/platform/organizations/${organizationId}`, error);
  }
  revalidatePath(`/platform/organizations/${organizationId}`);
  redirect(`/platform/organizations/${organizationId}?created=1`);
}

export async function transitionPublicationAction(formData: FormData) {
  const actor = await platformActor();
  const hotelId = text(formData, "hotelId");
  const to = text(formData, "to") as PropertyPublicationStatus | undefined;
  const reason = text(formData, "reason");
  if (!hotelId || !to) redirect("/platform?error=invalid_body");
  try {
    await transitionHotelPublication(hotelId, to, actor, reason ?? null);
  } catch (error) {
    failure(`/platform/hotels/${hotelId}`, error);
  }
  revalidatePath("/platform");
  revalidatePath(`/platform/hotels/${hotelId}`);
  redirect(`/platform/hotels/${hotelId}`);
}

export async function verifyLocationAction(formData: FormData) {
  const actor = await platformActor();
  const hotelId = text(formData, "hotelId");
  const latitude = text(formData, "latitude");
  const longitude = text(formData, "longitude");
  const precision = (text(formData, "precision") ?? "EXACT") as
    | "APPROXIMATE"
    | "NEIGHBORHOOD"
    | "EXACT";
  if (!hotelId || !latitude || !longitude) {
    redirect(`/platform/hotels/${hotelId ?? ""}?error=invalid_body`);
  }
  try {
    await verifyHotelLocation(
      hotelId,
      { latitude: Number(latitude), longitude: Number(longitude), precision },
      actor,
    );
  } catch (error) {
    failure(`/platform/hotels/${hotelId}`, error);
  }
  revalidatePath(`/platform/hotels/${hotelId}`);
  redirect(`/platform/hotels/${hotelId}?verified=1`);
}

export async function setOrganizationStatusAction(formData: FormData) {
  const actor = await platformActor();
  const organizationId = text(formData, "organizationId");
  const status = text(formData, "status") as "ACTIVE" | "SUSPENDED" | "CLOSED" | undefined;
  if (!organizationId || !status) redirect("/platform?error=invalid_body");
  try {
    await setOrganizationStatus(organizationId, status, actor);
  } catch (error) {
    failure(`/platform/organizations/${organizationId}`, error);
  }
  revalidatePath("/platform");
  revalidatePath(`/platform/organizations/${organizationId}`);
  redirect(`/platform/organizations/${organizationId}`);
}
