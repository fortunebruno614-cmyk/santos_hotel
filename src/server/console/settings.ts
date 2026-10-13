import { prisma } from "@/lib/prisma";
import { writeAuditLog } from "@/server/audit/write";
import { ConsoleError } from "@/server/console/errors";
import type { ContentUpsertSchema, SettingsPatchInput } from "@/server/console/validation";
import { loadHotelContext } from "@/server/pricing/context";
import type { z } from "zod";

/**
 * P7 system settings & website content.
 *
 * The single `hotels` row holds every operational setting the admin console
 * edits (currency, tax, service fee, check-in/out times, cancellation window,
 * room cap). `loadHotelContext` merges it with the env fallbacks, so pricing,
 * cancellation and the public pages pick a change up on the very next request
 * — nothing is cached in code and no restart is needed.
 */

export type ContentUpsert = z.infer<typeof ContentUpsertSchema>;

/** Settings fields the console may write (mirrors SettingsPatchSchema). */
const SETTING_COLUMNS = [
  "name",
  "description",
  "phone",
  "email",
  "addressLine1",
  "addressLine2",
  "city",
  "postcode",
  "country",
  "timezone",
  "currency",
  "checkInTime",
  "checkOutTime",
  "taxRatePercent",
  "serviceFee",
  "cancellationWindowHours",
  "guestCancellationEnabled",
  "maxRoomsPerBooking",
] as const;

function auditValue(value: unknown): unknown {
  // Decimals serialize as their canonical 2-place string; dates never appear.
  return value !== null && value !== undefined && typeof value === "object" && "toString" in value
    ? String(value)
    : value;
}

export async function getSettings() {
  const hotel = await prisma.hotel.findFirst({ orderBy: { createdAt: "asc" } });
  if (!hotel) throw new ConsoleError("not_found", "no hotel row — run the database seed");
  return {
    ...hotel,
    taxRatePercent: hotel.taxRatePercent.toString(),
    serviceFee: hotel.serviceFee.toString(),
  };
}

/**
 * Partial update of the hotel settings. Only the supplied keys change, and only
 * the changed keys land in the audit log (`settings.update`, old → new).
 */
export async function updateSettings(input: SettingsPatchInput, actor: { userId: string }) {
  const hotel = await prisma.hotel.findFirst({ orderBy: { createdAt: "asc" } });
  if (!hotel) throw new ConsoleError("not_found", "no hotel row — run the database seed");

  const data: Record<string, unknown> = {};
  const oldValues: Record<string, unknown> = {};
  const newValues: Record<string, unknown> = {};

  for (const key of SETTING_COLUMNS) {
    if (!(key in input)) continue;
    const next = (input as Record<string, unknown>)[key];
    if (next === undefined) continue;
    const current = (hotel as unknown as Record<string, unknown>)[key];
    const same =
      key === "serviceFee" || key === "taxRatePercent"
        ? String(auditValue(current)) === String(auditValue(next))
        : current === next;
    if (same) continue;
    data[key] = next;
    oldValues[key] = auditValue(current);
    newValues[key] = auditValue(next);
  }

  if (Object.keys(data).length === 0) {
    // Nothing actually changed — return the current row without an audit entry.
    return getSettings();
  }

  const updated = await prisma.hotel.update({ where: { id: hotel.id }, data });
  await writeAuditLog({
    userId: actor.userId,
    action: "settings.update",
    entityType: "hotel",
    entityId: hotel.id,
    oldValues,
    newValues,
  });

  return {
    ...updated,
    taxRatePercent: updated.taxRatePercent.toString(),
    serviceFee: updated.serviceFee.toString(),
  };
}

/** Effective settings (DB row merged with env fallbacks) — what the app runs on. */
export async function getEffectiveSettings() {
  return loadHotelContext();
}

// ---------------------------------------------------------------------------
// Website content
// ---------------------------------------------------------------------------

/** Slots the public site renders from, with their built-in defaults. */
export const CONTENT_DEFAULTS: Record<string, { title: string; body: string }> = {
  "home.hero": {
    title: "Your stay starts here",
    body: "Check availability, see live prices and book in a minute — or sign in to manage an existing reservation.",
  },
  "rooms.intro": {
    title: "Rooms & suites",
    body: "Every room includes Wi-Fi, air conditioning and 24-hour front desk service.",
  },
  "site.footer": {
    title: "Santo Hotel",
    body: "Front desk open 24 hours. Free cancellation up to 48 hours before arrival.",
  },
};

export type ContentRecord = {
  key: string;
  title: string;
  body: string;
  updatedAt: string | null;
};

export async function listContent(): Promise<ContentRecord[]> {
  const rows = await prisma.siteContent.findMany({ orderBy: { key: "asc" } });
  const byKey = new Map(rows.map((row) => [row.key, row]));
  const keys = [...new Set([...Object.keys(CONTENT_DEFAULTS), ...byKey.keys()])].sort();
  return keys.map((key) => {
    const row = byKey.get(key);
    const fallback = CONTENT_DEFAULTS[key];
    return {
      key,
      title: row?.title ?? fallback?.title ?? "",
      body: row?.body ?? fallback?.body ?? "",
      updatedAt: row ? row.updatedAt.toISOString() : null,
    };
  });
}

export async function getContent(key: string): Promise<ContentRecord | null> {
  const row = await prisma.siteContent.findUnique({ where: { key } });
  const fallback = CONTENT_DEFAULTS[key];
  if (!row && !fallback) return null;
  return {
    key,
    title: row?.title ?? fallback?.title ?? "",
    body: row?.body ?? fallback?.body ?? "",
    updatedAt: row ? row.updatedAt.toISOString() : null,
  };
}

export async function upsertContent(input: ContentUpsert, actor: { userId: string }) {
  const existing = await prisma.siteContent.findUnique({ where: { key: input.key } });
  const data = {
    title: input.title ?? null,
    body: input.body,
    updatedById: actor.userId,
  };
  const row = existing
    ? await prisma.siteContent.update({ where: { key: input.key }, data })
    : await prisma.siteContent.create({ data: { key: input.key, ...data } });

  await writeAuditLog({
    userId: actor.userId,
    action: existing ? "content.update" : "content.create",
    entityType: "site_content",
    entityId: input.key,
    oldValues: existing ? { title: existing.title, body: existing.body } : null,
    newValues: { title: row.title, body: row.body },
  });

  return { ...row, updatedAt: row.updatedAt.toISOString() };
}

export async function deleteContent(key: string, actor: { userId: string }) {
  const existing = await prisma.siteContent.findUnique({ where: { key } });
  if (!existing) throw new ConsoleError("not_found", `no content slot "${key}"`);
  await prisma.siteContent.delete({ where: { key } });
  await writeAuditLog({
    userId: actor.userId,
    action: "content.delete",
    entityType: "site_content",
    entityId: key,
    oldValues: { title: existing.title, body: existing.body },
    newValues: null,
  });
  return { key };
}
