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
  TableShell,
} from "@/components/admin/ui";
import { Button } from "@/components/ui/button";

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

  const openCreate = () => {
    setEditing(null);
    setName("");
    setDescription("");
    setError(null);
  };

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
    <div className="space-y-5">
      <PageHeader
        title="Amenities"
        description="Reusable room features such as Wi-Fi, air conditioning or a private balcony. Link them to room types as you build the catalog."
        actions={
          <Button type="button" onClick={openCreate} size="sm">
            <Plus /> New amenity
          </Button>
        }
      />

      <InlineError>{error}</InlineError>

      <Card>
        <CardHeader
          title={editing ? `Edit ${editing.name}` : "New amenity"}
          description="Names appear on the public room pages, so keep them short and guest-friendly."
        />
        <CardBody className="space-y-4">
          <div className="flex flex-wrap gap-3">
            <Field label="Name" required className="w-56">
              <input value={name} onChange={(e) => setName(e.target.value)} />
            </Field>
            <Field label="Description" className="min-w-56 flex-1">
              <input value={description} onChange={(e) => setDescription(e.target.value)} />
            </Field>
          </div>
          <div className="flex gap-2">
            <Button type="button" onClick={save} disabled={busy || name.trim().length < 2} size="sm">
              {busy ? "Saving…" : "Save amenity"}
            </Button>
            <Button type="button" onClick={openCreate} variant="outline" size="sm">
              Clear
            </Button>
          </div>
        </CardBody>
      </Card>

      <TableShell>
        <thead>
          <tr>
            <th>Name</th>
            <th>Description</th>
            <th className="text-right">Used by</th>
            <th className="text-right">Actions</th>
          </tr>
        </thead>
        <tbody>
          {amenities.length === 0 && (
            <tr>
              <td colSpan={4} className="admin-empty-row">
                No amenities yet — add the first one to enrich your room types.
              </td>
            </tr>
          )}
          {amenities.map((row) => (
            <tr key={row.id}>
              <td className="admin-cell-strong">{row.name}</td>
              <td className="admin-cell-muted">{row.description ?? "—"}</td>
              <td className="text-right tabular-nums">{row.roomTypeCount} type(s)</td>
              <td>
                <div className="flex justify-end gap-2">
                  <Button
                    type="button"
                    disabled={busy}
                    onClick={() => {
                      setEditing(row);
                      setName(row.name);
                      setDescription(row.description ?? "");
                      setError(null);
                    }}
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
