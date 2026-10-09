"use client";

import { useEffect, useState } from "react";
import { BookingStatus } from "@/generated/prisma/enums";
import { bookingStatusLabel } from "@/components/labels";

/**
 * Staff control panel for one reservation: guarded transitions (confirm,
 * check-in, check-out, no-show, cancel), modification (dates / occupancy /
 * rooms / promotion / notes) and operational notes. Every action hits the
 * staff API; the service re-applies the transition table, the arrival-date
 * timing and the cancellation window server-side.
 */

type RoomLine = {
  roomId: string;
  roomNumber: string;
  roomTypeName: string;
  nightlyRate: string;
  nights: number;
  roomTotal: string;
};

type Booking = {
  id: string;
  bookingReference: string;
  bookingStatus: BookingStatus;
  checkIn: string;
  checkOut: string;
  adults: number;
  children: number;
  currency: string;
  breakdown: { subtotal: string; taxes: string; fees: string; discount: string; total: string };
  rooms: RoomLine[];
  allowedTransitions: BookingStatus[];
  cancellation: { deadline: string | null; guestAllowed: boolean; staffAllowed: boolean };
  notes: string | null;
  promotionCode: string | null;
};

const TRANSITION_LABELS: Record<string, string> = {
  CONFIRMED: "Confirm",
  CHECKED_IN: "Check in",
  CHECKED_OUT: "Check out",
  CANCELLED: "Cancel reservation",
  NO_SHOW: "Mark no-show",
};

const ERROR_MESSAGES: Record<string, string> = {
  invalid_transition: "That status change is not allowed.",
  check_in_not_allowed: "Check-in opens on the arrival date.",
  check_out_not_allowed: "A stay cannot end before it begins.",
  no_show_not_allowed: "A guest cannot be marked no-show before the arrival date.",
  room_not_ready: "One of the rooms is not ready (maintenance/out of service).",
  invalid_room_transition: "That room status change is not allowed.",
  not_cancellable: "This reservation can no longer be cancelled.",
  too_late_to_cancel: "The free cancellation window has passed.",
  not_modifiable: "This reservation can no longer be modified.",
  check_in_past: "That stay would start in the past.",
  invalid_date_range: "Check-out must be after check-in.",
  stay_too_long: "That stay is longer than the 60-night limit.",
  price_changed: "The price changed while modifying.",
  unavailable: "The requested rooms are no longer available.",
  invalid_body: "Please check the fields.",
  not_found: "Reservation not found.",
  internal: "Something went wrong.",
};

function messageFor(error: string): string {
  return ERROR_MESSAGES[error] ?? ERROR_MESSAGES.internal;
}

type AvailabilityRoom = { id: string; roomNumber: string; floor: number | null };
type AvailabilityType = {
  id: string;
  name: string;
  availableCount: number;
  availableRooms: AvailabilityRoom[];
};

export function BookingActions({ booking }: { booking: Booking }) {
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [checkIn, setCheckIn] = useState(booking.checkIn);
  const [checkOut, setCheckOut] = useState(booking.checkOut);
  const [adults, setAdults] = useState(booking.adults);
  const [children, setChildren] = useState(booking.children);
  const [promotionCode, setPromotionCode] = useState(booking.promotionCode ?? "");
  const [modifyNotes, setModifyNotes] = useState(booking.notes ?? "");

  const [showRoomChange, setShowRoomChange] = useState(false);
  const [types, setTypes] = useState<AvailabilityType[]>([]);
  const [roomIds, setRoomIds] = useState<string[]>(booking.rooms.map((line) => line.roomId));

  const stayChanged =
    checkIn !== booking.checkIn ||
    checkOut !== booking.checkOut ||
    adults !== booking.adults ||
    children !== booking.children;

  const run = async (path: string, method: string, payload: unknown) => {
    setBusy(true);
    setError(null);
    try {
      const response = await fetch(path, {
        method,
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload ?? {}),
      });
      if (!response.ok) {
        const body = await response.json().catch(() => ({}));
        setError(messageFor(String(body.error ?? "internal")));
        return false;
      }
      window.location.reload();
      return true;
    } catch {
      setError(ERROR_MESSAGES.internal);
      return false;
    } finally {
      setBusy(false);
    }
  };

  const transition = (to: BookingStatus) =>
    run(`/api/staff/bookings/${booking.id}/transition`, "POST", {
      to,
      note: note.trim() || undefined,
    });

  const saveModify = () =>
    run(`/api/staff/bookings/${booking.id}`, "PATCH", {
      checkIn,
      checkOut,
      adults,
      children,
      roomIds,
      promotionCode: promotionCode.trim() || null,
      notes: modifyNotes.trim() || null,
    });

  const addNote = () => {
    if (!note.trim()) {
      setError("Write a note first.");
      return;
    }
    return run(`/api/staff/bookings/${booking.id}/notes`, "POST", { note: note.trim() });
  };

  // Room re-selection for a modified stay: the same public availability search
  // the desk form uses (the service re-checks under lock anyway).
  useEffect(() => {
    if (!showRoomChange) return;
    let stale = false;
    (async () => {
      const params = new URLSearchParams({
        checkIn,
        checkOut,
        adults: String(adults),
        children: String(children),
      });
      const response = await fetch(`/api/public/availability?${params}`);
      const body = await response.json().catch(() => ({}));
      if (stale || !response.ok) return;
      setTypes(body.roomTypes ?? []);
    })();
    return () => {
      stale = true;
    };
  }, [showRoomChange, checkIn, checkOut, adults, children]);

  const toggleRoom = (id: string) =>
    setRoomIds((current) =>
      current.includes(id) ? current.filter((row) => row !== id) : [...current, id],
    );

  const modifiable = booking.bookingStatus === "PENDING" || booking.bookingStatus === "CONFIRMED";
  const availableIds = new Set(types.flatMap((type) => type.availableRooms.map((room) => room.id)));
  const heldNotListed = booking.rooms.filter((line) => !availableIds.has(line.roomId));

  return (
    <div className="space-y-6">
      <section className="space-y-3 rounded-xl border p-4">
        <h2 className="font-medium">Status: {bookingStatusLabel(booking.bookingStatus)}</h2>
        {booking.allowedTransitions.length > 0 ? (
          <div className="flex flex-wrap gap-2">
            {booking.allowedTransitions.map((to) => (
              <button
                key={to}
                type="button"
                disabled={busy}
                onClick={() => transition(to)}
                className={`border px-4 py-2 rounded-md text-sm font-medium disabled:opacity-50 ${
                  to === "CANCELLED" ? "border-red-300 text-red-700" : ""
                }`}
              >
                {TRANSITION_LABELS[to] ?? to}
              </button>
            ))}
          </div>
        ) : (
          <p className="text-sm text-zinc-500">No further status changes are available.</p>
        )}
        {booking.cancellation.deadline && (
          <p className="text-sm text-zinc-500">
            Guest free-cancellation deadline:{" "}
            {new Date(booking.cancellation.deadline).toISOString().replace("T", " ").slice(0, 16)}{" "}
            UTC
          </p>
        )}
        <label className="block space-y-1 text-sm">
          <span>Optional note for this action</span>
          <textarea
            value={note}
            onChange={(event) => setNote(event.target.value)}
            rows={2}
            maxLength={500}
            className="w-full border px-3 py-2 rounded-md"
          />
        </label>
        <button
          type="button"
          disabled={busy || !note.trim()}
          onClick={addNote}
          className="border px-3 py-1 rounded-md text-sm disabled:opacity-50"
        >
          Add operational note
        </button>
      </section>

      {modifiable && (
        <section className="space-y-3 rounded-xl border p-4">
          <h2 className="font-medium">Modify</h2>
          <div className="grid gap-3 sm:grid-cols-4">
            <label className="space-y-1 text-sm">
              <span>Check-in</span>
              <input
                type="date"
                value={checkIn}
                onChange={(event) => setCheckIn(event.target.value)}
                className="w-full border px-3 py-2 rounded-md"
              />
            </label>
            <label className="space-y-1 text-sm">
              <span>Check-out</span>
              <input
                type="date"
                value={checkOut}
                onChange={(event) => setCheckOut(event.target.value)}
                className="w-full border px-3 py-2 rounded-md"
              />
            </label>
            <label className="space-y-1 text-sm">
              <span>Adults</span>
              <input
                type="number"
                min={1}
                max={20}
                value={adults}
                onChange={(event) => setAdults(Number(event.target.value))}
                className="w-full border px-3 py-2 rounded-md"
              />
            </label>
            <label className="space-y-1 text-sm">
              <span>Children</span>
              <input
                type="number"
                min={0}
                max={20}
                value={children}
                onChange={(event) => setChildren(Number(event.target.value))}
                className="w-full border px-3 py-2 rounded-md"
              />
            </label>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="space-y-1 text-sm">
              <span>Promotion code (empty = remove)</span>
              <input
                value={promotionCode}
                onChange={(event) => setPromotionCode(event.target.value)}
                className="w-full border px-3 py-2 rounded-md"
                maxLength={40}
              />
            </label>
            <label className="space-y-1 text-sm">
              <span>Notes (replaces)</span>
              <textarea
                value={modifyNotes}
                onChange={(event) => setModifyNotes(event.target.value)}
                rows={2}
                maxLength={500}
                className="w-full border px-3 py-2 rounded-md"
              />
            </label>
          </div>

          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={showRoomChange}
              onChange={(event) => setShowRoomChange(event.target.checked)}
            />
            Change room allocation {stayChanged ? "" : "(re-check rooms for the same stay)"}
          </label>
          {showRoomChange && (
            <div className="space-y-2 text-sm">
              {types.length === 0 && <p className="text-zinc-500">Loading available rooms…</p>}
              {types.map((type) => (
                <div key={type.id}>
                  <p className="font-medium">
                    {type.name}{" "}
                    <span className="font-normal text-zinc-500">({type.availableCount} free)</span>
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {type.availableRooms.map((room) => (
                      <label key={room.id} className="cursor-pointer rounded-md border px-2 py-1">
                        <input
                          type="checkbox"
                          className="mr-1"
                          checked={roomIds.includes(room.id)}
                          onChange={() => toggleRoom(room.id)}
                        />
                        {room.roomNumber}
                      </label>
                    ))}
                  </div>
                </div>
              ))}
              {heldNotListed.length > 0 && (
                <div>
                  <p className="font-medium">Currently allocated (blocked for these dates)</p>
                  <div className="flex flex-wrap gap-2">
                    {heldNotListed.map((line) => (
                      <label key={line.roomId} className="cursor-pointer rounded-md border px-2 py-1">
                        <input
                          type="checkbox"
                          className="mr-1"
                          checked={roomIds.includes(line.roomId)}
                          onChange={() => toggleRoom(line.roomId)}
                        />
                        {line.roomNumber} ({line.roomTypeName})
                      </label>
                    ))}
                  </div>
                </div>
              )}
              <p className="text-xs text-zinc-500">
                Tick the rooms to keep; untick to release them.
              </p>
            </div>
          )}

          <button
            type="button"
            disabled={busy}
            onClick={saveModify}
            className="border px-4 py-2 rounded-md text-sm font-medium disabled:opacity-50"
          >
            Save changes (re-priced)
          </button>
        </section>
      )}

      {error && <p className="text-sm text-red-600">{error}</p>}
    </div>
  );
}
