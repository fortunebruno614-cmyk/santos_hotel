import type React from "react";
import { createContext, useContext, useState, type ReactNode } from "react";
import { rooms, nightsBetween, money, type Room } from "@/lib/hotel-data";
type Booking = {
  checkIn: string;
  checkOut: string;
  adults: number;
  children: number;
  quantity: number;
  roomId: string;
};
const initial: Booking = {
  checkIn: "2026-11-20",
  checkOut: "2026-11-23",
  adults: 2,
  children: 0,
  quantity: 1,
  roomId: "deluxe-king",
};
type Ctx = {
  booking: Booking;
  update: (v: Partial<Booking>) => void;
  selected: Room;
  nights: number;
  currency: string;
  setCurrency: (v: string) => void;
  price: (v: number) => string;
};
// Singleton so hot reloads never create a second, empty context instance.
const g = globalThis as unknown as { __santoBookingCtx?: React.Context<Ctx | null> };
const Context = (g.__santoBookingCtx ??= createContext<Ctx | null>(null));
export function BookingProvider({ children }: { children: ReactNode }) {
  const [booking, setBooking] = useState(initial);
  const [currency, setCurrency] = useState("USD");
  const selected = rooms.find((r) => r.id === booking.roomId) ?? rooms[0];
  if (!selected) throw new Error("No sample rooms configured");
  return (
    <Context.Provider
      value={{
        booking,
        update: (v) => setBooking((b) => ({ ...b, ...v })),
        selected,
        nights: nightsBetween(booking.checkIn, booking.checkOut),
        currency,
        setCurrency,
        price: (v) => money(v, currency),
      }}
    >
      {children}
    </Context.Provider>
  );
}
export function useBooking() {
  const value = useContext(Context);
  if (!value) throw new Error("Booking context required");
  return value;
}
