"use client";

import { useState } from "react";
import {
  Card,
  CardBody,
  CardHeader,
  Field,
  InlineError,
} from "@/components/admin/ui";
import { Button } from "@/components/ui/button";

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
    <Card>
      <CardHeader
        title="Contact & identity"
        description="Corrections are audited. Booking history and payments remain read-only here."
        actions={
          saved ? <span className="text-xs font-medium text-emerald-700">Saved.</span> : undefined
        }
      />
      <CardBody className="space-y-4">
        <InlineError>{error}</InlineError>
        <div className="flex flex-wrap gap-3">
          <Field label="First name" required className="w-40">
            <input
              value={form.firstName}
              onChange={(e) => setForm({ ...form, firstName: e.target.value })}
            />
          </Field>
          <Field label="Last name" required className="w-40">
            <input
              value={form.lastName}
              onChange={(e) => setForm({ ...form, lastName: e.target.value })}
            />
          </Field>
          <Field label="E-mail" className="w-60">
            <input
              type="email"
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
            />
          </Field>
          <Field label="Phone" className="w-44">
            <input
              value={form.phone}
              onChange={(e) => setForm({ ...form, phone: e.target.value })}
            />
          </Field>
          <Field label="ID type" className="w-32">
            <input
              value={form.idType}
              placeholder="Passport"
              onChange={(e) => setForm({ ...form, idType: e.target.value })}
            />
          </Field>
          <Field label="ID number" className="w-44">
            <input
              value={form.idNumber}
              onChange={(e) => setForm({ ...form, idNumber: e.target.value })}
            />
          </Field>
          <label className="flex items-center gap-2 self-end pb-2 text-sm">
            <input
              type="checkbox"
              checked={form.isActive}
              onChange={(e) => setForm({ ...form, isActive: e.target.checked })}
            />
            Active
          </label>
        </div>
        <Button
          type="button"
          onClick={save}
          disabled={busy || !form.firstName.trim() || !form.lastName.trim()}
          size="sm"
        >
          {busy ? "Saving…" : "Save changes"}
        </Button>
      </CardBody>
    </Card>
  );
}
