import { NextResponse } from "next/server";
import {
  HotelSignupError,
  HotelSignupSchema,
  KYC_ACCEPTED_MIME_TYPES,
  KYC_MAX_DOCUMENT_BYTES,
  createHotelSignup,
} from "@/server/onboarding/hotel-signup";

/**
 * Public business onboarding endpoint.
 *
 * Accepts multipart/form-data (the KYC certificate is the only binary field),
 * creates the organization + owner + first draft property + KYC submission,
 * and tells the browser to continue at the staff sign-in page.
 */

function fail(error: string, status = 400) {
  return NextResponse.json({ error }, { status });
}

export async function POST(request: Request) {
  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return fail("invalid_body", 422);
  }

  // Honeypot: bots that fill every field are told nothing and create nothing.
  if (String(form.get("website") ?? "").trim() !== "") {
    return NextResponse.json({ ok: true, redirect: "/staff/login?registered=1" });
  }

  const parsed = HotelSignupSchema.safeParse({
    organizationName: form.get("organizationName") ?? undefined,
    organizationSlug: form.get("organizationSlug") ?? undefined,
    hotelName: form.get("hotelName") ?? undefined,
    hotelSlug: form.get("hotelSlug") ?? undefined,
    ownerName: form.get("ownerName") ?? undefined,
    email: form.get("email") ?? undefined,
    phone: form.get("phone") ?? undefined,
    city: form.get("city") ?? undefined,
    country: form.get("country") ?? undefined,
    password: form.get("password") ?? undefined,
    registrationNumber: form.get("registrationNumber") ?? undefined,
    documentType: form.get("documentType") ?? undefined,
  });

  if (!parsed.success) {
    return NextResponse.json(
      {
        error: "invalid_body",
        fields: parsed.error.flatten().fieldErrors,
      },
      { status: 422 },
    );
  }

  const file = form.get("document");
  if (!(file instanceof File) || file.size === 0) {
    return fail("document_required", 422);
  }
  if (file.size > KYC_MAX_DOCUMENT_BYTES) {
    return fail("document_too_large", 413);
  }
  if (!KYC_ACCEPTED_MIME_TYPES.includes(file.type as (typeof KYC_ACCEPTED_MIME_TYPES)[number])) {
    return fail("document_type_not_allowed", 415);
  }

  const data = new Uint8Array(await file.arrayBuffer());

  try {
    await createHotelSignup(parsed.data, {
      name: (file.name || "kyc-document").slice(0, 200),
      mimeType: file.type,
      size: data.byteLength,
      data,
    });
  } catch (error) {
    if (error instanceof HotelSignupError) {
      return NextResponse.json({ error: error.code }, { status: 409 });
    }
    console.error("hotel signup failed", error);
    return fail("internal", 500);
  }

  return NextResponse.json({ ok: true, redirect: "/staff/login?registered=1" });
}
