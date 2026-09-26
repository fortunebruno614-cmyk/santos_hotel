"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

export interface BookingPopupData {
  bookingId: string;
  roomName: string;
  checkin: string;
  checkout: string;
  totalPrice: number;
  guestName: string;
}

function formatDate(value: string) {
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return d.toLocaleDateString("en-NG", {
    weekday: "short",
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

/**
 * Pops up a confirmation notification on the web app as soon as a booking
 * completes. Also fires a system notification when permission is granted.
 * This is deliberately independent of FCM delivery so it always shows.
 */
export default function BookingConfirmedPopup({ booking }: { booking: BookingPopupData }) {
  const [open, setOpen] = useState(false);
  const [leaving, setLeaving] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setOpen(true), 150);
    return () => clearTimeout(t);
  }, []);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!("Notification" in window)) return;
    if (Notification.permission !== "granted") return;
    try {
      const n = new Notification("Booking Confirmed! ✓", {
        body: `Your reservation for ${booking.roomName} is confirmed. Total ₦${Number(
          booking.totalPrice
        ).toLocaleString()}.`,
        icon: "/favicon.ico",
        tag: "booking-" + booking.bookingId,
      });
      n.onclick = () => {
        window.focus();
        n.close();
      };
    } catch {
      // Some browsers block constructor notifications; the in-app popup still shows.
    }
  }, [booking]);

  function close() {
    setLeaving(true);
    setTimeout(() => setOpen(false), 180);
  }

  if (!open) return null;

  return (
    <div
      className={`bookingPopupOverlay ${leaving ? "isLeaving" : ""}`}
      onClick={close}
      role="dialog"
      aria-modal="true"
      aria-label="Booking confirmed"
    >
      <div className="bookingPopup" onClick={(e) => e.stopPropagation()}>
        <button className="bookingPopupClose" onClick={close} aria-label="Close">
          ×
        </button>

        <div className="bookingPopupIcon">✓</div>
        <h2>Booking Confirmed!</h2>
        <p className="bookingPopupSub">
          Hi {booking.guestName}, your reservation is all set.
        </p>

        <div className="bookingPopupDetails">
          <div className="bookingPopupRow">
            <span>Room</span>
            <strong>{booking.roomName}</strong>
          </div>
          <div className="bookingPopupRow">
            <span>Check-in</span>
            <strong>{formatDate(booking.checkin)}</strong>
          </div>
          <div className="bookingPopupRow">
            <span>Check-out</span>
            <strong>{formatDate(booking.checkout)}</strong>
          </div>
          <div className="bookingPopupRow bookingPopupTotal">
            <span>Total Paid</span>
            <strong>₦{Number(booking.totalPrice).toLocaleString()}</strong>
          </div>
        </div>

        <div className="bookingPopupActions">
          <Link
            className="btn btnPrimary"
            href={`/dashboard/bookings?highlight=${booking.bookingId}`}
            onClick={close}
          >
            View My Bookings →
          </Link>
          <button className="btn" onClick={close}>
            Continue
          </button>
        </div>
      </div>
    </div>
  );
}
