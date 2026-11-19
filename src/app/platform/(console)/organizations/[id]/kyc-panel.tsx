import { Download, ExternalLink } from "lucide-react";
import {
  Panel,
  PanelBody,
  PanelHeader,
  StatusPill,
  formatDate,
} from "@/components/platform/ui";
import { reviewKycAction } from "@/server/platform/kyc-actions";
import type { KycSummary } from "@/server/onboarding/kyc";

const DOCUMENT_TYPE_LABELS: Record<string, string> = {
  CAC_CERTIFICATE: "CAC certificate",
  BUSINESS_LICENSE: "Business licence",
  TAX_CERTIFICATE: "Tax certificate",
  OTHER: "Other ownership evidence",
};

/** Platform review panel for one business's KYC submission. */
export function KycPanel({
  organizationId,
  kyc,
}: {
  organizationId: string;
  kyc: KycSummary | null;
}) {
  const documentUrl = `/api/platform/organizations/${organizationId}/kyc/document`;

  return (
    <Panel>
      <PanelHeader
        title="Business verification"
        description="KYC evidence submitted by the business. Review it before approving the organization."
        actions={
          kyc ? (
            <StatusPill
              status={kyc.status}
              label={
                kyc.status === "APPROVED"
                  ? "Verified"
                  : kyc.status === "REJECTED"
                    ? "Rejected"
                    : "Pending review"
              }
            />
          ) : undefined
        }
      />
      <PanelBody className="space-y-4">
        {kyc ? (
          <>
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="text-sm font-semibold text-slate-100">{kyc.legalName}</p>
                <p className="text-[0.7rem] text-slate-500">
                  Submitted {formatDate(kyc.submittedAt)}
                  {kyc.reviewedAt ? ` · reviewed ${formatDate(kyc.reviewedAt)}` : ""}
                  {kyc.reviewedByName ? ` by ${kyc.reviewedByName}` : ""}
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <a href={documentUrl} target="_blank" rel="noreferrer" className="p-btn">
                  <ExternalLink className="size-3.5" /> Open evidence
                </a>
                <a href={documentUrl} download className="p-btn">
                  <Download className="size-3.5" /> Download
                </a>
              </div>
            </div>

            <dl className="grid gap-3 text-xs sm:grid-cols-2 lg:grid-cols-4">
              <div>
                <dt className="font-medium uppercase tracking-[0.1em] text-slate-500">
                  Registration
                </dt>
                <dd className="mt-1 font-mono text-slate-200">
                  {kyc.registrationNumber ?? "—"}
                </dd>
              </div>
              <div>
                <dt className="font-medium uppercase tracking-[0.1em] text-slate-500">Document</dt>
                <dd className="mt-1 text-slate-200">
                  {DOCUMENT_TYPE_LABELS[kyc.documentType] ?? kyc.documentType}
                </dd>
              </div>
              <div className="sm:col-span-2">
                <dt className="font-medium uppercase tracking-[0.1em] text-slate-500">File</dt>
                <dd className="mt-1 text-slate-200">
                  {kyc.documentName}
                  <span className="ml-2 text-[0.65rem] text-slate-500">
                    {Math.max(1, Math.round(kyc.documentSize / 1024))} KB
                  </span>
                </dd>
              </div>
            </dl>

            {kyc.documentMimeType.startsWith("image/") ? (
              <a
                href={documentUrl}
                target="_blank"
                rel="noreferrer"
                className="block overflow-hidden rounded-xl border border-white/[0.08] bg-[#0b1220]"
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={documentUrl}
                  alt={`KYC evidence — ${kyc.documentName}`}
                  className="max-h-[460px] w-full object-contain"
                />
              </a>
            ) : kyc.documentMimeType === "application/pdf" ? (
              <iframe
                src={documentUrl}
                title={`KYC evidence — ${kyc.documentName}`}
                className="h-[460px] w-full rounded-xl border border-white/[0.08] bg-[#0b1220]"
              />
            ) : null}

            {kyc.reviewNote && (
              <p className="rounded-lg border border-white/[0.07] bg-white/[0.025] px-3 py-2 text-xs leading-5 text-slate-400">
                <span className="font-medium text-slate-200">Review note:</span> {kyc.reviewNote}
              </p>
            )}

            <form
              action={reviewKycAction}
              className="grid gap-2 border-t border-white/[0.06] pt-4 sm:grid-cols-[1fr_auto_auto]"
            >
              <input type="hidden" name="organizationId" value={organizationId} />
              <input
                name="note"
                placeholder="Review note (required when rejecting)"
                maxLength={500}
                className="h-9 text-xs"
              />
              <button type="submit" name="decision" value="APPROVED" className="p-btn p-btn-primary">
                Approve
              </button>
              <button
                type="submit"
                name="decision"
                value="REJECTED"
                className="p-btn p-btn-danger"
              >
                Reject
              </button>
            </form>
          </>
        ) : (
          <p className="text-sm text-slate-400">
            This business has no verification document on file yet. The owner can contact Santo
            support to submit one.
          </p>
        )}
      </PanelBody>
    </Panel>
  );
}
