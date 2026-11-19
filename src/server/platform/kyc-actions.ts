"use server";

import { revalidatePath } from "next/cache";
import { PlatformPermissions } from "@/server/auth/roles";
import { requirePlatformPage } from "@/server/auth/tenancy";
import { reviewOrganizationKyc } from "@/server/onboarding/kyc";

/** Platform review decision for a business KYC submission. */
export async function reviewKycAction(formData: FormData) {
  const { session } = await requirePlatformPage(PlatformPermissions.REVIEW_LISTINGS);

  const organizationId = String(formData.get("organizationId") ?? "").trim();
  if (!organizationId) return;

  const decision = formData.get("decision") === "APPROVED" ? "APPROVED" : "REJECTED";
  const rawNote = formData.get("note");
  const note = typeof rawNote === "string" ? rawNote.trim().slice(0, 500) : null;

  await reviewOrganizationKyc({
    organizationId,
    decision,
    note,
    reviewerId: session.userId!,
  });

  revalidatePath("/platform");
  revalidatePath(`/platform/organizations/${organizationId}`);
}
