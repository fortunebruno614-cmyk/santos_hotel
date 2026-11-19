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

  const openCreate = () => {
    setEditing(null);
    setForm({ ...EMPTY, roomTypeId: roomTypes[0]?.id ?? "" });
    setError(null);
  };

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
    <div className="space-y-5">
      <PageHeader
        title="Rates"
        description="Dated price windows per room type. When several rates cover a night, the active one with the latest start date wins."
        actions={
          <Button type="button" onClick={openCreate} size="sm">
            <Plus /> New rate
          </Button>
        }
      />

      <InlineError>{error}</InlineError>

      <Card>
        <CardHeader
          title={editing ? `Edit ${editing.name}` : "New rate"}
          description="A rate applies to every night from its start date through its end date."
        />
        <CardBody className="space-y-4">
          <div className="flex flex-wrap gap-3">
            <Field label="Room type" required>
              <select
                value={form.roomTypeId}
                onChange={(e) => setForm({ ...form, roomTypeId: e.target.value })}
              >
                {roomTypes.map((type) => (
                  <option key={type.id} value={type.id}>
                    {type.name}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Name" required className="w-48">
              <input
                value={form.name}
                placeholder="Weekend rate"
                onChange={(e) => setForm({ ...form, name: e.target.value })}
              />
            </Field>
            <Field label="Amount / night" required className="w-32">
              <input
                value={form.amount}
                placeholder="450.00"
                onChange={(e) => setForm({ ...form, amount: e.target.value })}
              />
            </Field>
            <Field label="Start" required className="w-40">
              <input
                type="date"
                value={form.startDate}
                onChange={(e) => setForm({ ...form, startDate: e.target.value })}
              />
            </Field>
            <Field label="End" required className="w-40">
              <input
                type="date"
                value={form.endDate}
                onChange={(e) => setForm({ ...form, endDate: e.target.value })}
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
            disabled={
              busy ||
              !form.roomTypeId ||
              !form.name.trim() ||
              !form.amount.trim() ||
              !form.startDate ||
              !form.endDate
            }
            size="sm"
          >
            {busy ? "Saving…" : "Save rate"}
          </Button>
        </CardBody>
      </Card>

      <TableShell>
        <thead>
          <tr>
            <th>Room type</th>
            <th>Name</th>
            <th className="text-right">Amount</th>
            <th>Window</th>
            <th>Status</th>
            <th className="text-right">Actions</th>
          </tr>
        </thead>
        <tbody>
          {rates.length === 0 && (
            <tr>
              <td colSpan={6} className="admin-empty-row">
                No rates yet — create one to override the room type&apos;s base price.
              </td>
            </tr>
          )}
          {rates.map((row) => (
            <tr key={row.id}>
              <td className="admin-cell-muted">{row.roomTypeName}</td>
              <td className="admin-cell-strong">{row.name}</td>
              <td className="text-right tabular-nums">{row.amount}</td>
              <td className="whitespace-nowrap">
                {row.startDate} → {row.endDate}
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
