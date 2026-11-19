import { ShieldCheck } from "lucide-react";
import {
  PageHeader,
  Panel,
  PanelBody,
  PanelHeader,
  StatusPill,
  formatDate,
} from "@/components/platform/ui";
import { listPlatformOperators } from "@/server/platform/admins";

export default async function PlatformOperatorsPage() {
  const operators = await listPlatformOperators();

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Team"
        title="Platform operators"
        description="Santo staff with access to the marketplace console. The platform axis is separate from hotel tenant roles."
      />

      <div className="grid items-start gap-4 xl:grid-cols-[minmax(0,1.6fr)_minmax(300px,1fr)]">
        <Panel>
          <PanelHeader
            title={`${operators.length} operator${operators.length === 1 ? "" : "s"}`}
            description="Operator accounts are created from the first-run setup or by another platform admin."
          />
          <div className="p-table-wrap rounded-none border-0 bg-transparent">
            <table className="p-table">
              <thead>
                <tr>
                  <th>Operator</th>
                  <th>Role</th>
                  <th>Status</th>
                  <th>Joined</th>
                </tr>
              </thead>
              <tbody>
                {operators.length === 0 && (
                  <tr>
                    <td colSpan={4} className="p-empty">
                      No platform operators exist yet. Visit /platform/setup to create the first one.
                    </td>
                  </tr>
                )}
                {operators.map((operator) => (
                  <tr key={operator.id}>
                    <td>
                      <p className="font-medium text-slate-200">{operator.name}</p>
                      <p className="text-[0.65rem] text-slate-500">{operator.email}</p>
                    </td>
                    <td>
                      <StatusPill status={operator.platformRole ?? "SUPPORT"} />
                    </td>
                    <td>
                      <StatusPill
                        status={operator.isActive ? "ACTIVE" : "SUSPENDED"}
                        label={operator.isActive ? "Active" : "Disabled"}
                      />
                    </td>
                    <td className="whitespace-nowrap text-slate-400">
                      {formatDate(operator.createdAt)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Panel>

        <Panel>
          <PanelHeader title="How platform access works" />
          <PanelBody className="space-y-4 text-xs leading-5 text-slate-400">
            <p className="flex gap-2">
              <ShieldCheck className="mt-0.5 size-4 shrink-0 text-cyan-400" />
              Operators sign in at <span className="font-mono text-slate-300">/platform/login</span>.
              A hotel administrator account does not grant platform access.
            </p>
            <p>
              Platform roles are <strong className="text-slate-200">Support</strong>,{" "}
              <strong className="text-slate-200">Operations</strong> and{" "}
              <strong className="text-slate-200">Admin</strong>. Listing review and business
              verification require the operations permission; organization onboarding requires
              admin.
            </p>
            <p>
              The first operator is created on the one-time setup screen. Subsequent operators are
              provisioned server-side so a public deployment cannot be claimed after setup.
            </p>
          </PanelBody>
        </Panel>
      </div>
    </div>
  );
}
