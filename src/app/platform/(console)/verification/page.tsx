import Link from "next/link";
import { ArrowUpRight, ShieldCheck } from "lucide-react";
import {
  EmptyState,
  PageHeader,
  Panel,
  PanelHeader,
  StatusPill,
  formatDate,
  formatNumber,
} from "@/components/platform/ui";
import { prisma } from "@/lib/prisma";

const DOCUMENT_TYPES: Record<string, string> = {
  CAC_CERTIFICATE: "CAC certificate",
  BUSINESS_LICENSE: "Business licence",
  TAX_CERTIFICATE: "Tax certificate",
  OTHER: "Other ownership evidence",
};

export default async function PlatformVerificationPage() {
  const submissions = await prisma.organizationKyc.findMany({
    orderBy: { submittedAt: "desc" },
    include: {
      organization: { select: { id: true, name: true, slug: true, status: true } },
      reviewedBy: { select: { name: true } },
    },
  });

  const pending = submissions.filter((submission) => submission.status === "PENDING");
  const decided = submissions.filter((submission) => submission.status !== "PENDING");

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Trust"
        title="Verification queue"
        description="Review the CAC or business evidence submitted by self-onboarded organizations. The decision is recorded on the business and in the audit trail."
      />

      <div className="grid gap-3 sm:grid-cols-3">
        {[
          { label: "Pending review", value: pending.length },
          {
            label: "Approved",
            value: submissions.filter((submission) => submission.status === "APPROVED").length,
          },
          {
            label: "Rejected",
            value: submissions.filter((submission) => submission.status === "REJECTED").length,
          },
        ].map((item) => (
          <div
            key={item.label}
            className="rounded-xl border border-white/[0.07] bg-[#111b2b] p-4"
          >
            <p className="text-[0.65rem] font-semibold uppercase tracking-[0.12em] text-slate-500">
              {item.label}
            </p>
            <p className="mt-1.5 text-xl font-semibold tabular-nums text-slate-100">
              {formatNumber(item.value)}
            </p>
          </div>
        ))}
      </div>

      <Panel>
        <PanelHeader
          title="Pending submissions"
          description="Open the organization to inspect the evidence and approve or reject."
          actions={
            <span className="rounded-full bg-amber-400/15 px-2 py-0.5 text-[0.65rem] font-semibold text-amber-300">
              {pending.length} waiting
            </span>
          }
        />
        <div className="p-table-wrap rounded-none border-0 bg-transparent">
          <table className="p-table">
            <thead>
              <tr>
                <th>Business</th>
                <th>Registration</th>
                <th>Document</th>
                <th>Submitted</th>
                <th className="text-right">Review</th>
              </tr>
            </thead>
            <tbody>
              {pending.length === 0 && (
                <tr>
                  <td colSpan={5} className="p-empty">
                    <EmptyState
                      title="The queue is clear"
                      description="No business verification is waiting for a decision."
                    />
                  </td>
                </tr>
              )}
              {pending.map((submission) => (
                <tr key={submission.id}>
                  <td>
                    <Link
                      href={`/platform/organizations/${submission.organization.id}`}
                      className="font-medium text-slate-200 hover:text-cyan-300"
                    >
                      {submission.legalName}
                    </Link>
                    <span className="block text-[0.65rem] text-slate-500">
                      {submission.organization.name} · {submission.organization.slug}
                    </span>
                  </td>
                  <td>
                    <span className="font-mono text-xs text-slate-300">
                      {submission.registrationNumber ?? "—"}
                    </span>
                    <span className="block text-[0.65rem] text-slate-500">
                      {DOCUMENT_TYPES[submission.documentType] ?? submission.documentType}
                    </span>
                  </td>
                  <td>
                    <a
                      href={`/api/platform/organizations/${submission.organizationId}/kyc/document`}
                      target="_blank"
                      rel="noreferrer"
                      className="text-xs text-slate-300 underline-offset-4 hover:text-cyan-300 hover:underline"
                    >
                      {submission.documentName}
                    </a>
                    <span className="block text-[0.65rem] text-slate-500">
                      {Math.max(1, Math.round(submission.documentSize / 1024))} KB ·{" "}
                      {submission.documentMimeType}
                    </span>
                  </td>
                  <td className="whitespace-nowrap text-slate-400">
                    {formatDate(submission.submittedAt)}
                  </td>
                  <td className="text-right">
                    <Link
                      href={`/platform/organizations/${submission.organization.id}`}
                      className="p-btn"
                    >
                      <ShieldCheck className="size-3.5" /> Review
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Panel>

      <Panel>
        <PanelHeader
          title="Decision history"
          description="Approved and rejected business submissions."
        />
        <div className="p-table-wrap rounded-none border-0 bg-transparent">
          <table className="p-table">
            <thead>
              <tr>
                <th>Business</th>
                <th>Status</th>
                <th>Reviewed by</th>
                <th>Reviewed</th>
                <th>Note</th>
                <th className="text-right">Open</th>
              </tr>
            </thead>
            <tbody>
              {decided.length === 0 && (
                <tr>
                  <td colSpan={6} className="p-empty">
                    No verification decisions recorded yet.
                  </td>
                </tr>
              )}
              {decided.map((submission) => (
                <tr key={submission.id}>
                  <td>
                    <Link
                      href={`/platform/organizations/${submission.organization.id}`}
                      className="font-medium text-slate-200 hover:text-cyan-300"
                    >
                      {submission.legalName}
                    </Link>
                    <span className="block text-[0.65rem] text-slate-500">
                      {submission.organization.name}
                    </span>
                  </td>
                  <td>
                    <StatusPill status={submission.status} />
                  </td>
                  <td className="text-slate-400">{submission.reviewedBy?.name ?? "—"}</td>
                  <td className="whitespace-nowrap text-slate-400">
                    {submission.reviewedAt ? formatDate(submission.reviewedAt) : "—"}
                  </td>
                  <td className="max-w-72 break-words text-xs text-slate-400">
                    {submission.reviewNote ?? "—"}
                  </td>
                  <td className="text-right">
                    <Link
                      href={`/platform/organizations/${submission.organization.id}`}
                      className="inline-flex size-7 items-center justify-center rounded-md border border-white/[0.08] text-slate-400 hover:text-cyan-300"
                      aria-label={`Open ${submission.organization.name}`}
                    >
                      <ArrowUpRight className="size-3.5" />
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Panel>
    </div>
  );
}
