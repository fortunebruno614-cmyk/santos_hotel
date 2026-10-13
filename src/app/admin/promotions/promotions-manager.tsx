"use client";

import { useState } from "react";

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
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Promotions</h1>
        <button
          type="button"
          onClick={() => {
            setEditing(null);
            setForm(EMPTY);
            setError(null);
          }}
          className="border px-3 py-1 rounded-md text-sm"
        >
          New promotion
        </button>
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}

      <div className="border rounded-md p-4 space-y-3 text-sm">
        <p className="font-medium">{editing ? `Edit ${editing.code}` : "New promotion"}</p>
        <div className="flex flex-wrap gap-3">
          <label className="flex flex-col gap-1">
            <span className="text-xs text-zinc-500">Code</span>
            <input
              className="border px-2 py-1 rounded-md w-32 font-mono"
              value={form.code}
              placeholder="STAY10"
              onChange={(e) => setForm({ ...form, code: e.target.value })}
            />
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-xs text-zinc-500">Type</span>
            <select
              className="border px-2 py-1 rounded-md"
              value={form.type}
              onChange={(e) => setForm({ ...form, type: e.target.value })}
            >
              <option value="PERCENTAGE">Percentage</option>
              <option value="FIXED_AMOUNT">Fixed amount</option>
            </select>
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-xs text-zinc-500">
              Value {form.type === "PERCENTAGE" ? "(%)" : "(amount)"}
            </span>
            <input
              className="border px-2 py-1 rounded-md w-24"
              value={form.value}
              onChange={(e) => setForm({ ...form, value: e.target.value })}
            />
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-xs text-zinc-500">Starts</span>
            <input
              type="datetime-local"
              className="border px-2 py-1 rounded-md"
              value={form.startAt}
              onChange={(e) => setForm({ ...form, startAt: e.target.value })}
            />
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-xs text-zinc-500">Ends</span>
            <input
              type="datetime-local"
              className="border px-2 py-1 rounded-md"
              value={form.endAt}
              onChange={(e) => setForm({ ...form, endAt: e.target.value })}
            />
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-xs text-zinc-500">Max uses (blank = unlimited)</span>
            <input
              className="border px-2 py-1 rounded-md w-28"
              value={form.maxUses}
              onChange={(e) => setForm({ ...form, maxUses: e.target.value })}
            />
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-xs text-zinc-500">Status</span>
            <select
              className="border px-2 py-1 rounded-md"
              value={form.status}
              onChange={(e) => setForm({ ...form, status: e.target.value })}
            >
              <option value="ACTIVE">Active</option>
              <option value="INACTIVE">Inactive</option>
            </select>
          </label>
        </div>
        <button
          type="button"
          onClick={save}
          disabled={
            busy || !form.code.trim() || !form.value.trim() || !form.startAt || !form.endAt
          }
          className="border px-3 py-1 rounded-md disabled:opacity-50"
        >
          {busy ? "Saving…" : "Save"}
        </button>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b text-left">
              <th className="py-2 pr-3">Code</th>
              <th className="py-2 pr-3">Discount</th>
              <th className="py-2 pr-3">Window</th>
              <th className="py-2 pr-3">Uses</th>
              <th className="py-2 pr-3">Status</th>
              <th className="py-2">Actions</th>
            </tr>
          </thead>
          <tbody>
            {promotions.map((row) => (
              <tr key={row.id} className="border-b last:border-0">
                <td className="py-2 pr-3 font-mono font-medium">{row.code}</td>
                <td className="py-2 pr-3">
                  {row.type === "PERCENTAGE" ? `${row.value}%` : `${row.value} fixed`}
                </td>
                <td className="py-2 pr-3 whitespace-nowrap">
                  {row.startAt.slice(0, 10)} → {row.endAt.slice(0, 10)}
                </td>
                <td className="py-2 pr-3">
                  {row.redeemed}
                  {row.maxUses === null ? "" : ` / ${row.maxUses}`}
                </td>
                <td className="py-2 pr-3">{row.status === "ACTIVE" ? "Active" : "Inactive"}</td>
                <td className="py-2">
                  <div className="flex gap-2">
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => openEdit(row)}
                      className="border px-2 py-1 rounded-md text-xs"
                    >
                      Edit
                    </button>
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => remove(row)}
                      className="border px-2 py-1 rounded-md text-xs text-red-600"
                    >
                      Delete
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
