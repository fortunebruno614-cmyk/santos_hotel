"use client";

import { useState } from "react";
import { Plus } from "lucide-react";
import {
  Card,
  CardBody,
  CardHeader,
  Field,
  InlineError,
  PageHeader,
  StatusBadge,
  TableShell,
} from "@/components/admin/ui";
import { Button } from "@/components/ui/button";

/**
 * Promotions CRUD (P7): discount rules the pricing service evaluates on every
 * quote (window, cap, percentage/fixed). Deactivated or expired codes stop
 * applying immediately; redeemed codes cannot be deleted, only deactivated.
 */

export type PromotionRow = {
  id: string;
  code: string;
  type: "PERCENTAGE" | "FIXED_AMOUNT";
  value: string;
  startAt: string;
  endAt: string;
  maxUses: number | null;
  status: "ACTIVE" | "INACTIVE";
  redeemed: number;
};

const ERROR_MESSAGES: Record<string, string> = {
  conflict: "That promotion code already exists.",
  in_use: "This promotion has been redeemed — mark it inactive instead.",
  not_found: "Promotion not found.",
  invalid_body: "Please check the form values.",
  internal: "Something went wrong.",
};

function messageFor(error: string | undefined) {
  return (error && ERROR_MESSAGES[error]) || ERROR_MESSAGES.internal;
}

function toLocalInput(iso: string) {
  // datetime-local wants "YYYY-MM-DDTHH:mm"; the wire format is UTC ISO.
  return iso.slice(0, 16);
}

const EMPTY = {
  code: "",
  type: "PERCENTAGE",
  value: "",
  startAt: "",
  endAt: "",
  maxUses: "",
  status: "ACTIVE",
};

export function PromotionsManager({ promotions }: { promotions: PromotionRow[] }) {
  const [form, setForm] = useState(EMPTY);
  const [editing, setEditing] = useState<PromotionRow | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const openCreate = () => {
    setEditing(null);
    setForm(EMPTY);
    setError(null);
  };

  const openEdit = (row: PromotionRow) => {
    setEditing(row);
    setForm({
      code: row.code,
      type: row.type,
      value: row.value,
      startAt: toLocalInput(row.startAt),
      endAt: toLocalInput(row.endAt),
      maxUses: row.maxUses === null ? "" : String(row.maxUses),
      status: row.status,
    });
    setError(null);
  };

  const save = async () => {
    setBusy(true);
    setError(null);
    const payload = {
      code: form.code.trim(),
      type: form.type,
      value: form.value.trim(),
      startAt: new Date(form.startAt).toISOString(),
      endAt: new Date(form.endAt).toISOString(),
      maxUses: form.maxUses.trim() === "" ? null : Number(form.maxUses),
      status: form.status,
    };
    try {
      const response = await fetch(
        editing ? `/api/admin/promotions/${editing.id}` : "/api/admin/promotions",
        {
          method: editing ? "PATCH" : "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(payload),
        },
      );
      if (!response.ok) {
        const body = (await response.json().catch(() => ({}))) as { error?: string };
        setError(messageFor(body.error));
        return;
      }
      window.location.reload();
    } catch {
      setError(ERROR_MESSAGES.internal);
    } finally {
      setBusy(false);
    }
  };

  const remove = async (row: PromotionRow) => {
    if (!window.confirm(`Delete promotion "${row.code}"?`)) return;
    setBusy(true);
    setError(null);
    try {
      const response = await fetch(`/api/admin/promotions/${row.id}`, { method: "DELETE" });
      if (!response.ok) {
        const body = (await response.json().catch(() => ({}))) as { error?: string };
        setError(messageFor(body.error));
        return;
      }
      window.location.reload();
    } catch {
      setError(ERROR_MESSAGES.internal);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-5">
      <PageHeader
        title="Promotions"
        description="Discount codes evaluated on every quote. A code stops applying the moment it expires, reaches its cap or is marked inactive."
        actions={
          <Button type="button" onClick={openCreate} size="sm">
            <Plus /> New promotion
          </Button>
        }
      />

      <InlineError>{error}</InlineError>

      <Card>
        <CardHeader
          title={editing ? `Edit ${editing.code}` : "New promotion"}
          description="Times are entered in local time and stored in UTC. Leave “Max uses” blank for unlimited redemptions."
        />
        <CardBody className="space-y-4">
          <div className="flex flex-wrap gap-3">
            <Field label="Code" required className="w-36">
              <input
                className="font-mono uppercase"
                value={form.code}
                placeholder="STAY10"
                onChange={(e) => setForm({ ...form, code: e.target.value })}
              />
            </Field>
            <Field label="Type">
              <select
                value={form.type}
                onChange={(e) => setForm({ ...form, type: e.target.value })}
              >
                <option value="PERCENTAGE">Percentage</option>
                <option value="FIXED_AMOUNT">Fixed amount</option>
              </select>
            </Field>
            <Field
              label={`Value ${form.type === "PERCENTAGE" ? "(%)" : "(amount)"}`}
              required
              className="w-28"
            >
              <input
                value={form.value}
                onChange={(e) => setForm({ ...form, value: e.target.value })}
              />
            </Field>
            <Field label="Starts" required className="w-52">
              <input
                type="datetime-local"
                value={form.startAt}
                onChange={(e) => setForm({ ...form, startAt: e.target.value })}
              />
            </Field>
            <Field label="Ends" required className="w-52">
              <input
                type="datetime-local"
                value={form.endAt}
                onChange={(e) => setForm({ ...form, endAt: e.target.value })}
              />
            </Field>
            <Field label="Max uses (blank = unlimited)" className="w-40">
              <input
                value={form.maxUses}
                onChange={(e) => setForm({ ...form, maxUses: e.target.value })}
              />
            </Field>
            <Field label="Status">
              <select
                value={form.status}
                onChange={(e) => setForm({ ...form, status: e.target.value })}
              >
                <option value="ACTIVE">Active</option>
                <option value="INACTIVE">Inactive</option>
              </select>
            </Field>
          </div>
          <Button
            type="button"
            onClick={save}
            disabled={busy || !form.code.trim() || !form.value.trim() || !form.startAt || !form.endAt}
            size="sm"
          >
            {busy ? "Saving…" : "Save promotion"}
          </Button>
        </CardBody>
      </Card>

      <TableShell>
        <thead>
          <tr>
            <th>Code</th>
            <th>Discount</th>
            <th>Window</th>
            <th className="text-right">Uses</th>
            <th>Status</th>
            <th className="text-right">Actions</th>
          </tr>
        </thead>
        <tbody>
          {promotions.length === 0 && (
            <tr>
              <td colSpan={6} className="admin-empty-row">
                No promotions yet — create a code when you are ready to run an offer.
              </td>
            </tr>
          )}
          {promotions.map((row) => (
            <tr key={row.id}>
              <td>
                <span className="admin-mono rounded bg-muted px-1.5 py-0.5 font-medium">
                  {row.code}
                </span>
              </td>
              <td>
                {row.type === "PERCENTAGE" ? `${row.value}%` : `${row.value} fixed`}
              </td>
              <td className="whitespace-nowrap">
                {row.startAt.slice(0, 10)} → {row.endAt.slice(0, 10)}
              </td>
              <td className="text-right tabular-nums">
                {row.redeemed}
                {row.maxUses === null ? "" : ` / ${row.maxUses}`}
              </td>
              <td>
                <StatusBadge
                  status={row.status}
                  label={row.status === "ACTIVE" ? "Active" : "Inactive"}
                />
              </td>
              <td>
                <div className="flex justify-end gap-2">
                  <Button
                    type="button"
                    disabled={busy}
                    onClick={() => openEdit(row)}
                    variant="outline"
                    size="sm"
                  >
                    Edit
                  </Button>
                  <Button
                    type="button"
                    disabled={busy}
                    onClick={() => remove(row)}
                    variant="outline"
                    size="sm"
                    className="text-red-700 hover:bg-red-50 hover:text-red-800"
                  >
                    Delete
                  </Button>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </TableShell>
    </div>
  );
}
