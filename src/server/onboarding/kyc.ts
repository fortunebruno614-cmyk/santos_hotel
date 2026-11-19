import { prisma } from "@/lib/prisma";
import { writeAuditLog } from "@/server/audit/write";

/**
 * Business verification reads/writes. The document bytes stay out of normal
 * page queries — only the guarded platform download route streams them.
 */

export type KycSummary = {
  id: string;
  legalName: string;
  registrationNumber: string | null;
  documentType: string;
  documentName: string;
  documentMimeType: string;
  documentSize: number;
  status: string;
  reviewNote: string | null;
  submittedAt: string;
  reviewedAt: string | null;
  reviewedByName: string | null;
};

export type KycDecision = "APPROVED" | "REJECTED";

function toSummary(row: {
  id: string;
  legalName: string;
  registrationNumber: string | null;
  documentType: string;
  documentName: string;
  documentMimeType: string;
  documentSize: number;
  status: string;
  reviewNote: string | null;
  submittedAt: Date;
  reviewedAt: Date | null;
  reviewedBy: { name: string } | null;
}): KycSummary {
  return {
    id: row.id,
    legalName: row.legalName,
    registrationNumber: row.registrationNumber,
    documentType: row.documentType,
    documentName: row.documentName,
    documentMimeType: row.documentMimeType,
    documentSize: row.documentSize,
    status: row.status,
    reviewNote: row.reviewNote,
    submittedAt: row.submittedAt.toISOString(),
    reviewedAt: row.reviewedAt ? row.reviewedAt.toISOString() : null,
    reviewedByName: row.reviewedBy?.name ?? null,
  };
}

export async function getOrganizationKycSummary(
  organizationId: string,
): Promise<KycSummary | null> {
  const row = await prisma.organizationKyc.findUnique({
    where: { organizationId },
    select: {
      id: true,
      legalName: true,
      registrationNumber: true,
      documentType: true,
      documentName: true,
      documentMimeType: true,
      documentSize: true,
      status: true,
      reviewNote: true,
      submittedAt: true,
      reviewedAt: true,
      reviewedBy: { select: { name: true } },
    },
  });
  return row ? toSummary(row) : null;
}

export async function getOrganizationKycDocument(organizationId: string) {
  return prisma.organizationKyc.findUnique({
    where: { organizationId },
    select: {
      documentName: true,
      documentMimeType: true,
      documentData: true,
    },
  });
}

export async function listPendingKycSubmissions(take = 8) {
  const rows = await prisma.organizationKyc.findMany({
    where: { status: "PENDING" },
    orderBy: { submittedAt: "asc" },
    take,
    include: { organization: { select: { id: true, name: true, slug: true } } },
  });
  return rows.map((row) => ({
    organizationId: row.organizationId,
    organizationName: row.organization.name,
    organizationSlug: row.organization.slug,
    legalName: row.legalName,
    documentName: row.documentName,
    submittedAt: row.submittedAt.toISOString(),
  }));
}

export async function reviewOrganizationKyc(input: {
  organizationId: string;
  decision: KycDecision;
  note?: string | null;
  reviewerId: string;
}) {
  const current = await prisma.organizationKyc.findUnique({
    where: { organizationId: input.organizationId },
  });
  if (!current) return null;

  const updated = await prisma.organizationKyc.update({
    where: { organizationId: input.organizationId },
    data: {
      status: input.decision,
      reviewNote: input.note?.trim() || null,
      reviewedAt: new Date(),
      reviewedById: input.reviewerId,
    },
  });

  await writeAuditLog({
    userId: input.reviewerId,
    organizationId: input.organizationId,
    action: "organization.kyc_review",
    entityType: "organization_kyc",
    entityId: updated.id,
    oldValues: { status: current.status },
    newValues: { status: updated.status, note: updated.reviewNote },
  });

  return updated;
}
