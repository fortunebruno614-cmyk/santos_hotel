"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Card,
  CardBody,
  CardHeader,
  Field,
  InlineError,
} from "@/components/admin/ui";
import { Button } from "@/components/ui/button";

/**
 * Walk-in / phone booking form (staff). Mirrors the public checkout: search
 * availability, pick rooms, let the server price the stay, then POST to
 * `/api/staff/bookings` with the quoted total. `confirm: true` creates the
 * reservation as CONFIRMED for a guest paying at the desk.
 */

type AvailabilityRoom = { id: string; roomNumber: string; floor: number | null };
type AvailabilityType = {
  id: string;
  name: string;
  slug: string;
  availableCount: number;
  availableRooms: AvailabilityRoom[];
};
type Quote = {
  currency: string;
  nights: number;
  lines: Array<{
    roomId: string;
    roomNumber: string;
    roomTypeName: string;
    nightlyRate: string;
    roomTotal: string;
    perNight: string[];
  }>;
  breakdown: {
    subtotal: string;
    taxes: string;
    fees: string;
    discount: string;
    total: string;
  };
};

const ERROR_MESSAGES: Record<string, string> = {
  invalid_body: "Please check the form fields.",
  price_changed: "The price changed while you were booking — review the total and try again.",
  unavailable: "Those rooms are no longer available for the selected dates.",
  check_in_past: "That stay would start in the past.",
  promotion_not_found: "That promotion code does not exist.",
  promotion_inactive: "That promotion is not currently active.",
  promotion_expired: "That promotion is no longer valid.",
  promotion_exhausted: "That promotion has been fully redeemed.",
  too_many_rooms: "That is more rooms than a single reservation may hold.",
  invalid_query: "Please choose valid dates and party size.",
  invalid_date_range: "Check-out must be after check-in.",
  stay_too_long: "That stay is longer than the 60-night limit.",
  invalid_occupancy: "Party size must be 1–20 adults and 0–20 children.",
  internal: "Something went wrong creating the booking.",
};

function messageFor(error: string): string {
  return ERROR_MESSAGES[error] ?? ERROR_MESSAGES.internal;
}

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

export function ManualBookingForm() {
  const router = useRouter();
  const [checkIn, setCheckIn] = useState(todayIso());
  const [checkOut, setCheckOut] = useState("");
  const [adults, setAdults] = useState(2);
  const [children, setChildren] = useState(0);

  const [types, setTypes] = useState<AvailabilityType[]>([]);
  const [selected, setSelected] = useState<string[]>([]);
  const [quote, setQuote] = useState<Quote | null>(null);

  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [idType, setIdType] = useState("");
  const [idNumber, setIdNumber] = useState("");
  const [promotionCode, setPromotionCode] = useState("");
  const [notes, setNotes] = useState("");
  const [confirmAtDesk, setConfirmAtDesk] = useState(false);

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const toggleRoom = (id: string) => {
    const next = selected.includes(id)
      ? selected.filter((row) => row !== id)
      : [...selected, id];
    setSelected(next);
    if (next.length === 0) setQuote(null);
  };

  const checkAvailability = async () => {
    setError(null);
    setQuote(null);
    setSelected([]);
    setTypes([]);
    const params = new URLSearchParams({
      checkIn,
      checkOut,
      adults: String(adults),
      children: String(children),
    });
    const response = await fetch(`/api/public/availability?${params}`);
    const body = await response.json().catch(() => ({}));
    if (!response.ok) {
      setError(messageFor(String(body.error ?? "invalid_query")));
      return;
    }
    setTypes(body.roomTypes ?? []);
  };

  // Keep the price honest: re-quote every time the allocation or promotion moves.
  useEffect(() => {
    if (selected.length === 0 || !checkIn || !checkOut) return;
    let stale = false;
    (async () => {
      const params = new URLSearchParams({
        checkIn,
        checkOut,
        adults: String(adults),
        children: String(children),
        rooms: selected.join(","),
      });
      if (promotionCode.trim()) params.set("promotionCode", promotionCode.trim());
      const response = await fetch(`/api/public/quote?${params}`);
      const body = await response.json().catch(() => ({}));
      if (stale) return;
      if (!response.ok) {
        setQuote(null);
        setError(messageFor(String(body.error ?? "internal")));
        return;
      }
      setError(null);
      setQuote(body as Quote);
    })();
    return () => {
      stale = true;
    };
  }, [selected, promotionCode, checkIn, checkOut, adults, children]);

  const submit = async () => {
    if (!quote) {
      setError("Check availability and pick rooms first.");
      return;
    }
    if (!firstName.trim() || !lastName.trim()) {
      setError("Guest name is required.");
      return;
    }
    if (email.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      setError("That email address does not look valid.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const response = await fetch("/api/staff/bookings", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          checkIn,
          checkOut,
          adults,
          children,
          roomIds: selected,
          guest: {
            firstName: firstName.trim(),
            lastName: lastName.trim(),
            email: email.trim() || undefined,
            phone: phone.trim() || undefined,
            idType: idType.trim() || undefined,
            idNumber: idNumber.trim() || undefined,
          },
          promotionCode: promotionCode.trim() || undefined,
          notes: notes.trim() || undefined,
          expectedTotal: quote.breakdown.total,
          confirm: confirmAtDesk,
        }),
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) {
        setError(messageFor(String(body.error ?? "internal")));
        return;
      }
      router.push(`/admin/bookings/${body.booking.id}`);
    } catch {
      setError(ERROR_MESSAGES.internal);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="max-w-4xl space-y-5">
      <Card>
        <CardHeader
          title="Stay"
          description="Search the same availability engine the public checkout uses."
        />
        <CardBody className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-4">
            <Field label="Check-in" required>
              <input
                type="date"
                required
                min={todayIso()}
                value={checkIn}
                onChange={(event) => setCheckIn(event.target.value)}
              />
            </Field>
            <Field label="Check-out" required>
              <input
                type="date"
                required
                min={checkIn || todayIso()}
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
          <Button type="button" onClick={checkAvailability} variant="outline">
            Check availability
          </Button>
        </CardBody>
      </Card>

      {types.length > 0 && (
        <Card>
          <CardHeader
            title="Rooms"
            description="Tick every room this reservation should hold for the selected dates."
          />
          <CardBody className="space-y-4">
            {types.map((type) => (
              <div key={type.id} className="space-y-2">
                <p className="text-sm font-medium">
                  {type.name}{" "}
                  <span className="font-normal text-muted-foreground">
                    ({type.availableCount} free)
                  </span>
                </p>
                {type.availableRooms.length === 0 ? (
                  <p className="text-sm text-muted-foreground">Sold out for these dates.</p>
                ) : (
                  <div className="flex flex-wrap gap-2">
                    {type.availableRooms.map((room) => {
                      const checked = selected.includes(room.id);
                      return (
                        <label
                          key={room.id}
                          className={`inline-flex cursor-pointer items-center gap-2 rounded-lg border px-3 py-1.5 text-sm transition-colors ${
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
                )}
              </div>
            ))}
          </CardBody>
        </Card>
      )}

      {quote && (
        <Card>
          <CardHeader title={`Price — ${quote.nights} nights`} description="Server-priced quote for the selected rooms." />
          <CardBody className="space-y-3 text-sm">
            <ul className="space-y-1">
              {quote.lines.map((line) => (
                <li key={line.roomId} className="flex flex-wrap items-baseline justify-between gap-2 border-b border-[var(--admin-line)] pb-2 last:border-0">
                  <span>
                    {line.roomTypeName} · Room {line.roomNumber}
                    <span className="ml-2 text-xs text-muted-foreground">({line.perNight.join(" + ")})</span>
                  </span>
                  <span className="tabular-nums">
                    {quote.currency} {line.roomTotal}
                  </span>
                </li>
              ))}
            </ul>
            <dl className="space-y-1">
              <div className="flex justify-between gap-3 text-muted-foreground">
                <dt>Subtotal</dt>
                <dd className="tabular-nums">{quote.currency} {quote.breakdown.subtotal}</dd>
              </div>
              <div className="flex justify-between gap-3 text-muted-foreground">
                <dt>Discount</dt>
                <dd className="tabular-nums">−{quote.currency} {quote.breakdown.discount}</dd>
              </div>
              <div className="flex justify-between gap-3 text-muted-foreground">
                <dt>Taxes</dt>
                <dd className="tabular-nums">{quote.currency} {quote.breakdown.taxes}</dd>
              </div>
              <div className="flex justify-between gap-3 text-muted-foreground">
                <dt>Fees</dt>
                <dd className="tabular-nums">{quote.currency} {quote.breakdown.fees}</dd>
              </div>
              <div className="flex justify-between gap-3 border-t border-[var(--admin-line)] pt-2 text-base font-semibold">
                <dt>Total</dt>
                <dd className="tabular-nums">{quote.currency} {quote.breakdown.total}</dd>
              </div>
            </dl>
          </CardBody>
        </Card>
      )}

      <Card>
        <CardHeader
          title="Guest"
          description="Only a first and last name are required. Contact details let the confirmation emails reach the guest."
        />
        <CardBody className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="First name" required>
              <input
                required
                value={firstName}
                onChange={(event) => setFirstName(event.target.value)}
                maxLength={80}
              />
            </Field>
            <Field label="Last name" required>
              <input
                required
                value={lastName}
                onChange={(event) => setLastName(event.target.value)}
                maxLength={80}
              />
            </Field>
            <Field label="Email">
              <input
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                maxLength={200}
              />
            </Field>
            <Field label="Phone">
              <input
                value={phone}
                onChange={(event) => setPhone(event.target.value)}
                maxLength={40}
              />
            </Field>
            <Field label="ID type">
              <input
                value={idType}
                onChange={(event) => setIdType(event.target.value)}
                maxLength={40}
              />
            </Field>
            <Field label="ID number">
              <input
                value={idNumber}
                onChange={(event) => setIdNumber(event.target.value)}
                maxLength={60}
              />
            </Field>
            <Field label="Promotion code" className="sm:col-span-2">
              <input
                value={promotionCode}
                onChange={(event) => setPromotionCode(event.target.value)}
                maxLength={40}
              />
            </Field>
          </div>
          <Field label="Notes">
            <textarea
              value={notes}
              onChange={(event) => setNotes(event.target.value)}
              rows={2}
              maxLength={500}
            />
          </Field>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={confirmAtDesk}
              onChange={(event) => setConfirmAtDesk(event.target.checked)}
            />
            Confirm now (guest is paying / arriving at the desk)
          </label>
        </CardBody>
      </Card>

      <InlineError>{error}</InlineError>

      <div className="sticky bottom-0 z-10 flex justify-end rounded-xl border border-[var(--admin-line)] bg-card/95 px-4 py-3 shadow-[var(--shadow-soft)] backdrop-blur">
        <Button type="button" onClick={submit} disabled={busy || !quote}>
          {busy ? "Creating…" : "Create booking"}
        </Button>
      </div>
    </div>
  );
}
