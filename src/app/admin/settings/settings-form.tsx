"use client";

import { useState } from "react";

/**
 * System settings (P7, admin only): hotel profile plus the operational policy
 * the rest of the app reads on every request (tax, service fee, check-in/out
 * times, cancellation window, room cap). Saves are partial — only the changed
 * keys are sent, and only those land in the audit log.
 */

export type SettingsValues = {
  name: string;
  description: string | null;
  phone: string | null;
  email: string | null;
  addressLine1: string | null;
  addressLine2: string | null;
  city: string | null;
  postcode: string | null;
  country: string | null;
  timezone: string;
  currency: string;
  checkInTime: string;
  checkOutTime: string;
  taxRatePercent: string;
  serviceFee: string;
  cancellationWindowHours: number;
  guestCancellationEnabled: boolean;
  maxRoomsPerBooking: number;
};

const ERROR_MESSAGES: Record<string, string> = {
  not_found: "No hotel row — run the database seed.",
  invalid_body: "Please check the form values.",
  internal: "Something went wrong.",
};

function messageFor(error: string | undefined) {
  return (error && ERROR_MESSAGES[error]) || ERROR_MESSAGES.internal;
}

export function SettingsForm({ initial }: { initial: SettingsValues }) {
  const [form, setForm] = useState({
    name: initial.name,
    description: initial.description ?? "",
    phone: initial.phone ?? "",
    email: initial.email ?? "",
    addressLine1: initial.addressLine1 ?? "",
    addressLine2: initial.addressLine2 ?? "",
    city: initial.city ?? "",
    postcode: initial.postcode ?? "",
    country: initial.country ?? "",
    timezone: initial.timezone,
    currency: initial.currency,
    checkInTime: initial.checkInTime,
    checkOutTime: initial.checkOutTime,
    taxRatePercent: initial.taxRatePercent,
    serviceFee: initial.serviceFee,
    cancellationWindowHours: String(initial.cancellationWindowHours),
    guestCancellationEnabled: initial.guestCancellationEnabled,
    maxRoomsPerBooking: String(initial.maxRoomsPerBooking),
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const save = async () => {
    setBusy(true);
    setError(null);
    setSaved(false);
    const body = {
      name: form.name.trim(),
      description: form.description.trim() || null,
      phone: form.phone.trim() || undefined,
      email: form.email.trim() || undefined,
      addressLine1: form.addressLine1.trim() || undefined,
      addressLine2: form.addressLine2.trim() || undefined,
      city: form.city.trim() || undefined,
      postcode: form.postcode.trim() || undefined,
      country: form.country.trim() || undefined,
      timezone: form.timezone.trim(),
      currency: form.currency.trim(),
      checkInTime: form.checkInTime,
      checkOutTime: form.checkOutTime,
      taxRatePercent: Number(form.taxRatePercent),
      serviceFee: form.serviceFee.trim() || "0",
      cancellationWindowHours: Number(form.cancellationWindowHours),
      guestCancellationEnabled: form.guestCancellationEnabled,
      maxRoomsPerBooking: Number(form.maxRoomsPerBooking),
    };
    try {
      const response = await fetch("/api/admin/settings", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!response.ok) {
        const payload = (await response.json().catch(() => ({}))) as { error?: string };
        setError(messageFor(payload.error));
        return;
      }
      setSaved(true);
    } catch {
      setError(ERROR_MESSAGES.internal);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-4">
      {error && <p className="text-sm text-red-600">{error}</p>}
      {saved && <p className="text-sm text-green-700">Settings saved.</p>}

      <section className="border rounded-md p-4 space-y-3">
        <h2 className="font-medium">Hotel profile</h2>
        <div className="flex flex-wrap gap-3 text-sm">
          <Field label="Name">
            <input className="border px-2 py-1 rounded-md w-64" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          </Field>
          <Field label="Phone">
            <input className="border px-2 py-1 rounded-md w-40" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
          </Field>
          <Field label="E-mail">
            <input className="border px-2 py-1 rounded-md w-56" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
          </Field>
          <Field label="Address line 1">
            <input className="border px-2 py-1 rounded-md w-64" value={form.addressLine1} onChange={(e) => setForm({ ...form, addressLine1: e.target.value })} />
          </Field>
          <Field label="Address line 2">
            <input className="border px-2 py-1 rounded-md w-64" value={form.addressLine2} onChange={(e) => setForm({ ...form, addressLine2: e.target.value })} />
          </Field>
          <Field label="City">
            <input className="border px-2 py-1 rounded-md w-40" value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })} />
          </Field>
          <Field label="Postcode">
            <input className="border px-2 py-1 rounded-md w-28" value={form.postcode} onChange={(e) => setForm({ ...form, postcode: e.target.value })} />
          </Field>
          <Field label="Country">
            <input className="border px-2 py-1 rounded-md w-40" value={form.country} onChange={(e) => setForm({ ...form, country: e.target.value })} />
          </Field>
          <Field label="Timezone">
            <input className="border px-2 py-1 rounded-md w-52" value={form.timezone} onChange={(e) => setForm({ ...form, timezone: e.target.value })} />
          </Field>
        </div>
        <Field label="Description">
          <textarea className="border px-2 py-1 rounded-md w-full text-sm" rows={2} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
        </Field>
      </section>

      <section className="border rounded-md p-4 space-y-3">
        <h2 className="font-medium">Policy & pricing</h2>
        <p className="text-xs text-zinc-500">
          These values drive quotes, taxes and the cancellation rules immediately — no restart
          needed. Currency changes only affect future quotes; booked amounts keep the currency
          they were sold in.
        </p>
        <div className="flex flex-wrap gap-3 text-sm">
          <Field label="Currency (ISO)">
            <input className="border px-2 py-1 rounded-md w-24" value={form.currency} onChange={(e) => setForm({ ...form, currency: e.target.value })} />
          </Field>
          <Field label="Tax rate (%)">
            <input className="border px-2 py-1 rounded-md w-24" value={form.taxRatePercent} onChange={(e) => setForm({ ...form, taxRatePercent: e.target.value })} />
          </Field>
          <Field label="Service fee (per booking)">
            <input className="border px-2 py-1 rounded-md w-32" value={form.serviceFee} onChange={(e) => setForm({ ...form, serviceFee: e.target.value })} />
          </Field>
          <Field label="Check-in from">
            <input type="time" className="border px-2 py-1 rounded-md" value={form.checkInTime} onChange={(e) => setForm({ ...form, checkInTime: e.target.value })} />
          </Field>
          <Field label="Check-out by">
            <input type="time" className="border px-2 py-1 rounded-md" value={form.checkOutTime} onChange={(e) => setForm({ ...form, checkOutTime: e.target.value })} />
          </Field>
          <Field label="Free cancellation window (hours before check-in)">
            <input className="border px-2 py-1 rounded-md w-28" value={form.cancellationWindowHours} onChange={(e) => setForm({ ...form, cancellationWindowHours: e.target.value })} />
          </Field>
          <Field label="Max rooms per booking">
            <input className="border px-2 py-1 rounded-md w-28" value={form.maxRoomsPerBooking} onChange={(e) => setForm({ ...form, maxRoomsPerBooking: e.target.value })} />
          </Field>
          <label className="flex items-center gap-2 self-end pb-1 text-sm">
            <input
              type="checkbox"
              checked={form.guestCancellationEnabled}
              onChange={(e) => setForm({ ...form, guestCancellationEnabled: e.target.checked })}
            />
            Guests may cancel online
          </label>
        </div>
      </section>

      <button
        type="button"
        onClick={save}
        disabled={busy || !form.name.trim() || !form.currency.trim()}
        className="border px-4 py-2 rounded-md text-sm font-medium disabled:opacity-50"
      >
        {busy ? "Saving…" : "Save settings"}
      </button>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-xs text-zinc-500">{label}</span>
      {children}
    </label>
  );
}
