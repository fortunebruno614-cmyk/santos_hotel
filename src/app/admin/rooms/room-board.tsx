"use client";

import { useState } from "react";
import { RoomStatus } from "@/generated/prisma/enums";
import { roomStatusLabel } from "@/components/labels";

/**
 * Housekeeping board: each room shows its current status and the transitions
 * the server currently allows (`OCCUPIED → AVAILABLE` is deliberately absent —
 * check-out first, then Cleaning → Available).
 */

export type BoardRoom = {
  id: string;
  roomNumber: string;
  floor: number | null;
  status: RoomStatus;
  roomTypeName: string;
  allowedTransitions: RoomStatus[];
};

const ERROR_MESSAGES: Record<string, string> = {
  invalid_room_transition: "That room status change is not allowed.",
  room_not_found: "Room not found.",
  internal: "Something went wrong updating the room.",
};

function StatusRow({ room }: { room: BoardRoom }) {
  const [target, setTarget] = useState<RoomStatus | "">(room.status);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const save = async () => {
    if (!target || target === room.status) return;
    setBusy(true);
    setError(null);
    try {
      const response = await fetch(`/api/staff/rooms/${room.id}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ status: target }),
      });
      if (!response.ok) {
        const body = await response.json().catch(() => ({}));
        setError(ERROR_MESSAGES[String(body.error ?? "internal")] ?? ERROR_MESSAGES.internal);
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
    <tr className="border-b last:border-0">
      <td className="py-2 pr-3 font-medium">{room.roomNumber}</td>
      <td className="py-2 pr-3">{room.roomTypeName}</td>
      <td className="py-2 pr-3">{room.floor ?? "—"}</td>
      <td className="py-2 pr-3">{roomStatusLabel(room.status)}</td>
      <td className="py-2 pr-3">
        <select
          value={target}
          onChange={(event) => setTarget(event.target.value as RoomStatus | "")}
          className="border px-2 py-1 rounded-md text-sm"
          disabled={busy || room.allowedTransitions.length === 0}
        >
          <option value="">
            {room.allowedTransitions.length === 0 ? "No changes" : "Move to…"}
          </option>
          {room.allowedTransitions.map((status) => (
            <option key={status} value={status}>
              {roomStatusLabel(status)}
            </option>
          ))}
        </select>
      </td>
      <td className="py-2">
        <button
          type="button"
          onClick={save}
          disabled={busy || !target || target === room.status}
          className="border px-3 py-1 rounded-md text-sm disabled:opacity-50"
        >
          {busy ? "Saving…" : "Apply"}
        </button>
        {error && <p className="mt-1 text-xs text-red-600">{error}</p>}
      </td>
    </tr>
  );
}

export function RoomBoard({ rooms }: { rooms: BoardRoom[] }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b text-left">
            <th className="py-2 pr-3">Room</th>
            <th className="py-2 pr-3">Type</th>
            <th className="py-2 pr-3">Floor</th>
            <th className="py-2 pr-3">Status</th>
            <th className="py-2 pr-3">Change to</th>
            <th className="py-2">Action</th>
          </tr>
        </thead>
        <tbody>
          {rooms.map((room) => (
            <StatusRow key={room.id} room={room} />
          ))}
        </tbody>
      </table>
    </div>
  );
}
