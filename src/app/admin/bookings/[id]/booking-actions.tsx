"use client";

import { useEffect, useState } from "react";
import {
  Card,
  CardBody,
  CardHeader,
  Field,
  InlineError,
  StatusBadge,
} from "@/components/admin/ui";
import { Button } from "@/components/ui/button";
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
    <div className="space-y-5">
      <InlineError>{error}</InlineError>

      <Card>
        <CardHeader
          title="Status"
          description="Every change is recorded on the reservation's activity log."
          actions={
            <StatusBadge
              status={booking.bookingStatus}
              label={bookingStatusLabel(booking.bookingStatus)}
            />
          }
        />
        <CardBody className="space-y-3">
          {booking.allowedTransitions.length > 0 ? (
            <div className="flex flex-wrap gap-2">
              {booking.allowedTransitions.map((to) => {
                const destructive = to === "CANCELLED" || to === "NO_SHOW";
                return (
                  <Button
                    key={to}
                    type="button"
                    disabled={busy}
                    onClick={() => transition(to)}
                    variant={destructive ? "outline" : "default"}
                    className={destructive ? "text-red-700 hover:bg-red-50 hover:text-red-800" : undefined}
                  >
                    {TRANSITION_LABELS[to] ?? to}
                  </Button>
                );
              })}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">
              No further status changes are available.
            </p>
          )}
          {booking.cancellation.deadline && (
            <p className="text-xs text-muted-foreground">
              Guest free-cancellation deadline:{" "}
              {new Date(booking.cancellation.deadline)
                .toISOString()
                .replace("T", " ")
                .slice(0, 16)}{" "}
              UTC
            </p>
          )}
          <Field label="Optional note for this action">
            <textarea
              value={note}
              onChange={(event) => setNote(event.target.value)}
              rows={2}
              maxLength={500}
            />
          </Field>
          <Button
            type="button"
            disabled={busy || !note.trim()}
            onClick={addNote}
            variant="outline"
            size="sm"
          >
            Add operational note
          </Button>
        </CardBody>
      </Card>

      {modifiable && (
        <Card>
          <CardHeader
            title="Modify"
            description="Changing dates or occupancy re-prices the stay on save."
          />
          <CardBody className="space-y-4">
            <div className="grid gap-3 sm:grid-cols-4">
              <Field label="Check-in">
                <input
                  type="date"
                  value={checkIn}
                  onChange={(event) => setCheckIn(event.target.value)}
                />
              </Field>
              <Field label="Check-out">
                <input
                  type="date"
                  value={checkOut}
                  onChange={(event) => setCheckOut(event.target.value)}
                />
              </Field>
              <Field label="Adults">
                <input
                  type="number"
                  min={1}
                  max={20}
                  value={adults}
                  onChange={(event) => setAdults(Number(event.target.value))}
                />
              </Field>
              <Field label="Children">
                <input
                  type="number"
                  min={0}
                  max={20}
                  value={children}
                  onChange={(event) => setChildren(Number(event.target.value))}
                />
              </Field>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Promotion code (empty = remove)">
                <input
                  value={promotionCode}
                  onChange={(event) => setPromotionCode(event.target.value)}
                  maxLength={40}
                />
              </Field>
              <Field label="Notes (replaces)">
                <textarea
                  value={modifyNotes}
                  onChange={(event) => setModifyNotes(event.target.value)}
                  rows={2}
                  maxLength={500}
                />
              </Field>
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
              <div className="space-y-3 rounded-xl bg-muted/50 p-4 text-sm">
                {types.length === 0 && (
                  <p className="text-muted-foreground">Loading available rooms…</p>
                )}
                {types.map((type) => (
                  <div key={type.id} className="space-y-2">
                    <p className="font-medium">
                      {type.name}{" "}
                      <span className="font-normal text-muted-foreground">
                        ({type.availableCount} free)
                      </span>
                    </p>
                    <div className="flex flex-wrap gap-2">
                      {type.availableRooms.map((room) => {
                        const checked = roomIds.includes(room.id);
                        return (
                          <label
                            key={room.id}
                            className={`inline-flex cursor-pointer items-center gap-2 rounded-lg border px-2.5 py-1 transition-colors ${
                              checked
                                ? "border-primary/40 bg-primary/10 font-medium text-primary"
                                : "border-[var(--admin-line)] bg-card hover:bg-muted"
                            }`}
                          >
                            <input
                              type="checkbox"
                              checked={checked}
                              onChange={() => toggleRoom(room.id)}
                            />
                            {room.roomNumber}
                          </label>
                        );
                      })}
                    </div>
                  </div>
                ))}
                {heldNotListed.length > 0 && (
                  <div className="space-y-2">
                    <p className="font-medium">Currently allocated (blocked for these dates)</p>
                    <div className="flex flex-wrap gap-2">
                      {heldNotListed.map((line) => {
                        const checked = roomIds.includes(line.roomId);
                        return (
                          <label
                            key={line.roomId}
                            className={`inline-flex cursor-pointer items-center gap-2 rounded-lg border px-2.5 py-1 transition-colors ${
                              checked
                                ? "border-primary/40 bg-primary/10 font-medium text-primary"
                                : "border-[var(--admin-line)] bg-card hover:bg-muted"
                            }`}
                          >
                            <input
                              type="checkbox"
                              checked={checked}
                              onChange={() => toggleRoom(line.roomId)}
                            />
                            {line.roomNumber} ({line.roomTypeName})
                          </label>
                        );
                      })}
                    </div>
                  </div>
                )}
                <p className="text-xs text-muted-foreground">
                  Tick the rooms to keep; untick to release them.
                </p>
              </div>
            )}

            <Button type="button" disabled={busy} onClick={saveModify} size="sm">
              Save changes (re-priced)
            </Button>
          </CardBody>
        </Card>
      )}
    </div>
  );
}
