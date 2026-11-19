"use client";

import { useState } from "react";
import {
  Card,
  CardBody,
  CardHeader,
  Field,
  InlineError,
  InlineSuccess,
  StatusBadge,
} from "@/components/admin/ui";
import { Button } from "@/components/ui/button";
import { LocationPicker } from "@/components/maps/location-picker";
import type { KycSummary } from "@/server/onboarding/kyc";

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
  /** Verified map coordinates (MR-07); null until an operator records them. */
  latitude: string | null;
  longitude: string | null;
};

const ERROR_MESSAGES: Record<string, string> = {
  not_found: "No hotel row — run the database seed.",
  invalid_body: "Please check the form values.",
  internal: "Something went wrong.",
};

const DOCUMENT_TYPE_LABELS: Record<string, string> = {
  CAC_CERTIFICATE: "CAC certificate",
  BUSINESS_LICENSE: "Business licence",
  TAX_CERTIFICATE: "Tax certificate",
  OTHER: "Other ownership evidence",
};

function messageFor(error: string | undefined) {
  return (error && ERROR_MESSAGES[error]) || ERROR_MESSAGES.internal;
}

export function SettingsForm({
  initial,
  demoMapLocation = false,
  kyc = null,
}: {
  initial: SettingsValues;
  demoMapLocation?: boolean;
  kyc?: KycSummary | null;
}) {
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
    latitude: initial.latitude ?? "",
    longitude: initial.longitude ?? "",
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const save = async () => {
    setBusy(true);
    setError(null);
    setSaved(false);
    // Coordinates are a pair (mirrors the DB check): both set or both cleared.
    const lat = form.latitude.trim();
    const lng = form.longitude.trim();
    const coordinates = lat && lng ? { latitude: Number(lat), longitude: Number(lng) } : { latitude: null, longitude: null };
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
      ...coordinates,
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
    <div className="space-y-5">
      <InlineError>{error}</InlineError>
      <InlineSuccess>{saved ? "Settings saved." : null}</InlineSuccess>

      <Card>
        <CardHeader
          title="Business verification"
          description="KYC evidence submitted when the business joined Santo. Platform operators review it separately from the property listing."
          actions={
            kyc ? (
              <StatusBadge
                status={kyc.status}
                label={
                  kyc.status === "APPROVED"
                    ? "Verified"
                    : kyc.status === "REJECTED"
                      ? "Needs attention"
                      : "Pending review"
                }
              />
            ) : undefined
          }
        />
        <CardBody className="space-y-3 text-sm">
          {kyc ? (
            <>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                <div>
                  <p className="text-xs font-medium text-muted-foreground">Registered name</p>
                  <p className="mt-0.5 font-medium">{kyc.legalName}</p>
                </div>
                <div>
                  <p className="text-xs font-medium text-muted-foreground">Registration number</p>
                  <p className="mt-0.5 font-medium">{kyc.registrationNumber ?? "—"}</p>
                </div>
                <div>
                  <p className="text-xs font-medium text-muted-foreground">Document</p>
                  <p className="mt-0.5 font-medium">{DOCUMENT_TYPE_LABELS[kyc.documentType] ?? kyc.documentType}</p>
                  <p className="text-xs text-muted-foreground">{kyc.documentName}</p>
                </div>
                <div>
                  <p className="text-xs font-medium text-muted-foreground">Submitted</p>
                  <p className="mt-0.5 font-medium">{kyc.submittedAt.slice(0, 10)}</p>
                  {kyc.reviewedAt && (
                    <p className="text-xs text-muted-foreground">
                      Reviewed {kyc.reviewedAt.slice(0, 10)}
                      {kyc.reviewedByName ? ` by ${kyc.reviewedByName}` : ""}
                    </p>
                  )}
                </div>
              </div>
              {kyc.reviewNote && (
                <div className="rounded-lg border border-[var(--admin-line)] bg-muted/40 px-3 py-2 text-xs leading-5">
                  <span className="font-medium">Review note:</span> {kyc.reviewNote}
                </div>
              )}
              <p className="text-xs leading-5 text-muted-foreground">
                {kyc.status === "APPROVED"
                  ? "Your business is verified. The listing can be submitted for marketplace review."
                  : kyc.status === "REJECTED"
                    ? "The document needs attention. Contact Santo support to replace it and reopen the review."
                    : "The document is in the Santo review queue. You can keep setting up rooms, rates and property details while it is reviewed."}
              </p>
            </>
          ) : (
            <p className="text-muted-foreground">
              No verification document is on file for this organisation. Contact Santo support to
              start the business verification.
            </p>
          )}
        </CardBody>
      </Card>

      <Card>
        <CardHeader
          title="Hotel profile"
          description="The name, contact details and address shown to guests across the booking journey."
        />
        <CardBody className="space-y-4">
          <div className="flex flex-wrap gap-4">
            <Field label="Name" required className="w-64">
              <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            </Field>
            <Field label="Phone" className="w-44">
              <input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
            </Field>
            <Field label="E-mail" className="w-60">
              <input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
            </Field>
            <Field label="Timezone" className="w-56">
              <input value={form.timezone} onChange={(e) => setForm({ ...form, timezone: e.target.value })} />
            </Field>
          </div>
          <div className="flex flex-wrap gap-4">
            <Field label="Address line 1" className="w-64">
              <input value={form.addressLine1} onChange={(e) => setForm({ ...form, addressLine1: e.target.value })} />
            </Field>
            <Field label="Address line 2" className="w-64">
              <input value={form.addressLine2} onChange={(e) => setForm({ ...form, addressLine2: e.target.value })} />
            </Field>
            <Field label="City" className="w-44">
              <input value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })} />
            </Field>
            <Field label="Postcode" className="w-28">
              <input value={form.postcode} onChange={(e) => setForm({ ...form, postcode: e.target.value })} />
            </Field>
            <Field label="Country" className="w-44">
              <input value={form.country} onChange={(e) => setForm({ ...form, country: e.target.value })} />
            </Field>
          </div>
          <Field label="Description">
            <textarea
              rows={3}
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
            />
          </Field>
        </CardBody>
      </Card>

      <Card>
        <CardHeader
          title="Address & map location"
          description={
            demoMapLocation
              ? "Local demo coordinates are synthetic, not the hotel's verified location."
              : "Coordinates must come from a verified source. Leave both empty to show “Map location unavailable”."
          }
        />
        <CardBody className="space-y-3">
          <LocationPicker
            latitude={form.latitude}
            longitude={form.longitude}
            demo={demoMapLocation}
            onChange={(next) => setForm({ ...form, ...next })}
          />
          <p className="text-xs leading-5 text-muted-foreground">
            {demoMapLocation
              ? "Replace these synthetic coordinates with coordinates from a trusted source before using this database outside local development."
              : "Enter both coordinates (survey, or a Google Maps pin of the building entrance) or leave both empty. A Santo platform operator must verify the position before the public map renders a pin. Coordinates are never guessed from the address."}
          </p>
        </CardBody>
      </Card>

      <Card>
        <CardHeader
          title="Policy & pricing"
          description="These values drive quotes, taxes and cancellation rules immediately — no restart needed. Currency changes only affect future quotes; booked amounts keep the currency they were sold in."
        />
        <CardBody className="space-y-4">
          <div className="flex flex-wrap gap-4">
            <Field label="Currency (ISO)" className="w-24">
              <input value={form.currency} onChange={(e) => setForm({ ...form, currency: e.target.value })} />
            </Field>
            <Field label="Tax rate (%)" className="w-28">
              <input value={form.taxRatePercent} onChange={(e) => setForm({ ...form, taxRatePercent: e.target.value })} />
            </Field>
            <Field label="Service fee (per booking)" className="w-36">
              <input value={form.serviceFee} onChange={(e) => setForm({ ...form, serviceFee: e.target.value })} />
            </Field>
            <Field label="Check-in from" className="w-40">
              <input type="time" value={form.checkInTime} onChange={(e) => setForm({ ...form, checkInTime: e.target.value })} />
            </Field>
            <Field label="Check-out by" className="w-40">
              <input type="time" value={form.checkOutTime} onChange={(e) => setForm({ ...form, checkOutTime: e.target.value })} />
            </Field>
            <Field label="Free cancellation (hours before check-in)" className="w-44">
              <input
                value={form.cancellationWindowHours}
                onChange={(e) => setForm({ ...form, cancellationWindowHours: e.target.value })}
              />
            </Field>
            <Field label="Max rooms per booking" className="w-40">
              <input
                value={form.maxRoomsPerBooking}
                onChange={(e) => setForm({ ...form, maxRoomsPerBooking: e.target.value })}
              />
            </Field>
          </div>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={form.guestCancellationEnabled}
              onChange={(e) => setForm({ ...form, guestCancellationEnabled: e.target.checked })}
            />
            Guests may cancel online
          </label>
        </CardBody>
      </Card>

      <div className="sticky bottom-0 z-10 flex justify-end rounded-xl border border-[var(--admin-line)] bg-card/95 px-4 py-3 shadow-[var(--shadow-soft)] backdrop-blur">
        <Button
          type="button"
          onClick={save}
          disabled={busy || !form.name.trim() || !form.currency.trim()}
        >
          {busy ? "Saving…" : "Save settings"}
        </Button>
      </div>
    </div>
  );
}
