"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, FileCheck2, ShieldCheck, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { isValidCacNumber, normalizeCacNumber } from "@/lib/kyc";

const MAX_BYTES = 5 * 1024 * 1024;
const ACCEPTED = ".pdf,.png,.jpg,.jpeg,.webp";

const ERROR_MESSAGES: Record<string, string> = {
  email_exists:
    "An account with that e-mail already exists. Sign in instead, or use a different work e-mail.",
  organization_slug_taken:
    "That business URL is already taken — choose a different one.",
  hotel_slug_taken: "That property URL is already taken — choose a different one.",
  document_required: "Attach your CAC certificate, licence or other ownership evidence.",
  document_too_large: "The document must be 5 MB or smaller.",
  document_type_not_allowed: "Use a PDF, PNG, JPG or WEBP file.",
  invalid_body: "Please check the form values and try again.",
  internal: "Something went wrong creating the account. Please try again.",
};

const FIELD_LABELS: Record<string, string> = {
  organizationName: "registered business name",
  organizationSlug: "business URL",
  hotelName: "property name",
  hotelSlug: "property URL",
  ownerName: "your name",
  email: "work e-mail",
  password: "password",
  registrationNumber: "registration number",
  documentType: "document type",
};

const inputClass =
  "h-11 w-full min-w-0 rounded-lg border border-input bg-background px-3 text-sm text-foreground outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/15 disabled:cursor-not-allowed disabled:opacity-60";

function slugify(value: string) {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function Field({
  label,
  hint,
  required,
  children,
}: {
  label: string;
  hint?: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <label className="flex min-w-0 flex-col gap-1.5 text-sm">
      <span className="text-xs font-medium text-muted-foreground">
        {label}
        {required && <span className="text-destructive"> *</span>}
      </span>
      {children}
      {hint && <span className="text-[11px] leading-5 text-muted-foreground">{hint}</span>}
    </label>
  );
}

export function HotelSignupForm() {
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);

  const [organizationName, setOrganizationName] = useState("");
  const [organizationSlug, setOrganizationSlug] = useState("");
  const [organizationSlugTouched, setOrganizationSlugTouched] = useState(false);
  const [hotelName, setHotelName] = useState("");
  const [hotelSlug, setHotelSlug] = useState("");
  const [hotelSlugTouched, setHotelSlugTouched] = useState(false);
  const [ownerName, setOwnerName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [city, setCity] = useState("");
  const [country, setCountry] = useState("Nigeria");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [registrationNumber, setRegistrationNumber] = useState("");
  const [documentType, setDocumentType] = useState("CAC_CERTIFICATE");
  const [file, setFile] = useState<File | null>(null);
  const [acceptedTerms, setAcceptedTerms] = useState(false);

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const chooseFile = (next: File | null) => {
    setError(null);
    if (!next) {
      setFile(null);
      return;
    }
    if (next.size > MAX_BYTES) {
      setError(ERROR_MESSAGES.document_too_large);
      if (fileRef.current) fileRef.current.value = "";
      return;
    }
    const allowed = ["application/pdf", "image/png", "image/jpeg", "image/webp"];
    if (!allowed.includes(next.type)) {
      setError(ERROR_MESSAGES.document_type_not_allowed);
      if (fileRef.current) fileRef.current.value = "";
      return;
    }
    setFile(next);
  };

  const submit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);

    if (!file) {
      setError(ERROR_MESSAGES.document_required);
      return;
    }
    if (
      documentType === "CAC_CERTIFICATE" &&
      !isValidCacNumber(registrationNumber)
    ) {
      setError(
        "That CAC number is not valid. Use the format on your certificate: RC 1234567, BN 1234567 or IT 12345.",
      );
      return;
    }
    if (password !== confirmPassword) {
      setError("The two passwords do not match.");
      return;
    }
    if (!acceptedTerms) {
      setError("Confirm that you are authorised to register this business.");
      return;
    }

    const body = new FormData();
    body.set("organizationName", organizationName.trim());
    body.set("organizationSlug", organizationSlug.trim());
    body.set("hotelName", hotelName.trim());
    body.set("hotelSlug", hotelSlug.trim());
    body.set("ownerName", ownerName.trim());
    body.set("email", email.trim());
    body.set("phone", phone.trim());
    body.set("city", city.trim());
    body.set("country", country.trim());
    body.set("password", password);
    body.set(
      "registrationNumber",
      documentType === "CAC_CERTIFICATE"
        ? normalizeCacNumber(registrationNumber)
        : registrationNumber.trim(),
    );
    body.set("documentType", documentType);
    body.set("document", file);
    body.set("website", "");

    setBusy(true);
    try {
      const response = await fetch("/api/public/hotel-signup", { method: "POST", body });
      const payload = (await response.json().catch(() => ({}))) as {
        error?: string;
        redirect?: string;
        fields?: Record<string, string[] | undefined>;
      };
      if (!response.ok) {
        const field = payload.fields ? Object.keys(payload.fields)[0] : undefined;
        const fieldMessage = field ? payload.fields?.[field]?.[0] : undefined;
        if (fieldMessage) {
          setError(fieldMessage);
        } else if (field && FIELD_LABELS[field]) {
          setError(`Check the ${FIELD_LABELS[field]} field.`);
        } else {
          setError(ERROR_MESSAGES[payload.error ?? ""] ?? ERROR_MESSAGES.internal);
        }
        return;
      }
      router.push(payload.redirect ?? "/staff/login?registered=1");
    } catch {
      setError(ERROR_MESSAGES.internal);
    } finally {
      setBusy(false);
    }
  };

  return (
    <form onSubmit={submit} className="space-y-7" noValidate>
      {error && (
        <p
          role="alert"
          className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700"
        >
          {error}
        </p>
      )}

      <section className="space-y-3">
        <div>
          <p className="text-[0.7rem] font-semibold uppercase tracking-[0.14em] text-primary">
            Step 1 · The business
          </p>
          <h2 className="mt-1 text-lg font-semibold text-foreground">Registered business details</h2>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Registered business name" required>
            <input
              className={inputClass}
              required
              value={organizationName}
              onChange={(event) => {
                setOrganizationName(event.target.value);
                if (!organizationSlugTouched) setOrganizationSlug(slugify(event.target.value));
              }}
              placeholder="Santo Hospitality Group Ltd."
            />
          </Field>
          <Field label="Business URL" hint="Lowercase letters, numbers and dashes." required>
            <div className="flex items-center overflow-hidden rounded-lg border border-input bg-background focus-within:border-primary focus-within:ring-2 focus-within:ring-primary/15">
              <span className="pl-3 text-xs text-muted-foreground">santo/hotel/</span>
              <input
                className="h-11 w-full min-w-0 border-0 bg-transparent px-1.5 text-sm outline-none"
                required
                pattern="[a-z0-9]+(-[a-z0-9]+)*"
                value={organizationSlug}
                onChange={(event) => {
                  setOrganizationSlugTouched(true);
                  setOrganizationSlug(slugify(event.target.value));
                }}
                placeholder="santo-group"
              />
            </div>
          </Field>
          <Field
            label="CAC / registration number"
            hint={
              documentType === "CAC_CERTIFICATE"
                ? "Format: RC 1234567, BN 1234567 or IT 12345."
                : "Enter the number printed on the document."
            }
            required
          >
            <input
              className={inputClass}
              required
              value={registrationNumber}
              onChange={(event) => setRegistrationNumber(event.target.value)}
              placeholder={documentType === "CAC_CERTIFICATE" ? "RC 1234567" : "Licence number"}
            />
          </Field>
          <Field label="Country" required>
            <input
              className={inputClass}
              required
              value={country}
              onChange={(event) => setCountry(event.target.value)}
              placeholder="Nigeria"
            />
          </Field>
        </div>
      </section>

      <section className="space-y-3 border-t border-border pt-6">
        <div>
          <p className="text-[0.7rem] font-semibold uppercase tracking-[0.14em] text-primary">
            Step 2 · The property
          </p>
          <h2 className="mt-1 text-lg font-semibold text-foreground">Your first hotel</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            More properties can be added from the console after you sign in.
          </p>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Property name" required>
            <input
              className={inputClass}
              required
              value={hotelName}
              onChange={(event) => {
                setHotelName(event.target.value);
                if (!hotelSlugTouched) setHotelSlug(slugify(event.target.value));
              }}
              placeholder="Santo Hotel Lekki"
            />
          </Field>
          <Field label="Property URL" required>
            <div className="flex items-center overflow-hidden rounded-lg border border-input bg-background focus-within:border-primary focus-within:ring-2 focus-within:ring-primary/15">
              <span className="pl-3 text-xs text-muted-foreground">/hotels/</span>
              <input
                className="h-11 w-full min-w-0 border-0 bg-transparent px-1.5 text-sm outline-none"
                required
                pattern="[a-z0-9]+(-[a-z0-9]+)*"
                value={hotelSlug}
                onChange={(event) => {
                  setHotelSlugTouched(true);
                  setHotelSlug(slugify(event.target.value));
                }}
                placeholder="santo-hotel-lekki"
              />
            </div>
          </Field>
          <Field label="City">
            <input
              className={inputClass}
              value={city}
              onChange={(event) => setCity(event.target.value)}
              placeholder="Lagos"
            />
          </Field>
        </div>
      </section>

      <section className="space-y-3 border-t border-border pt-6">
        <div>
          <p className="text-[0.7rem] font-semibold uppercase tracking-[0.14em] text-primary">
            Step 3 · Owner sign-in
          </p>
          <h2 className="mt-1 text-lg font-semibold text-foreground">The account you will use</h2>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Your full name" required>
            <input
              className={inputClass}
              required
              autoComplete="name"
              value={ownerName}
              onChange={(event) => setOwnerName(event.target.value)}
            />
          </Field>
          <Field label="Work e-mail" required>
            <input
              className={inputClass}
              type="email"
              required
              autoComplete="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
            />
          </Field>
          <Field label="Phone">
            <input
              className={inputClass}
              type="tel"
              autoComplete="tel"
              value={phone}
              onChange={(event) => setPhone(event.target.value)}
              placeholder="+234 …"
            />
          </Field>
          <Field label="Password" hint="8+ characters with at least one letter and one number." required>
            <input
              className={inputClass}
              type="password"
              required
              minLength={8}
              autoComplete="new-password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
            />
          </Field>
          <Field label="Confirm password" required>
            <input
              className={inputClass}
              type="password"
              required
              minLength={8}
              autoComplete="new-password"
              value={confirmPassword}
              onChange={(event) => setConfirmPassword(event.target.value)}
            />
          </Field>
        </div>
      </section>

      <section className="space-y-3 border-t border-border pt-6">
        <div>
          <p className="text-[0.7rem] font-semibold uppercase tracking-[0.14em] text-primary">
            Step 4 · Business verification
          </p>
          <h2 className="mt-1 flex items-center gap-2 text-lg font-semibold text-foreground">
            <ShieldCheck className="size-5 text-primary" /> Upload your KYC evidence
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            A CAC certificate, business licence, tax certificate or other proof that you own the
            business. Reviewed by the Santo team; PDF or image, up to 5 MB.
          </p>
        </div>

        <Field label="Document type" required>
          <select
            className={inputClass}
            required
            value={documentType}
            onChange={(event) => setDocumentType(event.target.value)}
          >
            <option value="CAC_CERTIFICATE">CAC certificate</option>
            <option value="BUSINESS_LICENSE">Business licence</option>
            <option value="TAX_CERTIFICATE">Tax certificate</option>
            <option value="OTHER">Other ownership evidence</option>
          </select>
        </Field>

        <div>
          <input
            ref={fileRef}
            id="kyc-document"
            type="file"
            accept={ACCEPTED}
            className="sr-only"
            onChange={(event) => chooseFile(event.target.files?.[0] ?? null)}
          />
          <label
            htmlFor="kyc-document"
            className={`flex cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border border-dashed px-5 py-8 text-center transition-colors ${
              file
                ? "border-primary/40 bg-primary/5"
                : "border-input bg-muted/30 hover:border-primary/40 hover:bg-primary/5"
            }`}
          >
            {file ? (
              <>
                <FileCheck2 className="size-7 text-primary" />
                <span className="text-sm font-medium text-foreground">{file.name}</span>
                <span className="text-xs text-muted-foreground">
                  {formatBytes(file.size)} · click to replace
                </span>
              </>
            ) : (
              <>
                <Upload className="size-7 text-muted-foreground" />
                <span className="text-sm font-medium text-foreground">
                  Attach your certificate
                </span>
                <span className="text-xs text-muted-foreground">
                  PDF, PNG, JPG or WEBP · up to 5 MB
                </span>
              </>
            )}
          </label>
        </div>

        <label className="flex items-start gap-2.5 rounded-xl bg-muted/40 px-4 py-3 text-sm text-muted-foreground">
          <input
            type="checkbox"
            className="mt-0.5 size-4 accent-[var(--primary)]"
            checked={acceptedTerms}
            onChange={(event) => setAcceptedTerms(event.target.checked)}
            required
          />
          <span>
            I confirm I am authorised to register this business and that the document is genuine.
            Santo may contact me to verify the details.
          </span>
        </label>
      </section>

      <div className="flex flex-col gap-3 border-t border-border pt-6 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-xs text-muted-foreground">
          Already registered?{" "}
          <a href="/staff/login" className="font-medium text-foreground underline">
            Sign in to the console
          </a>
        </p>
        <Button type="submit" disabled={busy} size="lg">
          {busy ? "Creating business account…" : "Create business account"}
          {!busy && <ArrowRight />}
        </Button>
      </div>
    </form>
  );
}
