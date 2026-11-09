/**
 * Resend email notification configuration (server-only).
 *
 * The API key must never be exposed to the browser. Only
 * `src/server/notifications/*` reads it; client code talks to the booking/admin
 * APIs and never imports this module.
 *
 *   RESEND_API_KEY              Resend API key (required in production)
 *   RESEND_FROM_EMAIL           Verified sender, e.g.
 *                               "Santo Hotel <reservations@santohotel.com>"
 *                               Defaults to Resend's test sender.
 *   RESEND_REPLY_TO             Optional reply-to address
 *   HOTEL_NOTIFICATION_EMAIL    Admin recipient(s), comma-separated. When absent
 *                               the hotel profile e-mail and the organization
 *                               admin account are used.
 *   APP_URL                     Public base URL used in email links
 *   EMAIL_ENABLED               false is a kill switch (no sends, no rows)
 */

function envString(raw: string | undefined, fallback: string): string {
  const value = raw?.trim();
  return value ? value : fallback;
}

function envInt(raw: string | undefined, fallback: number, min: number, max: number): number {
  if (raw === undefined || raw.trim() === "") return fallback;
  const value = Number.parseInt(raw, 10);
  return Number.isInteger(value) && value >= min && value <= max ? value : fallback;
}

export function resendApiKey(): string | null {
  return process.env.RESEND_API_KEY?.trim() || null;
}

/** Kill switch; true by default so enabling the key is enough. */
export function emailEnabled(): boolean {
  return process.env.EMAIL_ENABLED !== "false";
}

export function resendFromEmail(): string {
  return envString(
    process.env.RESEND_FROM_EMAIL,
    "Santo Hotel <onboarding@resend.dev>",
  );
}

export function resendReplyTo(): string | null {
  return process.env.RESEND_REPLY_TO?.trim() || null;
}

/** Public site URL used for "view reservation" links inside emails. */
export function appUrl(): string {
  const raw =
    process.env.APP_URL?.trim() ||
    process.env.NEXT_PUBLIC_APP_URL?.trim() ||
    process.env.NEXT_PUBLIC_SITE_URL?.trim() ||
    "http://localhost:3000";
  return raw.replace(/\/+$/, "");
}

/** Comma/semicolon-separated admin override from the environment. */
export function configuredAdminEmails(): string[] {
  const raw = process.env.HOTEL_NOTIFICATION_EMAIL ?? process.env.RESEND_ADMIN_EMAIL ?? "";
  return raw
    .split(/[,;]/)
    .map((value) => value.trim().toLowerCase())
    .filter(Boolean);
}

export function emailTimeoutMs(): number {
  return envInt(process.env.RESEND_TIMEOUT_MS, 8_000, 2_000, 30_000);
}
