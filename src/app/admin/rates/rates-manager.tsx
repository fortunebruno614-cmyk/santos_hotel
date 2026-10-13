"use client";

import { useState } from "react";

/**
 * Rates CRUD (P7): dated price windows per room type. Pricing picks the
 * covering ACTIVE rate with the latest start date on every quote, so a saved
 * rate is live immediately for the nights inside its window.
 */

export type RateRow = {
  id: string;
  roomTypeId: string;
  roomTypeName: string;
  name: string;
  amount: string;
  startDate: string;
  endDate: string;
  status: "ACTIVE" | "INACTIVE";
};

export type RoomTypeOption = { id: string; name: string };

const ERROR_MESSAGES: Record<string, string> = {
  not_found: "Room type or rate not found.",
  in_use: "This rate cannot be removed.",
  invalid_body: "Please check the form values (dates as YYYY-MM-DD, amount like 450.00).",
  internal: "Something went wrong.",
};

function messageFor(error: string | undefined) {
  return (error && ERROR_MESSAGES[error]) || ERROR_MESSAGES.internal;
}

const EMPTY = {
  roomTypeId: "",
  name: "",
  amount: "",
  startDate: "",
  endDate: "",
  status: "ACTIVE",
};

export function RatesManager({
  rates,
  roomTypes,
}: {
  rates: RateRow[];
  roomTypes: RoomTypeOption[];
}) {
  const [form, setForm] = useState({ ...EMPTY, roomTypeId: roomTypes[0]?.id ?? "" });
  const [editing, setEditing] = useState<RateRow | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const openEdit = (row: RateRow) => {
    setEditing(row);
    setForm({
      roomTypeId: row.roomTypeId,
      name: row.name,
      amount: row.amount,
      startDate: row.startDate,
      endDate: row.endDate,
      status: row.status,
    });
    setError(null);
  };

  const save = async () => {
    setBusy(true);
    setError(null);
    const payload = {
      roomTypeId: form.roomTypeId,
      name: form.name.trim(),
      amount: form.amount.trim(),
      startDate: form.startDate,
      endDate: form.endDate,
      status: form.status,
    };
    try {
      const response = await fetch(
        editing ? `/api/admin/rates/${editing.id}` : "/api/admin/rates",
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

  const remove = async (row: RateRow) => {
    if (!window.confirm(`Delete rate "${row.name}"?`)) return;
    setBusy(true);
    setError(null);
    try {
      const response = await fetch(`/api/admin/rates/${row.id}`, { method: "DELETE" });
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
        <h1 className="text-2xl font-semibold">Rates</h1>
        <button
          type="button"
          onClick={() => {
            setEditing(null);
            setForm({ ...EMPTY, roomTypeId: roomTypes[0]?.id ?? "" });
            setError(null);
          }}
          className="border px-3 py-1 rounded-md text-sm"
        >
          New rate
        </button>
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}

      <div className="border rounded-md p-4 space-y-3 text-sm">
        <p className="font-medium">{editing ? `Edit ${editing.name}` : "New rate"}</p>
        <div className="flex flex-wrap gap-3">
          <label className="flex flex-col gap-1">
            <span className="text-xs text-zinc-500">Room type</span>
            <select
              className="border px-2 py-1 rounded-md"
              value={form.roomTypeId}
              onChange={(e) => setForm({ ...form, roomTypeId: e.target.value })}
            >
              {roomTypes.map((type) => (
                <option key={type.id} value={type.id}>
                  {type.name}
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-xs text-zinc-500">Name</span>
            <input
              className="border px-2 py-1 rounded-md w-48"
              value={form.name}
              placeholder="Weekend rate"
              onChange={(e) => setForm({ ...form, name: e.target.value })}
            />
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-xs text-zinc-500">Amount / night</span>
            <input
              className="border px-2 py-1 rounded-md w-28"
              value={form.amount}
              placeholder="450.00"
              onChange={(e) => setForm({ ...form, amount: e.target.value })}
            />
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-xs text-zinc-500">Start</span>
            <input
              type="date"
              className="border px-2 py-1 rounded-md"
              value={form.startDate}
              onChange={(e) => setForm({ ...form, startDate: e.target.value })}
            />
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-xs text-zinc-500">End</span>
            <input
              type="date"
              className="border px-2 py-1 rounded-md"
              value={form.endDate}
              onChange={(e) => setForm({ ...form, endDate: e.target.value })}
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
            busy ||
            !form.roomTypeId ||
            !form.name.trim() ||
            !form.amount.trim() ||
            !form.startDate ||
            !form.endDate
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
              <th className="py-2 pr-3">Room type</th>
              <th className="py-2 pr-3">Name</th>
              <th className="py-2 pr-3">Amount</th>
              <th className="py-2 pr-3">Window</th>
              <th className="py-2 pr-3">Status</th>
              <th className="py-2">Actions</th>
            </tr>
          </thead>
          <tbody>
            {rates.map((row) => (
              <tr key={row.id} className="border-b last:border-0">
                <td className="py-2 pr-3">{row.roomTypeName}</td>
                <td className="py-2 pr-3 font-medium">{row.name}</td>
                <td className="py-2 pr-3">{row.amount}</td>
                <td className="py-2 pr-3 whitespace-nowrap">
                  {row.startDate} → {row.endDate}
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
