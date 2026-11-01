import "./load-env";
import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { prisma } from "../src/lib/prisma";
import { Prisma } from "../src/generated/prisma/client";
import {
  captureBaseline,
  type MigrationBaseline,
} from "./mt-migration";

type Check = { name: string; passed: boolean; detail: string };

function option(name: string): string | undefined {
  const prefix = `--${name}=`;
  return process.argv.find((argument) => argument.startsWith(prefix))?.slice(prefix.length);
}

function canonicalJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(",")}]`;
  if (value && typeof value === "object") {
    return `{${Object.entries(value)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, item]) => `${JSON.stringify(key)}:${canonicalJson(item)}`)
      .join(",")}}`;
  }
  return JSON.stringify(value);
}

async function main() {
  const baselinePath = option("baseline");
  const outputPath = option("output");
  if (!baselinePath) {
    throw new Error("Usage: npm run mt:reconcile -- --baseline=path/to/baseline.json [--output=report.json]");
  }

  const absoluteBaselinePath = path.resolve(process.cwd(), baselinePath);
  const baseline = JSON.parse(await readFile(absoluteBaselinePath, "utf8")) as MigrationBaseline;
  const baselineDigest = createHash("sha256").update(canonicalJson(baseline)).digest("hex");
  const after = await captureBaseline();
  const checks: Check[] = [];

  const baselineCountEntries = Object.entries(baseline.counts).sort(([a], [b]) => a.localeCompare(b));
  const currentCountsMatch = baselineCountEntries.every(([name, count]) => after.counts[name] === count);
  checks.push({
    name: "base table counts unchanged",
    passed: currentCountsMatch,
    detail: currentCountsMatch
      ? `${baselineCountEntries.length} table counts match`
      : baselineCountEntries
          .filter(([name, count]) => after.counts[name] !== count)
          .map(([name, count]) => `${name}: before=${count}, after=${after.counts[name]}`)
          .join("; "),
  });

  checks.push({
    name: "booking reference set preserved",
    passed: baseline.bookingReferenceCount === after.bookingReferenceCount &&
      baseline.bookingReferenceSha256 === after.bookingReferenceSha256,
    detail: `before count=${baseline.bookingReferenceCount}, after count=${after.bookingReferenceCount}, digest ${baseline.bookingReferenceSha256 === after.bookingReferenceSha256 ? "matches" : "differs"}`,
  });

  const ownerMismatches = await prisma.$queryRaw<Array<{ count: bigint }>>(Prisma.sql`
    WITH owners AS (
      SELECT b.id, COUNT(DISTINCT rt.hotel_id) AS owner_count,
        MIN(rt.hotel_id::text)::uuid AS hotel_id
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
    SELECT COUNT(*) AS count
    FROM bookings b
    JOIN owners o ON o.id = b.id
    LEFT JOIN hotels h ON h.id = o.hotel_id
    LEFT JOIN payment_currency pc ON pc.booking_id = b.id
    WHERE o.owner_count <> 1
      OR b.hotel_id IS DISTINCT FROM o.hotel_id
      OR b.organization_id IS DISTINCT FROM h.organization_id
      OR h.id IS NULL
      OR b.currency IS DISTINCT FROM COALESCE(pc.currency, h.currency)
      OR b.terms_snapshot IS NULL
  `);
  const bookingOwnerCount = Number(ownerMismatches[0]?.count ?? BigInt(0));
  checks.push({
    name: "all bookings have one resolved tenant/property and snapshots",
    passed: bookingOwnerCount === 0,
    detail: `${bookingOwnerCount} booking(s) missing or conflicting ownership/currency/terms`,
  });

  const paymentMismatches = await prisma.$queryRaw<Array<{ count: bigint }>>(Prisma.sql`
    SELECT COUNT(*) AS count
    FROM payments p
    JOIN bookings b ON b.id = p.booking_id
    WHERE b.hotel_id IS NULL
      OR p.hotel_id IS DISTINCT FROM b.hotel_id
      OR p.organization_id IS DISTINCT FROM b.organization_id
      OR b.currency IS NULL
      OR p.currency <> b.currency
  `);
  const paymentMismatchCount = Number(paymentMismatches[0]?.count ?? BigInt(0));
  checks.push({
    name: "payments match their booking owner and currency",
    passed: paymentMismatchCount === 0,
    detail: `${paymentMismatchCount} payment(s) conflict with booking ownership or currency`,
  });

  const actualFinancialRows = await prisma.$queryRaw<Array<{
    currency: string | null;
    bookingCount: bigint;
    subtotal: Prisma.Decimal;
    taxes: Prisma.Decimal;
    fees: Prisma.Decimal;
    discount: Prisma.Decimal;
    total: Prisma.Decimal;
  }>>(Prisma.sql`
    SELECT currency, COUNT(*) AS "bookingCount",
      COALESCE(SUM(subtotal), 0)::numeric(20,2) AS subtotal,
      COALESCE(SUM(taxes), 0)::numeric(20,2) AS taxes,
      COALESCE(SUM(fees), 0)::numeric(20,2) AS fees,
      COALESCE(SUM(discount), 0)::numeric(20,2) AS discount,
      COALESCE(SUM(total), 0)::numeric(20,2) AS total
    FROM bookings GROUP BY currency ORDER BY currency
  `);
  const actualFinancialTotals = Object.fromEntries(
    actualFinancialRows.map((row) => [
      row.currency ?? "UNRESOLVED",
      {
        bookingCount: Number(row.bookingCount),
        subtotal: row.subtotal.toFixed(2),
        taxes: row.taxes.toFixed(2),
        fees: row.fees.toFixed(2),
        discount: row.discount.toFixed(2),
        total: row.total.toFixed(2),
      },
    ]),
  );
  const financesMatch = canonicalJson(baseline.financialTotalsByCurrency) === canonicalJson(actualFinancialTotals);
  checks.push({
    name: "financial totals match exactly by currency",
    passed: financesMatch,
    detail: financesMatch
      ? `${Object.keys(actualFinancialTotals).length} currency group(s) match`
      : "Pre-backfill derived-currency totals differ from post-backfill stored-currency totals.",
  });

  const actualHotelRows = await prisma.$queryRaw<Array<{ hotelId: string; kind: string; count: bigint }>>(Prisma.sql`
    WITH records AS (
      SELECT hotel_id, 'roomTypes'::text AS kind, COUNT(*) AS count FROM room_types
        WHERE hotel_id IS NOT NULL GROUP BY hotel_id
      UNION ALL
      SELECT hotel_id, 'rooms', COUNT(*) FROM rooms
        WHERE hotel_id IS NOT NULL GROUP BY hotel_id
      UNION ALL
      SELECT hotel_id, 'bookings', COUNT(*) FROM bookings
        WHERE hotel_id IS NOT NULL GROUP BY hotel_id
      UNION ALL
      SELECT hotel_id, 'payments', COUNT(*) FROM payments
        WHERE hotel_id IS NOT NULL GROUP BY hotel_id
      UNION ALL
      SELECT hotel_id, 'roomNights', COUNT(*) FROM room_nights
        WHERE hotel_id IS NOT NULL GROUP BY hotel_id
    )
    SELECT hotel_id AS "hotelId", kind, count FROM records ORDER BY hotel_id, kind
  `);
  const actualHotelCounts: Record<string, Record<string, number>> = {};
  for (const row of actualHotelRows) {
    (actualHotelCounts[row.hotelId] ??= {})[row.kind] = Number(row.count);
  }
  const hotelCountsMatch = canonicalJson(baseline.hotelCounts) === canonicalJson(actualHotelCounts);
  checks.push({
    name: "record counts match per property",
    passed: hotelCountsMatch,
    detail: hotelCountsMatch
      ? `${Object.keys(actualHotelCounts).length} property group(s) match`
      : "The pre-backfill ownership projection differs from stored post-backfill ownership.",
  });

  const reportBody = {
    generatedAt: new Date().toISOString(),
    baseline: {
      file: path.relative(process.cwd(), absoluteBaselinePath),
      sha256: baselineDigest,
      capturedAt: baseline.generatedAt,
    },
    checks,
    passed: checks.every(({ passed }) => passed),
    before: baseline,
    after: {
      generatedAt: after.generatedAt,
      counts: after.counts,
      hotelCounts: actualHotelCounts,
      bookingReferenceCount: after.bookingReferenceCount,
      bookingReferenceSha256: after.bookingReferenceSha256,
      financialTotalsByCurrency: actualFinancialTotals,
    },
  };
  const reportSha256 = createHash("sha256").update(canonicalJson(reportBody)).digest("hex");
  const report = { ...reportBody, reportSha256 };

  console.log(JSON.stringify(report, null, 2));
  console.log(`\n${report.passed ? "PASS" : "FAIL"}: ${checks.filter(({ passed }) => passed).length}/${checks.length} reconciliation checks passed.`);
  console.log(`Report SHA-256: ${reportSha256}`);
  if (outputPath) {
    const absoluteOutputPath = path.resolve(process.cwd(), outputPath);
    await writeFile(absoluteOutputPath, `${JSON.stringify(report, null, 2)}\n`, { flag: "wx" });
    console.log(`Wrote reconciliation report: ${absoluteOutputPath}`);
  }
  if (!report.passed) process.exitCode = 1;
}

main()
  .catch((error) => {
    console.error("Multi-tenant reconciliation failed:", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
