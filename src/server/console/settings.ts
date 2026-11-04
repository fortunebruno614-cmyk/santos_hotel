import { prisma } from "@/lib/prisma";
import { writeAuditLog } from "@/server/audit/write";
import { ConsoleError } from "@/server/console/errors";
import type { ContentUpsertSchema, SettingsPatchInput } from "@/server/console/validation";
import { requireHotelContext } from "@/server/pricing/context";
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
  "latitude",
  "longitude",
] as const;

/** Columns Prisma maps to Decimal — serialized to strings on the way out. */
const DECIMAL_COLUMNS = ["taxRatePercent", "serviceFee", "latitude", "longitude"] as const;

/** JSON-safe view of the hotel row (Decimals → string, matching the form). */
function serializeSettings<
  T extends {
    taxRatePercent: { toString(): string };
    serviceFee: { toString(): string };
    latitude: { toString(): string } | null;
    longitude: { toString(): string } | null;
  },
>(hotel: T) {
  return {
    ...hotel,
    taxRatePercent: hotel.taxRatePercent.toString(),
    serviceFee: hotel.serviceFee.toString(),
    latitude: hotel.latitude?.toString() ?? null,
    longitude: hotel.longitude?.toString() ?? null,
  };
}

function auditValue(value: unknown): unknown {
  // Decimals serialize as their canonical 2-place string; dates never appear.
  return value !== null && value !== undefined && typeof value === "object" && "toString" in value
    ? String(value)
    : value;
}

export async function getSettings(hotelId: string) {
  const hotel = await prisma.hotel.findUnique({ where: { id: hotelId } });
  if (!hotel) throw new ConsoleError("not_found", "hotel not found");
  return serializeSettings(hotel);
}

/**
 * Partial update of the hotel settings. Only the supplied keys change, and only
 * the changed keys land in the audit log (`settings.update`, old → new).
 */
export async function updateSettings(
  hotelId: string,
  input: SettingsPatchInput,
  actor: { userId: string },
) {
  const hotel = await prisma.hotel.findUnique({ where: { id: hotelId } });
  if (!hotel) throw new ConsoleError("not_found", "hotel not found");

  const data: Record<string, unknown> = {};
  const oldValues: Record<string, unknown> = {};
  const newValues: Record<string, unknown> = {};

  for (const key of SETTING_COLUMNS) {
    if (!(key in input)) continue;
    const next = (input as Record<string, unknown>)[key];
    if (next === undefined) continue;
    const current = (hotel as unknown as Record<string, unknown>)[key];
    const same = (DECIMAL_COLUMNS as readonly string[]).includes(key)
      ? String(auditValue(current)) === String(auditValue(next))
      : current === next;
    if (same) continue;
    data[key] = next;
    oldValues[key] = auditValue(current);
    newValues[key] = auditValue(next);
  }

  if (Object.keys(data).length === 0) {
    // Nothing actually changed — return the current row without an audit entry.
    return getSettings(hotelId);
  }

  const updated = await prisma.hotel.update({ where: { id: hotel.id }, data });
  await writeAuditLog({
    userId: actor.userId,
    organizationId: hotel.organizationId,
    hotelId: hotel.id,
    action: "settings.update",
    entityType: "hotel",
    entityId: hotel.id,
    oldValues,
    newValues,
  });

  return serializeSettings(updated);
}

/** Effective settings (DB row merged with env fallbacks) — what the app runs on. */
export async function getEffectiveSettings(hotelId: string) {
  return requireHotelContext(hotelId);
}

// ---------------------------------------------------------------------------
// Website content
// ---------------------------------------------------------------------------

/** Slots the public site renders from, with their built-in defaults. */
export const CONTENT_DEFAULTS: Record<string, { title: string; body: string }> = {
  "home.hero": {
    title: "Your Stay, Thoughtfully Designed.",
    body: "Discover comfort, exceptional hospitality, and a stay tailored to you at Santo Hotel.",
  },
  "rooms.intro": {
    title: "Find your perfect stay.",
    body: "Beautifully considered rooms. All the space you need to feel at home.",
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

function tenantContentKey(hotelId: string, key: string) {
  return `hotel:${hotelId}:${key}`;
}

function logicalContentKey(key: string, hotelId: string) {
  const prefix = `hotel:${hotelId}:`;
  return key.startsWith(prefix) ? key.slice(prefix.length) : key;
}

export async function listContent(hotelId: string): Promise<ContentRecord[]> {
  const rows = await prisma.siteContent.findMany({
    where: {
      OR: [
        { key: { not: { startsWith: "hotel:" } } },
        { key: { startsWith: `hotel:${hotelId}:` } },
      ],
    },
    orderBy: { key: "asc" },
  });
  const byKey = new Map(rows.map((row) => [logicalContentKey(row.key, hotelId), row]));
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

export async function getContent(
  key: string,
  hotelId?: string,
): Promise<ContentRecord | null> {
  // Tenant keys shadow platform keys; platform content stays marketplace-wide.
  const row = hotelId
    ? (await prisma.siteContent.findUnique({
        where: { key: tenantContentKey(hotelId, key) },
      })) ?? (await prisma.siteContent.findUnique({ where: { key } }))
    : await prisma.siteContent.findUnique({ where: { key } });
  const fallback = CONTENT_DEFAULTS[key];
  if (!row && !fallback) return null;
  return {
    key,
    title: row?.title ?? fallback?.title ?? "",
    body: row?.body ?? fallback?.body ?? "",
    updatedAt: row ? row.updatedAt.toISOString() : null,
  };
}

export async function upsertContent(
  hotelId: string,
  input: ContentUpsert,
  actor: { userId: string },
) {
  const hotel = await requireHotelContext(hotelId);
  const key = tenantContentKey(hotelId, input.key);
  const existing = await prisma.siteContent.findUnique({ where: { key } });
  const data = {
    scope: "TENANT" as const,
    organizationId: hotel.organizationId,
    hotelId,
    title: input.title ?? null,
    body: input.body,
    updatedById: actor.userId,
  };
  const row = existing
    ? await prisma.siteContent.update({ where: { key }, data })
    : await prisma.siteContent.create({ data: { key, ...data } });

  await writeAuditLog({
    userId: actor.userId,
    organizationId: hotel.organizationId,
    hotelId,
    action: existing ? "content.update" : "content.create",
    entityType: "site_content",
    entityId: input.key,
    oldValues: existing ? { title: existing.title, body: existing.body } : null,
    newValues: { title: row.title, body: row.body },
  });

  return { ...row, updatedAt: row.updatedAt.toISOString() };
}

export async function deleteContent(hotelId: string, key: string, actor: { userId: string }) {
  const scopedKey = tenantContentKey(hotelId, key);
  const existing = await prisma.siteContent.findUnique({ where: { key: scopedKey } });
  if (!existing) throw new ConsoleError("not_found", `no tenant content slot "${key}"`);
  await prisma.siteContent.delete({ where: { key: scopedKey } });
  await writeAuditLog({
    userId: actor.userId,
    organizationId: existing.organizationId,
    hotelId,
    action: "content.delete",
    entityType: "site_content",
    entityId: key,
    oldValues: { title: existing.title, body: existing.body },
    newValues: null,
  });
  return { key };
}
