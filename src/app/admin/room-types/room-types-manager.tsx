"use client";

import { useState } from "react";

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
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Room types</h1>
        <button type="button" onClick={openCreate} className="border px-3 py-1 rounded-md text-sm">
          New room type
        </button>
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}

      {(editing || form.name !== "" || form.slug !== "") && (
        <div className="border rounded-md p-4 space-y-3 text-sm">
          <p className="font-medium">{editing ? `Edit ${editing.name}` : "New room type"}</p>
          <div className="flex flex-wrap gap-3">
            <Field label="Name">
              <input
                className="border px-2 py-1 rounded-md w-48"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
              />
            </Field>
            <Field label="Slug">
              <input
                className="border px-2 py-1 rounded-md w-40"
                value={form.slug}
                placeholder="deluxe-king"
                onChange={(e) => setForm({ ...form, slug: e.target.value })}
              />
            </Field>
            <Field label="Max adults">
              <input
                className="border px-2 py-1 rounded-md w-20"
                value={form.maxAdults}
                onChange={(e) => setForm({ ...form, maxAdults: e.target.value })}
              />
            </Field>
            <Field label="Max children">
              <input
                className="border px-2 py-1 rounded-md w-24"
                value={form.maxChildren}
                onChange={(e) => setForm({ ...form, maxChildren: e.target.value })}
              />
            </Field>
            <Field label="Base price / night">
              <input
                className="border px-2 py-1 rounded-md w-28"
                value={form.basePrice}
                placeholder="450.00"
                onChange={(e) => setForm({ ...form, basePrice: e.target.value })}
              />
            </Field>
            <Field label="Status">
              <select
                className="border px-2 py-1 rounded-md"
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
              className="border px-2 py-1 rounded-md w-full"
              rows={2}
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
            />
          </Field>
          <div className="flex flex-wrap gap-3">
            {amenities.map((amenity) => (
              <label key={amenity.id} className="flex items-center gap-1 text-sm">
                <input
                  type="checkbox"
                  checked={amenityIds.includes(amenity.id)}
                  onChange={() => toggleAmenity(amenity.id)}
                />
                {amenity.name}
              </label>
            ))}
            {amenities.length === 0 && (
              <p className="text-xs text-zinc-500">No amenities defined yet.</p>
            )}
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={save}
              disabled={busy || !form.name.trim() || !form.slug.trim() || !form.basePrice.trim()}
              className="border px-3 py-1 rounded-md disabled:opacity-50"
            >
              {busy ? "Saving…" : "Save"}
            </button>
            <button
              type="button"
              onClick={() => {
                setEditing(null);
                setForm({ ...EMPTY, name: "", slug: "" });
                setAmenityIds([]);
                setError(null);
              }}
              className="border px-3 py-1 rounded-md"
            >
              Clear
            </button>
          </div>
        </div>
      )}

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b text-left">
              <th className="py-2 pr-3">Name</th>
              <th className="py-2 pr-3">Slug</th>
              <th className="py-2 pr-3">Capacity</th>
              <th className="py-2 pr-3">Base price</th>
              <th className="py-2 pr-3">Rooms</th>
              <th className="py-2 pr-3">Amenities</th>
              <th className="py-2 pr-3">Status</th>
              <th className="py-2">Actions</th>
            </tr>
          </thead>
          <tbody>
            {roomTypes.map((row) => (
              <tr key={row.id} className="border-b last:border-0">
                <td className="py-2 pr-3 font-medium">{row.name}</td>
                <td className="py-2 pr-3 font-mono text-xs">{row.slug}</td>
                <td className="py-2 pr-3">
                  {row.maxAdults}A / {row.maxChildren}C
                </td>
                <td className="py-2 pr-3">{row.basePrice}</td>
                <td className="py-2 pr-3">{row.roomCount}</td>
                <td className="py-2 pr-3 text-xs text-zinc-500">
                  {row.amenities.map((amenity) => amenity.name).join(", ") || "—"}
                </td>
                <td className="py-2 pr-3">{row.status === "ACTIVE" ? "Active" : "Inactive"}</td>
                <td className="py-2">
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => openEdit(row)}
                      disabled={busy}
                      className="border px-2 py-1 rounded-md text-xs"
                    >
                      Edit
                    </button>
                    <button
                      type="button"
                      onClick={() => remove(row)}
                      disabled={busy}
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

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-xs text-zinc-500">{label}</span>
      {children}
    </label>
  );
}
