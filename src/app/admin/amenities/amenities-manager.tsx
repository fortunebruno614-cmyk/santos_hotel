"use client";

import { useState } from "react";

/** Amenities CRUD (P7): reusable room features linked to room types. */

export type AmenityRow = {
  id: string;
  name: string;
  description: string | null;
  roomTypeCount: number;
};

const ERROR_MESSAGES: Record<string, string> = {
  conflict: "An amenity with that name already exists.",
  in_use: "This amenity is still linked to room types.",
  not_found: "Amenity not found.",
  invalid_body: "Please check the form values.",
  internal: "Something went wrong.",
};

function messageFor(error: string | undefined) {
  return (error && ERROR_MESSAGES[error]) || ERROR_MESSAGES.internal;
}

export function AmenitiesManager({ amenities }: { amenities: AmenityRow[] }) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [editing, setEditing] = useState<AmenityRow | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const save = async () => {
    setBusy(true);
    setError(null);
    const payload = { name: name.trim(), description: description.trim() || null };
    try {
      const response = await fetch(
        editing ? `/api/admin/amenities/${editing.id}` : "/api/admin/amenities",
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

  const remove = async (row: AmenityRow) => {
    if (!window.confirm(`Delete amenity "${row.name}"?`)) return;
    setBusy(true);
    setError(null);
    try {
      const response = await fetch(`/api/admin/amenities/${row.id}`, { method: "DELETE" });
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
      <h1 className="text-2xl font-semibold">Amenities</h1>
      {error && <p className="text-sm text-red-600">{error}</p>}

      <div className="border rounded-md p-4 space-y-3 text-sm max-w-2xl">
        <p className="font-medium">{editing ? `Edit ${editing.name}` : "New amenity"}</p>
        <div className="flex flex-wrap gap-3">
          <label className="flex flex-col gap-1">
            <span className="text-xs text-zinc-500">Name</span>
            <input
              className="border px-2 py-1 rounded-md w-56"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </label>
          <label className="flex flex-col gap-1 flex-1 min-w-48">
            <span className="text-xs text-zinc-500">Description</span>
            <input
              className="border px-2 py-1 rounded-md"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </label>
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={save}
            disabled={busy || name.trim().length < 2}
            className="border px-3 py-1 rounded-md disabled:opacity-50"
          >
            {busy ? "Saving…" : "Save"}
          </button>
          <button
            type="button"
            onClick={() => {
              setEditing(null);
              setName("");
              setDescription("");
              setError(null);
            }}
            className="border px-3 py-1 rounded-md"
          >
            Clear
          </button>
        </div>
      </div>

      <table className="w-full text-sm">
        <thead>
          <tr className="border-b text-left">
            <th className="py-2 pr-3">Name</th>
            <th className="py-2 pr-3">Description</th>
            <th className="py-2 pr-3">Used by</th>
            <th className="py-2">Actions</th>
          </tr>
        </thead>
        <tbody>
          {amenities.map((row) => (
            <tr key={row.id} className="border-b last:border-0">
              <td className="py-2 pr-3 font-medium">{row.name}</td>
              <td className="py-2 pr-3 text-zinc-500">{row.description ?? "—"}</td>
              <td className="py-2 pr-3">{row.roomTypeCount} type(s)</td>
              <td className="py-2">
                <div className="flex gap-2">
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => {
                      setEditing(row);
                      setName(row.name);
                      setDescription(row.description ?? "");
                      setError(null);
                    }}
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
  );
}
