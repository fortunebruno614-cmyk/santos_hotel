"use client";

import { useState } from "react";
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
    <section className="space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-medium">Inventory</h2>
        <button
          type="button"
          onClick={openCreate}
          className="border px-3 py-1 rounded-md text-sm font-medium"
        >
          Add room
        </button>
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}

      {(creating || editing) && (
        <div className="border rounded-md p-4 space-y-3 text-sm">
          <p className="font-medium">{editing ? `Edit room ${editing.roomNumber}` : "New room"}</p>
          <div className="flex flex-wrap gap-3">
            <label className="flex flex-col gap-1">
              <span className="text-xs text-zinc-500">Room number</span>
              <input
                className="border px-2 py-1 rounded-md w-28"
                value={form.roomNumber}
                onChange={(e) => setForm({ ...form, roomNumber: e.target.value })}
              />
            </label>
            <label className="flex flex-col gap-1">
              <span className="text-xs text-zinc-500">Floor</span>
              <input
                className="border px-2 py-1 rounded-md w-20"
                value={form.floor}
                placeholder="—"
                onChange={(e) => setForm({ ...form, floor: e.target.value })}
              />
            </label>
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
              <span className="text-xs text-zinc-500">Status</span>
              <select
                className="border px-2 py-1 rounded-md"
                value={form.status}
                onChange={(e) => setForm({ ...form, status: e.target.value })}
              >
                {Object.values(RoomStatus).map((status) => (
                  <option key={status} value={status}>
                    {roomStatusLabel(status)}
                  </option>
                ))}
              </select>
            </label>
            <label className="flex flex-col gap-1 flex-1 min-w-48">
              <span className="text-xs text-zinc-500">Notes</span>
              <input
                className="border px-2 py-1 rounded-md"
                value={form.notes}
                onChange={(e) => setForm({ ...form, notes: e.target.value })}
              />
            </label>
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={save}
              disabled={busy || !form.roomNumber.trim() || !form.roomTypeId}
              className="border px-3 py-1 rounded-md disabled:opacity-50"
            >
              {busy ? "Saving…" : "Save"}
            </button>
            <button type="button" onClick={close} className="border px-3 py-1 rounded-md">
              Cancel
            </button>
          </div>
        </div>
      )}

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b text-left">
              <th className="py-2 pr-3">Room</th>
              <th className="py-2 pr-3">Type</th>
              <th className="py-2 pr-3">Floor</th>
              <th className="py-2 pr-3">Status</th>
              <th className="py-2 pr-3">Notes</th>
              <th className="py-2">Actions</th>
            </tr>
          </thead>
          <tbody>
            {rooms.map((room) => (
              <tr key={room.id} className="border-b last:border-0">
                <td className="py-2 pr-3 font-medium">{room.roomNumber}</td>
                <td className="py-2 pr-3">{room.roomTypeName}</td>
                <td className="py-2 pr-3">{room.floor ?? "—"}</td>
                <td className="py-2 pr-3">{roomStatusLabel(room.status)}</td>
                <td className="py-2 pr-3 text-zinc-500">{room.notes ?? "—"}</td>
                <td className="py-2">
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => openEdit(room)}
                      disabled={busy}
                      className="border px-2 py-1 rounded-md text-xs"
                    >
                      Edit
                    </button>
                    <button
                      type="button"
                      onClick={() => remove(room)}
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
    </section>
  );
}
