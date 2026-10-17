"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { BedDouble, CalendarDays, Search, UsersRound } from "lucide-react";
import { Button } from "@/components/ui/button";
import { addDays, searchHref, type StayQuery } from "@/lib/hotel";

export function SearchPanel({
  defaults,
  compact = false,
}: {
  defaults: StayQuery;
  compact?: boolean;
}) {
  const router = useRouter();
  const [checkIn, setCheckIn] = useState(defaults.checkIn);
  const [checkOut, setCheckOut] = useState(defaults.checkOut);
  const [adults, setAdults] = useState(defaults.adults);
  const [children, setChildren] = useState(defaults.children);
  const [quantity, setQuantity] = useState(defaults.quantity);
  const [error, setError] = useState("");

  const submit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (checkOut <= checkIn) {
      setError("Check-out must be after check-in.");
      return;
    }
    setError("");
    router.push(searchHref({ checkIn, checkOut, adults, children, quantity }));
  };

  return (
    <form className={`search-panel ${compact ? "compact" : ""}`} onSubmit={submit}>
      <label className="search-field">
        <span>
          <CalendarDays /> CHECK-IN
        </span>
        <input
          aria-label="Check-in"
          type="date"
          required
          value={checkIn}
          onChange={(event) => setCheckIn(event.target.value)}
        />
      </label>
      <label className="search-field">
        <span>
          <CalendarDays /> CHECK-OUT
        </span>
        <input
          aria-label="Check-out"
          type="date"
          required
          value={checkOut}
          min={addDays(checkIn, 1)}
          onChange={(event) => setCheckOut(event.target.value)}
        />
      </label>
      <label className="search-field small">
        <span>
          <UsersRound /> ADULTS
        </span>
        <select
          aria-label="Adults"
          value={adults}
          onChange={(event) => setAdults(Number(event.target.value))}
        >
          {[1, 2, 3, 4, 5, 6].map((value) => (
            <option key={value} value={value}>
              {value} {value === 1 ? "Adult" : "Adults"}
            </option>
          ))}
        </select>
      </label>
      <label className="search-field small">
        <span>CHILDREN</span>
        <select
          aria-label="Children"
          value={children}
          onChange={(event) => setChildren(Number(event.target.value))}
        >
          {[0, 1, 2, 3, 4].map((value) => (
            <option key={value} value={value}>
              {value} {value === 1 ? "Child" : "Children"}
            </option>
          ))}
        </select>
      </label>
      <label className="search-field small">
        <span>
          <BedDouble /> ROOMS
        </span>
        <select
          aria-label="Rooms"
          value={quantity}
          onChange={(event) => setQuantity(Number(event.target.value))}
        >
          {[1, 2, 3].map((value) => (
            <option key={value} value={value}>
              {value} {value === 1 ? "Room" : "Rooms"}
            </option>
          ))}
        </select>
      </label>
      <Button type="submit" size="lg" className="search-submit">
        <Search size={17} />
        Search availability
      </Button>
      {error && (
        <p role="alert" className="form-error">
          {error}
        </p>
      )}
    </form>
  );
}
