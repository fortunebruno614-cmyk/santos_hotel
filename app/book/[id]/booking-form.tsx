"use client";

import { useState, useEffect } from "react";
import { initializePayment } from "@/app/actions";
import type { Room } from "@/app/data/rooms";

declare global {
  interface Window {
    PaystackPop?: {
      setup: (config: Record<string, unknown>) => { openIframe: () => void };
    };
  }
}

export default function BookingForm({ room }: { room: Room }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [scriptLoaded, setScriptLoaded] = useState(false);

  useEffect(() => {
    if (document.getElementById("paystack-script")) {
      setScriptLoaded(true);
      return;
    }
    const script = document.createElement("script");
    script.src = "https://js.paystack.co/v1/inline.js";
    script.id = "paystack-script";
    script.onload = () => setScriptLoaded(true);
    document.head.appendChild(script);
  }, []);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    const form = e.currentTarget;
    const formData = new FormData(form);

    const checkin = formData.get("checkin") as string;
    const checkout = formData.get("checkout") as string;
    const guests = formData.get("guests") as string;
    const name = formData.get("name") as string;
    const email = formData.get("email") as string;
    const phone = formData.get("phone") as string;

    if (!checkin || !checkout || !name || !email || !phone) {
      setError("All fields are required.");
      setLoading(false);
      return;
    }

    const checkinDate = new Date(checkin);
    const checkoutDate = new Date(checkout);

    if (checkoutDate <= checkinDate) {
      setError("Check-out date must be after check-in date.");
      setLoading(false);
      return;
    }

    const nights = Math.ceil((checkoutDate.getTime() - checkinDate.getTime()) / (1000 * 60 * 60 * 24));
    const totalPrice = nights * room.price;

    const result = await initializePayment(email, totalPrice, {
      room_id: String(room.id),
      room_name: room.name,
      checkin,
      checkout,
      guests,
      full_name: name,
      email,
      phone,
      total_price: String(totalPrice),
    });

    if (result.error) {
      setError(result.error);
      setLoading(false);
      return;
    }

    if (!window.PaystackPop) {
      setError("Payment system is loading. Please try again.");
      setLoading(false);
      return;
    }

    const handler = window.PaystackPop.setup({
      key: process.env.NEXT_PUBLIC_PAYSTACK_KEY!,
      email,
      amount: totalPrice * 100,
      currency: "NGN",
      ref: result.reference,
      onClose: () => {
        setLoading(false);
        setError("Payment was cancelled. Please try again.");
      },
      callback: (response: { reference: string }) => {
        window.location.href = `/api/verify-payment?reference=${response.reference}`;
      },
    });
    handler.openIframe();
    setLoading(false);
  };

  return (
    <form onSubmit={handleSubmit}>
      <div className="field">
        <label htmlFor="checkin">Check-in date</label>
        <input id="checkin" name="checkin" type="date" required />
      </div>
      <div className="field">
        <label htmlFor="checkout">Check-out date</label>
        <input id="checkout" name="checkout" type="date" required />
      </div>
      <div className="field">
        <label htmlFor="guests">Guests</label>
        <select id="guests" name="guests" required>
          {Array.from({ length: room.capacity }, (_, i) => (
            <option key={i + 1} value={i + 1}>
              {i + 1} {i + 1 === 1 ? "Guest" : "Guests"}
            </option>
          ))}
        </select>
      </div>
      <div className="field">
        <label htmlFor="name">Full name</label>
        <input id="name" name="name" type="text" placeholder="Jane Santos" required />
      </div>
      <div className="field">
        <label htmlFor="email">Email</label>
        <input id="email" name="email" type="email" placeholder="you@example.com" required />
      </div>
      <div className="field">
        <label htmlFor="phone">Phone</label>
        <input id="phone" name="phone" type="tel" placeholder="+234 800 000 000" required />
      </div>

      {error && <div className="authError">{error}</div>}

      <button className="btn btnPrimary btnLarge" type="submit" style={{ width: "100%" }} disabled={loading}>
        {loading ? "Processing..." : `Pay with Paystack — ₦${room.price.toLocaleString()}/night`}
      </button>
    </form>
  );
}
