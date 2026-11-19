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
 * Room type CRUD (P7): the accommodation categories the public site sells and
 * the availability engine allocates. Amenity links are edited alongside.
 */

export type RoomTypeRow = {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  maxAdults: number;
  maxChildren: number;
  basePrice: string;
  status: "ACTIVE" | "INACTIVE";
  roomCount: number;
  amenities: Array<{ id: string; name: string }>;
};

export type AmenityOption = { id: string; name: string };

const ERROR_MESSAGES: Record<string, string> = {
  conflict: "A room type with that name or slug already exists.",
  in_use: "This type still has rooms — reassign them first, or mark it inactive.",
  not_found: "Room type not found.",
  invalid_body: "Please check the form values.",
  internal: "Something went wrong.",
};

function messageFor(error: string | undefined) {
  return (error && ERROR_MESSAGES[error]) || ERROR_MESSAGES.internal;
}

const EMPTY = {
  name: "",
  slug: "",
  description: "",
  maxAdults: "2",
  maxChildren: "0",
  basePrice: "",
  status: "ACTIVE",
};

export function RoomTypesManager({
  roomTypes,
  amenities,
}: {
  roomTypes: RoomTypeRow[];
  amenities: AmenityOption[];
}) {
  const [form, setForm] = useState(EMPTY);
  const [amenityIds, setAmenityIds] = useState<string[]>([]);
  const [editing, setEditing] = useState<RoomTypeRow | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const openEdit = (row: RoomTypeRow) => {
    setEditing(row);
    setForm({
      name: row.name,
      slug: row.slug,
      description: row.description ?? "",
      maxAdults: String(row.maxAdults),
      maxChildren: String(row.maxChildren),
      basePrice: row.basePrice,
      status: row.status,
    });
    setAmenityIds(row.amenities.map((amenity) => amenity.id));
    setError(null);
  };

  const openCreate = () => {
    setEditing(null);
    setForm(EMPTY);
    setAmenityIds([]);
    setError(null);
  };

  const toggleAmenity = (id: string) => {
    setAmenityIds((current) =>
      current.includes(id) ? current.filter((value) => value !== id) : [...current, id],
    );
  };

  const save = async () => {
    setBusy(true);
    setError(null);
    const payload = {
      name: form.name.trim(),
      slug: form.slug.trim(),
      description: form.description.trim() || null,
      maxAdults: Number(form.maxAdults),
      maxChildren: Number(form.maxChildren),
      basePrice: form.basePrice.trim(),
      status: form.status,
      amenityIds,
    };
    try {
      const response = await fetch(
        editing ? `/api/admin/room-types/${editing.id}` : "/api/admin/room-types",
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

  const remove = async (row: RoomTypeRow) => {
    if (!window.confirm(`Delete room type "${row.name}"?`)) return;
    setBusy(true);
    setError(null);
    try {
      const response = await fetch(`/api/admin/room-types/${row.id}`, { method: "DELETE" });
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
        title="Room types"
        description="The categories the public site sells. Each type carries its own capacity, base rate and amenities."
        actions={
          <Button type="button" onClick={openCreate} size="sm">
            <Plus /> New room type
          </Button>
        }
      />

      <InlineError>{error}</InlineError>

      {(editing || form.name !== "" || form.slug !== "") && (
        <Card>
          <CardHeader
            title={editing ? `Edit ${editing.name}` : "New room type"}
            description="The slug drives the public room page URL; the base rate is the fallback when no dated rate covers a night."
          />
          <CardBody className="space-y-4">
            <div className="flex flex-wrap gap-3">
              <Field label="Name" required className="w-48">
                <input
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                />
              </Field>
              <Field label="Slug" required className="w-44">
                <input
                  value={form.slug}
                  placeholder="deluxe-king"
                  onChange={(e) => setForm({ ...form, slug: e.target.value })}
                />
              </Field>
              <Field label="Max adults" className="w-24">
                <input
                  value={form.maxAdults}
                  onChange={(e) => setForm({ ...form, maxAdults: e.target.value })}
                />
              </Field>
              <Field label="Max children" className="w-28">
                <input
                  value={form.maxChildren}
                  onChange={(e) => setForm({ ...form, maxChildren: e.target.value })}
                />
              </Field>
              <Field label="Base price / night" required className="w-32">
                <input
                  value={form.basePrice}
                  placeholder="450.00"
                  onChange={(e) => setForm({ ...form, basePrice: e.target.value })}
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
            <Field label="Description">
              <textarea
                rows={3}
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
              />
            </Field>
            <div className="space-y-2">
              <p className="text-xs font-medium text-muted-foreground">Amenities</p>
              <div className="flex flex-wrap gap-2">
                {amenities.map((amenity) => {
                  const checked = amenityIds.includes(amenity.id);
                  return (
                    <label
                      key={amenity.id}
                      className={`inline-flex cursor-pointer items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-medium transition-colors ${
                        checked
                          ? "border-primary/30 bg-primary/10 text-primary"
                          : "border-[var(--admin-line)] bg-card text-muted-foreground hover:bg-muted"
                      }`}
                    >
                      <input
                        type="checkbox"
                        className="sr-only"
                        checked={checked}
                        onChange={() => toggleAmenity(amenity.id)}
                      />
                      {amenity.name}
                    </label>
                  );
                })}
                {amenities.length === 0 && (
                  <p className="text-xs text-muted-foreground">
                    No amenities defined yet — add them from the amenities catalog.
                  </p>
                )}
              </div>
            </div>
            <div className="flex gap-2">
              <Button
                type="button"
                onClick={save}
                disabled={busy || !form.name.trim() || !form.slug.trim() || !form.basePrice.trim()}
                size="sm"
              >
                {busy ? "Saving…" : "Save room type"}
              </Button>
              <Button
                type="button"
                onClick={() => {
                  setEditing(null);
                  setForm({ ...EMPTY, name: "", slug: "" });
                  setAmenityIds([]);
                  setError(null);
                }}
                variant="outline"
                size="sm"
              >
                Clear
              </Button>
            </div>
          </CardBody>
        </Card>
      )}

      <TableShell>
        <thead>
          <tr>
            <th>Name</th>
            <th>Slug</th>
            <th>Capacity</th>
            <th className="text-right">Base price</th>
            <th className="text-right">Rooms</th>
            <th>Amenities</th>
            <th>Status</th>
            <th className="text-right">Actions</th>
          </tr>
        </thead>
        <tbody>
          {roomTypes.length === 0 && (
            <tr>
              <td colSpan={8} className="admin-empty-row">
                No room types yet — create the first category to start adding rooms.
              </td>
            </tr>
          )}
          {roomTypes.map((row) => (
            <tr key={row.id}>
              <td className="admin-cell-strong">{row.name}</td>
              <td>
                <span className="admin-mono text-muted-foreground">{row.slug}</span>
              </td>
              <td className="whitespace-nowrap">
                {row.maxAdults}A / {row.maxChildren}C
              </td>
              <td className="text-right tabular-nums">{row.basePrice}</td>
              <td className="text-right tabular-nums">{row.roomCount}</td>
              <td className="admin-cell-muted max-w-64">
                {row.amenities.map((amenity) => amenity.name).join(", ") || "—"}
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
                    onClick={() => openEdit(row)}
                    disabled={busy}
                    variant="outline"
                    size="sm"
                  >
                    Edit
                  </Button>
                  <Button
                    type="button"
                    onClick={() => remove(row)}
                    disabled={busy}
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
