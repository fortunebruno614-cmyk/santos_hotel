"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

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
    <div className="max-w-3xl space-y-6">
      <section className="space-y-3 rounded-xl border p-4">
        <h2 className="font-medium">Stay</h2>
        <div className="grid gap-3 sm:grid-cols-4">
          <label className="space-y-1 text-sm">
            <span>Check-in *</span>
            <input
              type="date"
              required
              min={todayIso()}
              value={checkIn}
              onChange={(event) => setCheckIn(event.target.value)}
              className="w-full border px-3 py-2 rounded-md"
            />
          </label>
          <label className="space-y-1 text-sm">
            <span>Check-out *</span>
            <input
              type="date"
              required
              min={checkIn || todayIso()}
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
        <button
          type="button"
          onClick={checkAvailability}
          className="border px-4 py-2 rounded-md text-sm font-medium"
        >
          Check availability
        </button>
      </section>

      {types.length > 0 && (
        <section className="space-y-3 rounded-xl border p-4">
          <h2 className="font-medium">Rooms</h2>
          {types.map((type) => (
            <div key={type.id} className="space-y-1">
              <p className="text-sm font-medium">
                {type.name}{" "}
                <span className="font-normal text-zinc-500">({type.availableCount} free)</span>
              </p>
              {type.availableRooms.length === 0 ? (
                <p className="text-sm text-zinc-500">Sold out for these dates.</p>
              ) : (
                <div className="flex flex-wrap gap-2">
                  {type.availableRooms.map((room) => (
                    <label
                      key={room.id}
                      className={`cursor-pointer rounded-md border px-3 py-1 text-sm ${
                        selected.includes(room.id) ? "border-black font-medium dark:border-white" : ""
                      }`}
                    >
                      <input
                        type="checkbox"
                        className="mr-2"
                        checked={selected.includes(room.id)}
                        onChange={() => toggleRoom(room.id)}
                      />
                      {room.roomNumber}
                    </label>
                  ))}
                </div>
              )}
            </div>
          ))}
        </section>
      )}

      {quote && (
        <section className="space-y-2 rounded-xl border p-4 text-sm">
          <h2 className="font-medium">Price ({quote.nights} nights)</h2>
          <ul className="space-y-1">
            {quote.lines.map((line) => (
              <li key={line.roomId}>
                {line.roomTypeName} · {line.roomNumber} — {quote.currency} {line.roomTotal} (
                {line.perNight.join(" + ")})
              </li>
            ))}
          </ul>
          <p>
            Subtotal {quote.currency} {quote.breakdown.subtotal} · discount −
            {quote.currency} {quote.breakdown.discount} · taxes {quote.currency}{" "}
            {quote.breakdown.taxes} · fees {quote.currency} {quote.breakdown.fees}
          </p>
          <p className="font-medium">
            Total {quote.currency} {quote.breakdown.total}
          </p>
        </section>
      )}

      <section className="space-y-3 rounded-xl border p-4">
        <h2 className="font-medium">Guest</h2>
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="space-y-1 text-sm">
            <span>First name *</span>
            <input
              required
              value={firstName}
              onChange={(event) => setFirstName(event.target.value)}
              className="w-full border px-3 py-2 rounded-md"
              maxLength={80}
            />
          </label>
          <label className="space-y-1 text-sm">
            <span>Last name *</span>
            <input
              required
              value={lastName}
              onChange={(event) => setLastName(event.target.value)}
              className="w-full border px-3 py-2 rounded-md"
              maxLength={80}
            />
          </label>
          <label className="space-y-1 text-sm">
            <span>Email</span>
            <input
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              className="w-full border px-3 py-2 rounded-md"
              maxLength={200}
            />
          </label>
          <label className="space-y-1 text-sm">
            <span>Phone</span>
            <input
              value={phone}
              onChange={(event) => setPhone(event.target.value)}
              className="w-full border px-3 py-2 rounded-md"
              maxLength={40}
            />
          </label>
          <label className="space-y-1 text-sm">
            <span>ID type</span>
            <input
              value={idType}
              onChange={(event) => setIdType(event.target.value)}
              className="w-full border px-3 py-2 rounded-md"
              maxLength={40}
            />
          </label>
          <label className="space-y-1 text-sm">
            <span>ID number</span>
            <input
              value={idNumber}
              onChange={(event) => setIdNumber(event.target.value)}
              className="w-full border px-3 py-2 rounded-md"
              maxLength={60}
            />
          </label>
          <label className="space-y-1 text-sm">
            <span>Promotion code</span>
            <input
              value={promotionCode}
              onChange={(event) => setPromotionCode(event.target.value)}
              className="w-full border px-3 py-2 rounded-md"
              maxLength={40}
            />
          </label>
        </div>
        <label className="block space-y-1 text-sm">
          <span>Notes</span>
          <textarea
            value={notes}
            onChange={(event) => setNotes(event.target.value)}
            rows={2}
            maxLength={500}
            className="w-full border px-3 py-2 rounded-md"
          />
        </label>
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={confirmAtDesk}
            onChange={(event) => setConfirmAtDesk(event.target.checked)}
          />
          Confirm now (guest is paying / arriving at the desk)
        </label>
      </section>

      {error && <p className="text-sm text-red-600">{error}</p>}

      <button
        type="button"
        onClick={submit}
        disabled={busy || !quote}
        className="border px-5 py-2 rounded-md font-medium disabled:opacity-50"
      >
        {busy ? "Creating…" : "Create booking"}
      </button>
    </div>
  );
}
