import { NextResponse } from "next/server";
import { guardPlatformApi } from "@/server/auth/api";
import { getOrganizationKycDocument } from "@/server/onboarding/kyc";

/**
 * Platform-only stream of a business KYC document. Tenant roles can never read
 * another organization's evidence: the guard is the platform axis, not the
 * tenant permission map.
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await guardPlatformApi("/api/platform/organizations/[id]/kyc/document");
  if (auth instanceof NextResponse) return auth;

  const { id } = await params;
  const document = await getOrganizationKycDocument(id);
  if (!document) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  const encoded = encodeURIComponent(document.documentName || "kyc-document");
  const extension =
    {
      "application/pdf": "pdf",
      "image/png": "png",
      "image/jpeg": "jpg",
      "image/webp": "webp",
    }[document.documentMimeType] ?? "bin";
  const rawName = document.documentName || `kyc-document.${extension}`;
  const asciiName =
    rawName.replace(/[^\x20-\x7E]/g, "_").replace(/["\\\r\n]/g, "_").trim() ||
    `kyc-document.${extension}`;
  const fallbackName = /\.[a-z0-9]{1,5}$/i.test(asciiName)
    ? asciiName
    : `${asciiName}.${extension}`;

  return new NextResponse(new Uint8Array(document.documentData), {
    headers: {
      "content-type": document.documentMimeType,
      "content-disposition": `inline; filename="${fallbackName}"; filename*=UTF-8''${encoded}`,
      "cache-control": "private, no-store",
      "x-content-type-options": "nosniff",
    },
  });
}
