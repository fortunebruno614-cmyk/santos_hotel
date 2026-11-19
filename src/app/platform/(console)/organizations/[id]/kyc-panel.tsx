import { StatusBadge } from "@/components/admin/ui";
import { Button } from "@/components/ui/button";
import { reviewKycAction } from "@/server/platform/kyc-actions";
import type { KycSummary } from "@/server/onboarding/kyc";

const DOCUMENT_TYPE_LABELS: Record<string, string> = {
  CAC_CERTIFICATE: "CAC certificate",
  BUSINESS_LICENSE: "Business licence",
  TAX_CERTIFICATE: "Tax certificate",
  OTHER: "Other ownership evidence",
};

const STATUS_LABELS: Record<string, string> = {
  PENDING: "Pending review",
  APPROVED: "Verified",
  REJECTED: "Rejected",
};

/** Platform review panel for one business's KYC submission. */
export function KycPanel({
  organizationId,
  kyc,
}: {
  organizationId: string;
  kyc: KycSummary | null;
}) {
  return (
    <section className="space-y-4 rounded-xl border border-border bg-card p-5 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-[0.7rem] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
            Business verification
          </p>
          <h2 className="mt-1 text-lg font-semibold text-foreground">
            {kyc ? kyc.legalName : "No KYC submitted"}
          </h2>
          {kyc && (
            <p className="text-xs text-muted-foreground">
              Submitted {kyc.submittedAt.slice(0, 10)}
              {kyc.reviewedAt ? ` · reviewed ${kyc.reviewedAt.slice(0, 10)}` : ""}
              {kyc.reviewedByName ? ` by ${kyc.reviewedByName}` : ""}
            </p>
          )}
        </div>
        {kyc && <StatusBadge status={kyc.status} label={STATUS_LABELS[kyc.status] ?? kyc.status} />}
      </div>

      {kyc ? (
        <>
          <dl className="grid gap-3 text-sm sm:grid-cols-2 lg:grid-cols-4">
            <div>
              <dt className="text-xs font-medium text-muted-foreground">Registration number</dt>
              <dd className="mt-0.5 font-medium">{kyc.registrationNumber ?? "—"}</dd>
            </div>
            <div>
              <dt className="text-xs font-medium text-muted-foreground">Document type</dt>
              <dd className="mt-0.5 font-medium">
                {DOCUMENT_TYPE_LABELS[kyc.documentType] ?? kyc.documentType}
              </dd>
            </div>
            <div className="sm:col-span-2">
              <dt className="text-xs font-medium text-muted-foreground">Evidence</dt>
              <dd className="mt-0.5">
                <a
                  href={`/api/platform/organizations/${organizationId}/kyc/document`}
                  target="_blank"
                  rel="noreferrer"
                  className="font-medium text-primary underline-offset-4 hover:underline"
                >
                  {kyc.documentName}
                </a>
                <span className="ml-2 text-xs text-muted-foreground">
                  {Math.max(1, Math.round(kyc.documentSize / 1024))} KB
                </span>
                <a
                  href={`/api/platform/organizations/${organizationId}/kyc/document`}
                  download
                  className="ml-2 text-xs font-medium text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
                >
                  Download
                </a>
              </dd>
            </div>
          </dl>

          {kyc.documentMimeType.startsWith("image/") ? (
            <a
              href={`/api/platform/organizations/${organizationId}/kyc/document`}
              target="_blank"
              rel="noreferrer"
              className="block overflow-hidden rounded-xl border border-border bg-white"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={`/api/platform/organizations/${organizationId}/kyc/document`}
                alt={`KYC evidence — ${kyc.documentName}`}
                className="max-h-[460px] w-full object-contain"
              />
            </a>
          ) : kyc.documentMimeType === "application/pdf" ? (
            <iframe
              src={`/api/platform/organizations/${organizationId}/kyc/document`}
              title={`KYC evidence — ${kyc.documentName}`}
              className="h-[460px] w-full rounded-xl border border-border bg-white"
            />
          ) : null}

          {kyc.reviewNote && (
            <p className="rounded-lg border border-border bg-muted/40 px-3 py-2 text-xs leading-5">
              <span className="font-medium">Review note:</span> {kyc.reviewNote}
            </p>
          )}

          <form
            action={reviewKycAction}
            className="grid gap-2 border-t border-border pt-4 sm:grid-cols-[1fr_auto_auto]"
          >
            <input type="hidden" name="organizationId" value={organizationId} />
            <input
              name="note"
              placeholder="Review note (required when rejecting)"
              maxLength={500}
              className="h-9 rounded-lg border border-input bg-background px-3 text-sm outline-none focus:border-ring focus:ring-2 focus:ring-ring/15"
            />
            <Button type="submit" name="decision" value="APPROVED" size="sm">
              Approve
            </Button>
            <Button
              type="submit"
              name="decision"
              value="REJECTED"
              variant="outline"
              size="sm"
              className="text-red-700 hover:bg-red-50 hover:text-red-800"
            >
              Reject
            </Button>
          </form>
        </>
      ) : (
        <p className="text-sm text-muted-foreground">
          This business has no verification document on file yet. The owner can contact Santo
          support to submit one.
        </p>
      )}
    </section>
  );
}
