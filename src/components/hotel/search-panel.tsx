"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { BedDouble, CalendarDays, Search, UsersRound } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useT } from "@/components/hotel/locale-provider";
import { addDays, searchHref, type StayQuery } from "@/lib/hotel";

export function SearchPanel({
  defaults,
  compact = false,
}: {
  defaults: StayQuery;
  compact?: boolean;
}) {
  const router = useRouter();
  const t = useT();
  const [checkIn, setCheckIn] = useState(defaults.checkIn);
  const [checkOut, setCheckOut] = useState(defaults.checkOut);
  const [adults, setAdults] = useState(defaults.adults);
  const [children, setChildren] = useState(defaults.children);
  const [quantity, setQuantity] = useState(defaults.quantity);
  const [error, setError] = useState("");

  const submit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (checkOut <= checkIn) {
      setError(t("search.errorDates"));
      return;
    }
    setError("");
    router.push(searchHref({ checkIn, checkOut, adults, children, quantity }));
  };

  return (
    <form className={`search-panel ${compact ? "compact" : ""}`} onSubmit={submit}>
      <label className="search-field">
        <span>
          <CalendarDays /> {t("search.checkIn")}
        </span>
        <input
          aria-label={t("search.aria.checkIn")}
          type="date"
          required
          value={checkIn}
          onChange={(event) => setCheckIn(event.target.value)}
        />
      </label>
      <label className="search-field">
        <span>
          <CalendarDays /> {t("search.checkOut")}
        </span>
        <input
          aria-label={t("search.aria.checkOut")}
          type="date"
          required
          value={checkOut}
          min={addDays(checkIn, 1)}
          onChange={(event) => setCheckOut(event.target.value)}
        />
      </label>
      <label className="search-field small">
        <span>
          <UsersRound /> {t("search.adults")}
        </span>
        <select
          aria-label={t("search.aria.adults")}
          value={adults}
          onChange={(event) => setAdults(Number(event.target.value))}
        >
          {[1, 2, 3, 4, 5, 6].map((value) => (
            <option key={value} value={value}>
              {value} {value === 1 ? t("search.adult") : t("search.adultsPlural")}
            </option>
          ))}
        </select>
      </label>
      <label className="search-field small">
        <span>{t("search.children")}</span>
        <select
          aria-label={t("search.aria.children")}
          value={children}
          onChange={(event) => setChildren(Number(event.target.value))}
        >
          {[0, 1, 2, 3, 4].map((value) => (
            <option key={value} value={value}>
              {value} {value === 1 ? t("search.child") : t("search.childrenPlural")}
            </option>
          ))}
        </select>
      </label>
      <label className="search-field small">
        <span>
          <BedDouble /> {t("search.roomsLabel")}
        </span>
        <select
          aria-label={t("search.aria.rooms")}
          value={quantity}
          onChange={(event) => setQuantity(Number(event.target.value))}
        >
          {[1, 2, 3].map((value) => (
            <option key={value} value={value}>
              {value} {value === 1 ? t("search.room") : t("search.roomsPlural")}
            </option>
          ))}
        </select>
      </label>
      <Button type="submit" size="lg" className="search-submit">
        <Search size={17} />
        {t("search.submit")}
      </Button>
      {error && (
        <p role="alert" className="form-error">
          {error}
        </p>
      )}
    </form>
  );
}
