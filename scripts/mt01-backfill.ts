import "./load-env";
import { createHash } from "node:crypto";
import { createReadStream } from "node:fs";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { prisma } from "../src/lib/prisma";
import { Prisma } from "../src/generated/prisma/client";
import { OrganizationRole, MemberStatus } from "../src/generated/prisma/enums";
import { captureBaseline, requireCleanPreflight } from "./mt-migration";

type BackfillCounts = Record<string, number>;

class BackfillRollbackValidation extends Error {}

function option(name: string): string | undefined {
  const prefix = `--${name}=`;
  return process.argv.find((argument) => argument.startsWith(prefix))?.slice(prefix.length);
}

async function sha256(filePath: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const hash = createHash("sha256");
    const stream = createReadStream(filePath);
    stream.on("data", (chunk: string | Buffer) => hash.update(chunk));
    stream.on("error", reject);
    stream.on("end", () => resolve(hash.digest("hex")));
  });
}

async function verifyBackup(fileName: string): Promise<void> {
  const backupPath = path.resolve(process.cwd(), fileName);
  const manifestPath = `${backupPath}.json`;
  const manifest = JSON.parse(await readFile(manifestPath, "utf8")) as {
    dump: string;
    sha256: string;
    database: string;
    databaseHost: string;
  };
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) throw new Error("DATABASE_URL is not set (checked .env.local, .env).");
  const target = new URL(databaseUrl);
  if (path.resolve(process.cwd(), manifest.dump) !== backupPath) {
    throw new Error("Backup manifest does not describe the specified dump file.");
  }
  if (manifest.database !== target.pathname.slice(1) || manifest.databaseHost !== target.hostname) {
    throw new Error("Backup manifest database does not match the configured migration target.");
  }
  const actualHash = await sha256(backupPath);
  if (actualHash !== manifest.sha256) throw new Error("Backup SHA-256 does not match its manifest.");
}

async function saveBaseline(fileName: string): Promise<string> {
  const outputPath = path.resolve(process.cwd(), fileName);
  await mkdir(path.dirname(outputPath), { recursive: true });
  const baseline = await captureBaseline();
  await writeFile(outputPath, `${JSON.stringify(baseline, null, 2)}\n`, { flag: "wx" });
  return outputPath;
}

async function backfill(rollbackAfter: boolean): Promise<BackfillCounts> {
  return prisma.$transaction(async (tx) => {
    const counts: BackfillCounts = {};
    const run = async (label: string, query: Parameters<typeof tx.$executeRaw>[0]) => {
      counts[label] = await tx.$executeRaw(query);
    };

    await run("roomTypes", Prisma.sql`
      UPDATE room_types rt SET organization_id = h.organization_id
      FROM hotels h
      WHERE h.id = rt.hotel_id AND rt.organization_id IS NULL
    `);
    await run("rooms", Prisma.sql`
      UPDATE rooms r SET hotel_id = rt.hotel_id
      FROM room_types rt
      WHERE rt.id = r.room_type_id AND r.hotel_id IS NULL
    `);
    await run("bookings", Prisma.sql`
      WITH owners AS (
        SELECT b.id, MIN(rt.hotel_id::text)::uuid AS hotel_id
        FROM bookings b
        JOIN booking_rooms br ON br.booking_id = b.id
        JOIN rooms r ON r.id = br.room_id
        JOIN room_types rt ON rt.id = r.room_type_id
        GROUP BY b.id
      ), payment_currency AS (
        SELECT booking_id, MIN(currency) AS currency
        FROM payments GROUP BY booking_id
      )
      UPDATE bookings b SET
        hotel_id = COALESCE(b.hotel_id, h.id),
        organization_id = COALESCE(b.organization_id, h.organization_id),
        currency = COALESCE(b.currency, pc.currency, h.currency),
        terms_snapshot = COALESCE(b.terms_snapshot, jsonb_build_object(
          'snapshotType', 'm2_migration_current_property_terms',
          'capturedAt', NOW(),
          'checkInTime', h.check_in_time,
          'checkOutTime', h.check_out_time,
          'taxRatePercent', h.tax_rate_percent,
          'serviceFee', h.service_fee,
          'cancellationWindowHours', h.cancellation_window_hours,
          'guestCancellationEnabled', h.guest_cancellation_enabled,
          'maxRoomsPerBooking', h.max_rooms_per_booking
        ))
      FROM owners o
      JOIN hotels h ON h.id = o.hotel_id
      LEFT JOIN payment_currency pc ON pc.booking_id = o.id
      WHERE b.id = o.id
    `);
    await run("bookingRooms", Prisma.sql`
      UPDATE booking_rooms br SET
        hotel_id = COALESCE(br.hotel_id, h.id),
        room_type_name_snapshot = COALESCE(br.room_type_name_snapshot, rt.name),
        room_type_slug_snapshot = COALESCE(br.room_type_slug_snapshot, rt.slug)
      FROM rooms r
      JOIN room_types rt ON rt.id = r.room_type_id
      JOIN hotels h ON h.id = rt.hotel_id
      WHERE r.id = br.room_id
    `);
    await run("roomNights", Prisma.sql`
      UPDATE room_nights rn SET hotel_id = h.id
      FROM rooms r
      JOIN room_types rt ON rt.id = r.room_type_id
      JOIN hotels h ON h.id = rt.hotel_id
      WHERE r.id = rn.room_id AND rn.hotel_id IS NULL
    `);
    await run("payments", Prisma.sql`
      WITH owners AS (
        SELECT b.id, MIN(rt.hotel_id::text)::uuid AS hotel_id
        FROM bookings b
        JOIN booking_rooms br ON br.booking_id = b.id
        JOIN rooms r ON r.id = br.room_id
        JOIN room_types rt ON rt.id = r.room_type_id
        GROUP BY b.id
      )
      UPDATE payments p SET
        hotel_id = COALESCE(p.hotel_id, h.id),
        organization_id = COALESCE(p.organization_id, h.organization_id)
      FROM owners o
      JOIN hotels h ON h.id = o.hotel_id
      WHERE p.booking_id = o.id
    `);
    await run("notifications", Prisma.sql`
      WITH owners AS (
        SELECT b.id, MIN(rt.hotel_id::text)::uuid AS hotel_id
        FROM bookings b
        JOIN booking_rooms br ON br.booking_id = b.id
        JOIN rooms r ON r.id = br.room_id
        JOIN room_types rt ON rt.id = r.room_type_id
        GROUP BY b.id
      )
      UPDATE notifications n SET
        hotel_id = COALESCE(n.hotel_id, h.id),
        organization_id = COALESCE(n.organization_id, h.organization_id)
      FROM owners o
      JOIN hotels h ON h.id = o.hotel_id
      WHERE n.booking_id = o.id
    `);

    const organizations = await tx.organization.findMany({ select: { id: true } });
    if (organizations.length !== 1) {
      throw new Error(`Expected exactly one organization for role mapping; found ${organizations.length}.`);
    }

    const users = await tx.user.findMany({
      where: { role: { in: ["ADMIN", "STAFF"] } },
      select: { id: true, role: true, isActive: true },
    });
    for (const user of users) {
      const role = user.role === "ADMIN" ? OrganizationRole.OWNER : OrganizationRole.STAFF;
      const status = user.isActive ? MemberStatus.ACTIVE : MemberStatus.REVOKED;
      await tx.organizationMember.upsert({
        where: {
          organizationId_userId: {
            organizationId: organizations[0].id,
            userId: user.id,
          },
        },
        create: {
          organizationId: organizations[0].id,
          userId: user.id,
          role,
          status,
          activatedAt: user.isActive ? new Date() : null,
          revokedAt: user.isActive ? null : new Date(),
        },
        update: {},
      });
    }
    counts.organizationMembers = users.length;
    if (rollbackAfter) throw new BackfillRollbackValidation("Backfill SQL validated; rolling back by design.");
    return counts;
  }, { isolationLevel: "Serializable", timeout: 60_000 });
}

async function main() {
  const apply = process.argv.includes("--apply");
  const check = process.argv.includes("--check");
  const baselinePath = option("baseline");
  const backupPath = option("backup");
  const maintenanceWindow = option("confirm-maintenance-window");
  if (apply && check) throw new Error("Choose either --check or --apply, not both.");
  if (process.argv.some((argument) => argument.startsWith("--") && argument !== "--apply" &&
    argument !== "--check" && !argument.startsWith("--baseline=") &&
    !argument.startsWith("--backup=") && !argument.startsWith("--confirm-maintenance-window="))) {
    throw new Error("Usage: npm run mt:backfill [-- --check | --apply --backup=path/to/backup.dump --baseline=path/to/baseline.json --confirm-maintenance-window=<approved-window>]");
  }

  await requireCleanPreflight();
  if (check) {
    const databaseUrl = process.env.DATABASE_URL;
    if (!databaseUrl || !["localhost", "127.0.0.1", "::1", "[::1]"].includes(new URL(databaseUrl).hostname)) {
      throw new Error("--check is restricted to a local database.");
    }
    try {
      await backfill(true);
    } catch (error) {
      if (error instanceof BackfillRollbackValidation) {
        console.log("\nPASS: backfill SQL completed inside a transaction and all writes were rolled back.");
        return;
      }
      throw error;
    }
    throw new Error("Rollback validation unexpectedly committed; this should not be possible.");
  }
  if (!apply) {
    console.log("\nDry run only. No records changed. Use --check to validate writes with rollback, or --apply with a verified backup, new baseline path, and approved maintenance window.");
    return;
  }
  if (!baselinePath) {
    throw new Error("--baseline=<new-file> is required with --apply so before/after reconciliation is possible.");
  }
  if (!backupPath) throw new Error("--backup=<verified-dump-file> is required with --apply.");
  if (!maintenanceWindow?.trim()) {
    throw new Error("--confirm-maintenance-window=<approved-window> is required with --apply.");
  }

  await verifyBackup(backupPath);
  const savedBaseline = await saveBaseline(baselinePath);
  console.log(`Saved pre-backfill baseline: ${savedBaseline}`);
  const counts = await backfill(false);
  console.log("Backfill complete:");
  console.log(JSON.stringify(counts, null, 2));
  console.log(`Next: npm run mt:reconcile -- --baseline=${path.relative(process.cwd(), savedBaseline)}`);
}

main()
  .catch((error) => {
    console.error("Multi-tenant backfill failed:", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
