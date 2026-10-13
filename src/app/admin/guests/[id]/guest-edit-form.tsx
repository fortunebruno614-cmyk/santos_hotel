"use client";

import { useState } from "react";

/**
 * Guest record corrections (P7): contact and ID details staff may fix at the
 * desk. Booking history and payments stay read-only here (booking/payment
 * services own those); every change is audited server-side as `guest.update`.
 */

export type GuestEditValues = {
  id: string;
  firstName: string;
  lastName: string;
  email: string | null;
  phone: string | null;
  idType: string | null;
  idNumber: string | null;
  isActive: boolean;
};

const ERROR_MESSAGES: Record<string, string> = {
  conflict: "Another guest already uses that e-mail.",
  not_found: "Guest not found.",
  invalid_body: "Please check the form values.",
  internal: "Something went wrong.",
};

function messageFor(error: string | undefined) {
  return (error && ERROR_MESSAGES[error]) || ERROR_MESSAGES.internal;
}

export function GuestEditForm({ guest }: { guest: GuestEditValues }) {
  const [form, setForm] = useState({
    firstName: guest.firstName,
    lastName: guest.lastName,
    email: guest.email ?? "",
    phone: guest.phone ?? "",
    idType: guest.idType ?? "",
    idNumber: guest.idNumber ?? "",
    isActive: guest.isActive,
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const save = async () => {
    setBusy(true);
    setError(null);
    setSaved(false);
    try {
      const response = await fetch(`/api/admin/guests/${guest.id}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          firstName: form.firstName.trim(),
          lastName: form.lastName.trim(),
          email: form.email.trim() === "" ? null : form.email.trim().toLowerCase(),
          phone: form.phone.trim() || undefined,
          idType: form.idType.trim() || undefined,
          idNumber: form.idNumber.trim() || undefined,
          isActive: form.isActive,
        }),
      });
      if (!response.ok) {
        const body = (await response.json().catch(() => ({}))) as { error?: string };
        setError(messageFor(body.error));
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
    <div className="border rounded-md p-4 space-y-3 text-sm">
      <div className="flex items-center justify-between">
        <p className="font-medium">Contact & identity</p>
        {saved && <p className="text-xs text-green-700">Saved.</p>}
      </div>
      {error && <p className="text-sm text-red-600">{error}</p>}
      <div className="flex flex-wrap gap-3">
        <Field label="First name">
          <input
            className="border px-2 py-1 rounded-md w-36"
            value={form.firstName}
            onChange={(e) => setForm({ ...form, firstName: e.target.value })}
          />
        </Field>
        <Field label="Last name">
          <input
            className="border px-2 py-1 rounded-md w-36"
            value={form.lastName}
            onChange={(e) => setForm({ ...form, lastName: e.target.value })}
          />
        </Field>
        <Field label="E-mail">
          <input
            className="border px-2 py-1 rounded-md w-56"
            value={form.email}
            onChange={(e) => setForm({ ...form, email: e.target.value })}
          />
        </Field>
        <Field label="Phone">
          <input
            className="border px-2 py-1 rounded-md w-40"
            value={form.phone}
            onChange={(e) => setForm({ ...form, phone: e.target.value })}
          />
        </Field>
        <Field label="ID type">
          <input
            className="border px-2 py-1 rounded-md w-32"
            value={form.idType}
            placeholder="Passport"
            onChange={(e) => setForm({ ...form, idType: e.target.value })}
          />
        </Field>
        <Field label="ID number">
          <input
            className="border px-2 py-1 rounded-md w-40"
            value={form.idNumber}
            onChange={(e) => setForm({ ...form, idNumber: e.target.value })}
          />
        </Field>
        <label className="flex items-center gap-2 self-end pb-1">
          <input
            type="checkbox"
            checked={form.isActive}
            onChange={(e) => setForm({ ...form, isActive: e.target.checked })}
          />
          Active
        </label>
      </div>
      <button
        type="button"
        onClick={save}
        disabled={busy || !form.firstName.trim() || !form.lastName.trim()}
        className="border px-3 py-1 rounded-md disabled:opacity-50"
      >
        {busy ? "Saving…" : "Save changes"}
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
