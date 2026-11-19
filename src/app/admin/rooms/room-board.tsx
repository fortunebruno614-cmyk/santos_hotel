"use client";

import { useState } from "react";
import {
  Card,
  CardHeader,
  StatusBadge,
  TableShell,
} from "@/components/admin/ui";
import { Button } from "@/components/ui/button";
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
    <tr>
      <td className="admin-cell-strong whitespace-nowrap">{room.roomNumber}</td>
      <td className="admin-cell-muted">{room.roomTypeName}</td>
      <td>{room.floor ?? "—"}</td>
      <td>
        <StatusBadge status={room.status} label={roomStatusLabel(room.status)} />
      </td>
      <td>
        <select
          value={target}
          onChange={(event) => setTarget(event.target.value as RoomStatus | "")}
          className="w-auto"
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
      <td className="text-right">
        <div className="flex items-center justify-end gap-2">
          <Button
            type="button"
            onClick={save}
            disabled={busy || !target || target === room.status}
            size="sm"
          >
            {busy ? "Saving…" : "Apply"}
          </Button>
          {error && <p className="text-xs text-red-600">{error}</p>}
        </div>
      </td>
    </tr>
  );
}

export function RoomBoard({ rooms }: { rooms: BoardRoom[] }) {
  return (
    <Card>
      <CardHeader
        title="Status board"
        description="Live housekeeping state for every room. Only legal transitions are offered."
      />
      <TableShell className="rounded-t-none border-0 shadow-none">
        <thead>
          <tr>
            <th>Room</th>
            <th>Type</th>
            <th>Floor</th>
            <th>Status</th>
            <th>Change to</th>
            <th className="text-right">Action</th>
          </tr>
        </thead>
        <tbody>
          {rooms.map((room) => (
            <StatusRow key={room.id} room={room} />
          ))}
        </tbody>
      </TableShell>
    </Card>
  );
}
