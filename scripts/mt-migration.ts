import "./load-env";
import { createHash } from "node:crypto";
import { prisma } from "../src/lib/prisma";
import { Prisma } from "../src/generated/prisma/client";

export type MigrationFinding = {
  id: string;
  severity: "BLOCKER" | "WARNING";
  count: number;
  detail: string;
};

export type MigrationPreflight = {
  generatedAt: string;
  counts: Record<string, number>;
  expectedAfter: Record<string, number>;
  uniquenessConflicts: Record<string, number>;
  ownershipAnomalies: Record<string, number>;
  hotels: Array<{
    id: string;
    name: string;
    slug: string;
    timezone: string;
    currency: string;
    organizationId: string;
  }>;
  findings: MigrationFinding[];
  canBackfill: boolean;
};

const COUNT_QUERIES = {
  hotels: () => prisma.hotel.count(),
  organizations: () => prisma.organization.count(),
  users: () => prisma.user.count(),
  guests: () => prisma.guest.count(),
  roomTypes: () => prisma.roomType.count(),
  rooms: () => prisma.room.count(),
  rates: () => prisma.rate.count(),
  amenities: () => prisma.amenity.count(),
  promotions: () => prisma.promotion.count(),
  bookings: () => prisma.booking.count(),
  bookingRooms: () => prisma.bookingRoom.count(),
  roomNights: () => prisma.roomNight.count(),
  payments: () => prisma.payment.count(),
  notifications: () => prisma.notification.count(),
} satisfies Record<string, () => Promise<number>>;

async function count(sql: Prisma.Sql): Promise<number> {
  const rows = await prisma.$queryRaw<Array<{ count: bigint }>>(sql);
  return Number(rows[0]?.count ?? BigInt(0));
}

export async function inspectMigration(): Promise<MigrationPreflight> {
  const countEntries = await Promise.all(
    Object.entries(COUNT_QUERIES).map(async ([name, query]) => [name, await query()] as const),
  );
  const counts = Object.fromEntries(countEntries);

  const [
    duplicateUserEmails,
    duplicateGuestEmails,
    duplicateRoomNumbers,
    duplicateRoomTypeNames,
    duplicateRoomTypeSlugs,
    duplicatePromotionCodes,
    duplicateAmenityNames,
    duplicateBookingReferences,
    roomTypesWithoutHotel,
    roomsWithoutOwner,
    bookingsWithoutRooms,
    bookingsAcrossHotels,
    bookingsWithUnresolvedRoom,
    paymentsWithoutBookingOwner,
    bookingRoomsWithConflictingOwner,
    roomNightsWithoutOwner,
    roomTypesWithConflictingOrganization,
    bookingsWithConflictingOwner,
    paymentsWithConflictingOwner,
    paymentCurrencyVariants,
    bookingPaymentCurrencyMismatches,
    historicalPaymentsAtNonCurrentCurrency,
    notificationsWithConflictingOwner,
    hotels,
    userRoleRows,
  ] = await Promise.all([
    count(Prisma.sql`SELECT COUNT(*) AS count FROM (
      SELECT email FROM users GROUP BY email HAVING COUNT(*) > 1
    ) duplicates`),
    count(Prisma.sql`SELECT COUNT(*) AS count FROM (
      SELECT email FROM guests WHERE email IS NOT NULL GROUP BY email HAVING COUNT(*) > 1
    ) duplicates`),
    count(Prisma.sql`SELECT COUNT(*) AS count FROM (
      SELECT room_number FROM rooms GROUP BY room_number HAVING COUNT(*) > 1
    ) duplicates`),
    count(Prisma.sql`SELECT COUNT(*) AS count FROM (
      SELECT name FROM room_types GROUP BY name HAVING COUNT(*) > 1
    ) duplicates`),
    count(Prisma.sql`SELECT COUNT(*) AS count FROM (
      SELECT slug FROM room_types GROUP BY slug HAVING COUNT(*) > 1
    ) duplicates`),
    count(Prisma.sql`SELECT COUNT(*) AS count FROM (
      SELECT code FROM promotions GROUP BY code HAVING COUNT(*) > 1
    ) duplicates`),
    count(Prisma.sql`SELECT COUNT(*) AS count FROM (
      SELECT name FROM amenities GROUP BY name HAVING COUNT(*) > 1
    ) duplicates`),
    count(Prisma.sql`SELECT COUNT(*) AS count FROM (
      SELECT booking_reference FROM bookings GROUP BY booking_reference HAVING COUNT(*) > 1
    ) duplicates`),
    count(Prisma.sql`SELECT COUNT(*) AS count FROM room_types rt
      LEFT JOIN hotels h ON h.id = rt.hotel_id WHERE h.id IS NULL`),
    count(Prisma.sql`SELECT COUNT(*) AS count FROM rooms r
      LEFT JOIN room_types rt ON rt.id = r.room_type_id
      LEFT JOIN hotels h ON h.id = rt.hotel_id
      WHERE rt.id IS NULL OR h.id IS NULL OR (r.hotel_id IS NOT NULL AND r.hotel_id <> h.id)`),
    count(Prisma.sql`SELECT COUNT(*) AS count FROM bookings b
      WHERE NOT EXISTS (SELECT 1 FROM booking_rooms br WHERE br.booking_id = b.id)`),
    count(Prisma.sql`SELECT COUNT(*) AS count FROM (
      SELECT b.id
      FROM bookings b
      JOIN booking_rooms br ON br.booking_id = b.id
      JOIN rooms r ON r.id = br.room_id
      JOIN room_types rt ON rt.id = r.room_type_id
      GROUP BY b.id
      HAVING COUNT(DISTINCT rt.hotel_id) > 1
    ) ambiguous`),
    count(Prisma.sql`SELECT COUNT(*) AS count FROM booking_rooms br
      LEFT JOIN rooms r ON r.id = br.room_id
      LEFT JOIN room_types rt ON rt.id = r.room_type_id
      LEFT JOIN hotels h ON h.id = rt.hotel_id
      WHERE r.id IS NULL OR rt.id IS NULL OR h.id IS NULL`),
    count(Prisma.sql`SELECT COUNT(*) AS count FROM payments p
      WHERE NOT EXISTS (
        SELECT 1 FROM bookings b JOIN booking_rooms br ON br.booking_id = b.id
        JOIN rooms r ON r.id = br.room_id JOIN room_types rt ON rt.id = r.room_type_id
        WHERE b.id = p.booking_id
      )`),
    count(Prisma.sql`SELECT COUNT(*) AS count FROM booking_rooms br
      JOIN bookings b ON b.id = br.booking_id
      JOIN rooms r ON r.id = br.room_id
      JOIN room_types rt ON rt.id = r.room_type_id
      WHERE br.hotel_id IS NOT NULL AND br.hotel_id <> rt.hotel_id`),
    count(Prisma.sql`SELECT COUNT(*) AS count FROM room_nights rn
      JOIN rooms r ON r.id = rn.room_id
      JOIN room_types rt ON rt.id = r.room_type_id
      WHERE rn.hotel_id IS NOT NULL AND rn.hotel_id <> rt.hotel_id`),
    count(Prisma.sql`SELECT COUNT(*) AS count FROM room_types rt
      JOIN hotels h ON h.id = rt.hotel_id
      WHERE rt.organization_id IS NOT NULL AND rt.organization_id <> h.organization_id`),
    count(Prisma.sql`WITH owners AS (
      SELECT b.id, COUNT(DISTINCT rt.hotel_id) AS owner_count,
        MIN(rt.hotel_id::text)::uuid AS hotel_id
      FROM bookings b
      JOIN booking_rooms br ON br.booking_id = b.id
      JOIN rooms r ON r.id = br.room_id
      JOIN room_types rt ON rt.id = r.room_type_id
      GROUP BY b.id
    ), payment_currency AS (
      SELECT booking_id, COUNT(DISTINCT currency) AS currency_count,
        MIN(currency) AS currency
      FROM payments GROUP BY booking_id
    )
    SELECT COUNT(*) AS count FROM bookings b JOIN owners o ON o.id = b.id
      JOIN hotels h ON h.id = o.hotel_id
      LEFT JOIN payment_currency pc ON pc.booking_id = b.id
      WHERE o.owner_count <> 1
        OR (b.hotel_id IS NOT NULL AND b.hotel_id <> o.hotel_id)
        OR (b.organization_id IS NOT NULL AND b.organization_id <> h.organization_id)
        OR (b.currency IS NOT NULL AND b.currency IS DISTINCT FROM COALESCE(pc.currency, h.currency))`),
    count(Prisma.sql`SELECT COUNT(*) AS count FROM (
      SELECT booking_id FROM payments GROUP BY booking_id
      HAVING COUNT(DISTINCT currency) > 1
    ) conflicting`),
    count(Prisma.sql`SELECT COUNT(*) AS count FROM bookings b
      JOIN payments p ON p.booking_id = b.id
      WHERE b.currency IS NOT NULL AND b.currency <> p.currency`),
    count(Prisma.sql`WITH owners AS (
      SELECT b.id, MIN(rt.hotel_id::text)::uuid AS hotel_id
      FROM bookings b
      JOIN booking_rooms br ON br.booking_id = b.id
      JOIN rooms r ON r.id = br.room_id
      JOIN room_types rt ON rt.id = r.room_type_id
      GROUP BY b.id
    )
    SELECT COUNT(*) AS count FROM payments p
      JOIN owners o ON o.id = p.booking_id
      JOIN hotels h ON h.id = o.hotel_id
      WHERE (p.hotel_id IS NOT NULL AND p.hotel_id <> o.hotel_id)
        OR (p.organization_id IS NOT NULL AND p.organization_id <> h.organization_id)`),
    count(Prisma.sql`WITH owners AS (
      SELECT b.id, MIN(rt.hotel_id::text)::uuid AS hotel_id
      FROM bookings b
      JOIN booking_rooms br ON br.booking_id = b.id
      JOIN rooms r ON r.id = br.room_id
      JOIN room_types rt ON rt.id = r.room_type_id
      GROUP BY b.id
    )
    SELECT COUNT(*) AS count FROM payments p
      JOIN owners o ON o.id = p.booking_id
      JOIN hotels h ON h.id = o.hotel_id
      WHERE p.currency <> h.currency`),
    count(Prisma.sql`SELECT COUNT(*) AS count FROM notifications n
      JOIN bookings b ON b.id = n.booking_id
      JOIN booking_rooms br ON br.booking_id = b.id
      JOIN rooms r ON r.id = br.room_id
      JOIN room_types rt ON rt.id = r.room_type_id
      JOIN hotels h ON h.id = rt.hotel_id
      WHERE (n.hotel_id IS NOT NULL AND n.hotel_id <> h.id)
        OR (n.organization_id IS NOT NULL AND n.organization_id <> h.organization_id)`),
    prisma.hotel.findMany({
      select: {
        id: true,
        name: true,
        slug: true,
        timezone: true,
        currency: true,
        organizationId: true,
      },
      orderBy: { slug: "asc" },
    }),
    prisma.user.groupBy({ by: ["role"], _count: { _all: true } }),
  ]);

  const uniquenessConflicts = {
    duplicateUserEmails,
    duplicateGuestEmails,
    duplicateRoomNumbers,
    duplicateRoomTypeNames,
    duplicateRoomTypeSlugs,
    duplicatePromotionCodes,
    duplicateAmenityNames,
    duplicateBookingReferences,
  };
  const ownershipAnomalies = {
    roomTypesWithoutHotel,
    roomsWithoutOwner,
    bookingsWithoutRooms,
    bookingsAcrossHotels,
    bookingsWithUnresolvedRoom,
    paymentsWithoutBookingOwner,
    bookingRoomsWithConflictingOwner,
    roomNightsWithoutOwner,
    roomTypesWithConflictingOrganization,
    bookingsWithConflictingOwner,
    paymentsWithConflictingOwner,
    paymentCurrencyVariants,
    bookingPaymentCurrencyMismatches,
    notificationsWithConflictingOwner,
  };

  const findings: MigrationFinding[] = [];
  for (const [id, value] of Object.entries(uniquenessConflicts)) {
    findings.push({
      id,
      severity: value > 0 ? "BLOCKER" : "WARNING",
      count: value,
      detail: value > 0 ? "Duplicate values must be resolved before backfill." : "No conflicts found.",
    });
  }
  for (const [id, value] of Object.entries(ownershipAnomalies)) {
    findings.push({
      id,
      severity: value > 0 ? "BLOCKER" : "WARNING",
      count: value,
      detail: value > 0 ? "Ownership cannot be assigned without guessing." : "No anomalies found.",
    });
  }
  if (historicalPaymentsAtNonCurrentCurrency > 0) {
    findings.push({
      id: "historicalPaymentsAtNonCurrentCurrency",
      severity: "WARNING",
      count: historicalPaymentsAtNonCurrentCurrency,
      detail: "Some recorded payment currencies differ from the hotel's current currency. Historical payment and booking currency will be preserved.",
    });
  }
  if (hotels.length === 0) {
    findings.push({
      id: "no-hotels",
      severity: "BLOCKER",
      count: 0,
      detail: "No property exists to provide the first tenant's ownership context.",
    });
  }
  if (new Set(hotels.map((hotel) => hotel.organizationId)).size !== 1) {
    findings.push({
      id: "multiple-or-unassigned-organizations",
      severity: "BLOCKER",
      count: new Set(hotels.map((hotel) => hotel.organizationId)).size,
      detail: "M2 role mapping supports one existing organization; multiple organizations need an explicit migration map.",
    });
  }

  for (const hotel of hotels) {
    if (hotel.timezone === "Asia/Kuala_Lumpur" && hotel.currency === "NGN") {
      findings.push({
        id: `timezone-currency-${hotel.slug}`,
        severity: "WARNING",
        count: 1,
        detail: `${hotel.name} uses Asia/Kuala_Lumpur with NGN. Confirm this pairing; the script will not change either value.`,
      });
    }
  }

  const staffCount = userRoleRows
    .filter(({ role }) => role === "ADMIN" || role === "STAFF")
    .reduce((sum, { _count }) => sum + _count._all, 0);

  return {
    generatedAt: new Date().toISOString(),
    counts,
    expectedAfter: {
      ...counts,
      organizationMembers: staffCount,
    },
    uniquenessConflicts,
    ownershipAnomalies,
    hotels,
    findings,
    canBackfill: findings.every(({ severity }) => severity !== "BLOCKER"),
  };
}

export type FinancialTotals = Record<
  string,
  { bookingCount: number; subtotal: string; taxes: string; fees: string; discount: string; total: string }
>;

export type MigrationBaseline = {
  generatedAt: string;
  counts: Record<string, number>;
  hotelCounts: Record<string, Record<string, number>>;
  bookingReferenceCount: number;
  bookingReferenceSha256: string;
  financialTotalsByCurrency: FinancialTotals;
};

type BookingProjection = {
  bookingReference: string;
  derivedHotelId: string | null;
  storedHotelId: string | null;
  derivedCurrency: string | null;
  storedCurrency: string | null;
  subtotal: Prisma.Decimal;
  taxes: Prisma.Decimal;
  fees: Prisma.Decimal;
  discount: Prisma.Decimal;
  total: Prisma.Decimal;
};

function cents(value: Prisma.Decimal | string | number): bigint {
  const [whole, fraction = ""] = String(value).split(".");
  return BigInt(whole) * BigInt(100) + BigInt(fraction.padEnd(2, "0").slice(0, 2));
}

function decimal(centsValue: bigint): string {
  const sign = centsValue < BigInt(0) ? "-" : "";
  const absolute = centsValue < BigInt(0) ? -centsValue : centsValue;
  return `${sign}${absolute / BigInt(100)}.${String(absolute % BigInt(100)).padStart(2, "0")}`;
}

export async function captureBaseline(): Promise<MigrationBaseline> {
  const [countEntries, bookingRows, referenceRows, propertyRows] = await Promise.all([
    Promise.all(
      Object.entries(COUNT_QUERIES).map(async ([name, query]) => [name, await query()] as const),
    ),
    prisma.$queryRaw<BookingProjection[]>(Prisma.sql`
      WITH booking_owners AS (
        SELECT b.id, COUNT(DISTINCT rt.hotel_id) AS owner_count,
          MIN(rt.hotel_id::text) AS hotel_id
        FROM bookings b
        LEFT JOIN booking_rooms br ON br.booking_id = b.id
        LEFT JOIN rooms r ON r.id = br.room_id
        LEFT JOIN room_types rt ON rt.id = r.room_type_id
        GROUP BY b.id
      ), payment_currency AS (
        SELECT booking_id, COUNT(DISTINCT currency) AS currency_count,
          MIN(currency) AS currency
        FROM payments GROUP BY booking_id
      )
      SELECT b.booking_reference AS "bookingReference",
        bo.hotel_id AS "derivedHotelId",
        b.hotel_id AS "storedHotelId",
        COALESCE(pc.currency, h.currency) AS "derivedCurrency",
        b.currency AS "storedCurrency",
        b.subtotal, b.taxes, b.fees, b.discount, b.total
      FROM bookings b
      JOIN booking_owners bo ON bo.id = b.id
      LEFT JOIN hotels h ON h.id::text = bo.hotel_id
      LEFT JOIN payment_currency pc ON pc.booking_id = b.id
      ORDER BY b.booking_reference
    `),
    prisma.booking.findMany({ select: { bookingReference: true }, orderBy: { bookingReference: "asc" } }),
    prisma.$queryRaw<Array<{ hotelId: string; kind: string; count: bigint }>>(Prisma.sql`
      WITH booking_owners AS (
        SELECT b.id, MIN(rt.hotel_id::text)::uuid AS hotel_id
        FROM bookings b
        JOIN booking_rooms br ON br.booking_id = b.id
        JOIN rooms r ON r.id = br.room_id
        JOIN room_types rt ON rt.id = r.room_type_id
        GROUP BY b.id
      ), records AS (
        SELECT hotel_id, 'roomTypes'::text AS kind, COUNT(*) AS count
          FROM room_types GROUP BY hotel_id
        UNION ALL
        SELECT rt.hotel_id, 'rooms', COUNT(*)
          FROM rooms r JOIN room_types rt ON rt.id = r.room_type_id GROUP BY rt.hotel_id
        UNION ALL
        SELECT bo.hotel_id, 'bookings', COUNT(*)
          FROM booking_owners bo GROUP BY bo.hotel_id
        UNION ALL
        SELECT bo.hotel_id, 'payments', COUNT(*)
          FROM payments p JOIN booking_owners bo ON bo.id = p.booking_id GROUP BY bo.hotel_id
        UNION ALL
        SELECT rt.hotel_id, 'roomNights', COUNT(*)
          FROM room_nights rn JOIN rooms r ON r.id = rn.room_id
          JOIN room_types rt ON rt.id = r.room_type_id GROUP BY rt.hotel_id
      )
      SELECT hotel_id AS "hotelId", kind, count FROM records ORDER BY hotel_id, kind
    `),
  ]);
  const counts = Object.fromEntries(countEntries);
  const refs = referenceRows.map(({ bookingReference }) => bookingReference);
  const refsDigest = createHash("sha256").update(refs.join("\n")).digest("hex");
  const financialCents = new Map<string, {
    bookingCount: number;
    subtotal: bigint;
    taxes: bigint;
    fees: bigint;
    discount: bigint;
    total: bigint;
  }>();
  const hotelCounts: Record<string, Record<string, number>> = {};
  for (const { hotelId, kind, count: value } of propertyRows) {
    (hotelCounts[hotelId] ??= {})[kind] = Number(value);
  }
  for (const row of bookingRows) {
    const currency = row.derivedCurrency ?? "UNRESOLVED";
    const prior = financialCents.get(currency) ?? {
      bookingCount: 0,
      subtotal: BigInt(0),
      taxes: BigInt(0),
      fees: BigInt(0),
      discount: BigInt(0),
      total: BigInt(0),
    };
    prior.bookingCount += 1;
    prior.subtotal += cents(row.subtotal);
    prior.taxes += cents(row.taxes);
    prior.fees += cents(row.fees);
    prior.discount += cents(row.discount);
    prior.total += cents(row.total);
    financialCents.set(currency, prior);
  }

  return {
    generatedAt: new Date().toISOString(),
    counts,
    hotelCounts,
    bookingReferenceCount: refs.length,
    bookingReferenceSha256: refsDigest,
    financialTotalsByCurrency: Object.fromEntries(
      [...financialCents.entries()].map(([currency, values]) => [
        currency,
        {
          bookingCount: values.bookingCount,
          subtotal: decimal(values.subtotal),
          taxes: decimal(values.taxes),
          fees: decimal(values.fees),
          discount: decimal(values.discount),
          total: decimal(values.total),
        },
      ]),
    ),
  };
}

export function printPreflight(report: MigrationPreflight): void {
  console.log(JSON.stringify(report, null, 2));
  const blockers = report.findings.filter(({ severity }) => severity === "BLOCKER");
  console.log(`\n${blockers.length === 0 ? "PASS" : "BLOCKED"}: ${blockers.length} migration blocker(s).`);
}

export async function requireCleanPreflight(): Promise<MigrationPreflight> {
  const report = await inspectMigration();
  printPreflight(report);
  if (!report.canBackfill) {
    throw new Error("Preflight found blocking data issues; no backfill was run.");
  }
  return report;
}

export function closePrisma(): Promise<void> {
  return prisma.$disconnect();
}
