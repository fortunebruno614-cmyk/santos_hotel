"use client";

import { useState } from "react";
import { Plus } from "lucide-react";
import {
  Card,
  CardHeader,
  Field,
  InlineError,
  StatusBadge,
  TableShell,
} from "@/components/admin/ui";
import { Button } from "@/components/ui/button";
import { RoomStatus } from "@/generated/prisma/enums";
import { roomStatusLabel } from "@/components/labels";

/**
 * Room inventory CRUD (P7): add, edit and remove physical rooms.
 *
 * Status edits here still go through the housekeeping transition table on the
 * server (`PATCH /api/admin/rooms/{id}` refuses `OCCUPIED → AVAILABLE`), so the
 * board and this table can never disagree with the policy.
 */

export type InventoryRoom = {
  id: string;
  roomNumber: string;
  floor: number | null;
  status: RoomStatus;
  notes: string | null;
  roomTypeId: string;
  roomTypeName: string;
};

export type InventoryRoomType = { id: string; name: string };

const ERROR_MESSAGES: Record<string, string> = {
  conflict: "That room number is already taken.",
  in_use: "This room has reservation history — set it out of service instead of deleting it.",
  not_found: "Room or room type not found.",
  invalid_room_transition: "That status change is not allowed from the current status.",
  invalid_body: "Please check the form values.",
  internal: "Something went wrong.",
};

function messageFor(error: string | undefined) {
  return (error && ERROR_MESSAGES[error]) || ERROR_MESSAGES.internal;
}

const EMPTY_FORM = { roomNumber: "", floor: "", roomTypeId: "", status: "AVAILABLE", notes: "" };

export function RoomsInventory({
  rooms,
  roomTypes,
}: {
  rooms: InventoryRoom[];
  roomTypes: InventoryRoomType[];
}) {
  const [editing, setEditing] = useState<InventoryRoom | null>(null);
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const openCreate = () => {
    setEditing(null);
    setForm({ ...EMPTY_FORM, roomTypeId: roomTypes[0]?.id ?? "" });
    setCreating(true);
    setError(null);
  };

  const openEdit = (room: InventoryRoom) => {
    setCreating(false);
    setEditing(room);
    setForm({
      roomNumber: room.roomNumber,
      floor: room.floor === null ? "" : String(room.floor),
      roomTypeId: room.roomTypeId,
      status: room.status,
      notes: room.notes ?? "",
    });
    setError(null);
  };

  const close = () => {
    setCreating(false);
    setEditing(null);
    setError(null);
  };

  const save = async () => {
    setBusy(true);
    setError(null);
    const payload = {
      roomNumber: form.roomNumber.trim(),
      floor: form.floor.trim() === "" ? null : Number(form.floor),
      roomTypeId: form.roomTypeId,
      status: form.status,
      notes: form.notes.trim() === "" ? null : form.notes.trim(),
    };
    try {
      const response = await fetch(editing ? `/api/admin/rooms/${editing.id}` : "/api/admin/rooms", {
        method: editing ? "PATCH" : "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload),
      });
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

  const remove = async (room: InventoryRoom) => {
    if (!window.confirm(`Delete room ${room.roomNumber}? This cannot be undone.`)) return;
    setBusy(true);
    setError(null);
    try {
      const response = await fetch(`/api/admin/rooms/${room.id}`, { method: "DELETE" });
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
    <Card>
      <CardHeader
        title="Inventory"
        description="Physical rooms and their housekeeping status. Deleting a room removes it from the sellable inventory."
        actions={
          <Button type="button" onClick={openCreate} size="sm">
            <Plus /> Add room
          </Button>
        }
      />

      {(error || creating || editing) && (
        <div className="space-y-3 border-b border-[var(--admin-line)] px-5 py-4">
          <InlineError>{error}</InlineError>
          {(creating || editing) && (
            <div className="space-y-3 rounded-xl bg-muted/50 p-4">
              <p className="text-sm font-semibold">
                {editing ? `Edit room ${editing.roomNumber}` : "New room"}
              </p>
              <div className="flex flex-wrap gap-3">
                <Field label="Room number" required className="w-28">
                  <input
                    value={form.roomNumber}
                    onChange={(e) => setForm({ ...form, roomNumber: e.target.value })}
                  />
                </Field>
                <Field label="Floor" className="w-20">
                  <input
                    value={form.floor}
                    placeholder="—"
                    onChange={(e) => setForm({ ...form, floor: e.target.value })}
                  />
                </Field>
                <Field label="Room type">
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
                <Field label="Status">
                  <select
                    value={form.status}
                    onChange={(e) => setForm({ ...form, status: e.target.value })}
                  >
                    {Object.values(RoomStatus).map((status) => (
                      <option key={status} value={status}>
                        {roomStatusLabel(status)}
                      </option>
                    ))}
                  </select>
                </Field>
                <Field label="Notes" className="min-w-56 flex-1">
                  <input
                    value={form.notes}
                    onChange={(e) => setForm({ ...form, notes: e.target.value })}
                  />
                </Field>
              </div>
              <div className="flex gap-2">
                <Button
                  type="button"
                  onClick={save}
                  disabled={busy || !form.roomNumber.trim() || !form.roomTypeId}
                  size="sm"
                >
                  {busy ? "Saving…" : "Save room"}
                </Button>
                <Button type="button" onClick={close} variant="outline" size="sm">
                  Cancel
                </Button>
              </div>
            </div>
          )}
        </div>
      )}

      <TableShell className="rounded-t-none border-0 shadow-none">
        <thead>
          <tr>
            <th>Room</th>
            <th>Type</th>
            <th>Floor</th>
            <th>Status</th>
            <th>Notes</th>
            <th className="text-right">Actions</th>
          </tr>
        </thead>
        <tbody>
          {rooms.length === 0 && (
            <tr>
              <td colSpan={6} className="admin-empty-row">
                No rooms yet — add the first room to start selling.
              </td>
            </tr>
          )}
          {rooms.map((room) => (
            <tr key={room.id}>
              <td className="admin-cell-strong whitespace-nowrap">{room.roomNumber}</td>
              <td className="admin-cell-muted">{room.roomTypeName}</td>
              <td>{room.floor ?? "—"}</td>
              <td>
                <StatusBadge status={room.status} label={roomStatusLabel(room.status)} />
              </td>
              <td className="admin-cell-muted max-w-56 truncate">{room.notes ?? "—"}</td>
              <td>
                <div className="flex justify-end gap-2">
                  <Button
                    type="button"
                    onClick={() => openEdit(room)}
                    disabled={busy}
                    variant="outline"
                    size="sm"
                  >
                    Edit
                  </Button>
                  <Button
                    type="button"
                    onClick={() => remove(room)}
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
    </Card>
  );
}
