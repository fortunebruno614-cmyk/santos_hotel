"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

/**
 * Free-room picker for a searched stay: tick one or more rooms, then continue
 * to `/booking` carrying the selection. Purely client-side — the server
 * re-checks availability and re-prices inside the checkout transaction anyway.
 */
type PickableRoom = { id: string; roomNumber: string; floor: number | null };

export function RoomPicker({
  rooms,
  stay,
}: {
  rooms: PickableRoom[];
  stay: { checkIn: string; checkOut: string; adults: number; children: number };
}) {
  const router = useRouter();
  const [selected, setSelected] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);

  const toggle = (id: string) =>
    setSelected((current) =>
      current.includes(id) ? current.filter((row) => row !== id) : [...current, id],
    );

  const continueToBooking = () => {
    if (selected.length === 0) {
      setError("Pick at least one room to continue.");
      return;
    }
    const query = new URLSearchParams({
      checkIn: stay.checkIn,
      checkOut: stay.checkOut,
      adults: String(stay.adults),
      children: String(stay.children),
      roomIds: selected.join(","),
    });
    router.push(`/booking?${query.toString()}`);
  };

  return (
    <div className="space-y-3">
      <ul className="space-y-2">
        {rooms.map((room) => (
          <li key={room.id}>
            <label className="flex cursor-pointer items-center gap-3 rounded-lg border border-black/10 p-3 dark:border-white/15">
              <input
                type="checkbox"
                checked={selected.includes(room.id)}
                onChange={() => toggle(room.id)}
                className="h-4 w-4"
              />
              <span className="font-medium">Room {room.roomNumber}</span>
              {room.floor !== null && (
                <span className="text-sm text-zinc-500">Floor {room.floor}</span>
              )}
            </label>
          </li>
        ))}
      </ul>
      {error && <p className="text-sm text-red-600">{error}</p>}
      <button
        type="button"
        onClick={continueToBooking}
        className="border px-4 py-2 rounded-md text-sm font-medium"
      >
        Continue to booking
      </button>
    </div>
  );
}
