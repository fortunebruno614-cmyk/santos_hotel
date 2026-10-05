import "./load-env";
import { prisma } from "../src/lib/prisma";

type Result = { name: string; ok: boolean; detail: string };
const results: Result[] = [];

type Mode = "planner" | "forced";

async function plan(sql: string, mode: Mode): Promise<string> {
  if (mode === "forced") await prisma.$executeRawUnsafe(`SET enable_seqscan = off`);
  const rows = await prisma.$queryRawUnsafe<Array<{ ["QUERY PLAN"]: string }>>(
    `EXPLAIN (ANALYZE, BUFFERS) ${sql}`,
  );
  if (mode === "forced") await prisma.$executeRawUnsafe(`SET enable_seqscan = on`);
  return rows.map((r) => r["QUERY PLAN"]).join("\n");
}

async function explain(label: string, sql: string, expectedIndex: string) {
  const natural = await plan(sql, "planner");
  if (natural.includes(expectedIndex)) {
    results.push({ name: label, ok: true, detail: `planner picked ${expectedIndex}` });
    return natural;
  }
  const forced = await plan(sql, "forced");
  const ok = forced.includes(expectedIndex);
  results.push({
    name: label,
    ok,
    detail: ok
      ? `index usable (forced; dev-scale rows make seq scan cheaper) -- ${expectedIndex}`
      : `MISSING ${expectedIndex}\nforced plan:\n${forced}`,
  });
  return natural;
}

async function seedWorkload() {
  await prisma.$executeRawUnsafe(`DELETE FROM payments WHERE provider_reference LIKE 'IDX-%'`);
  await prisma.$executeRawUnsafe(`DELETE FROM booking_rooms WHERE booking_id IN (SELECT id FROM bookings WHERE booking_reference LIKE 'IDX-%')`);
  await prisma.$executeRawUnsafe(`DELETE FROM bookings WHERE booking_reference LIKE 'IDX-%'`);

  const guestIds: string[] = [];
  for (let g = 0; g < 60; g++) {
    const guest = await prisma.guest.upsert({
      where: { email: `idx-guest-${g}@santohotel.test` },
      update: {},
      create: { firstName: `Idx${g}`, lastName: "Guest", email: `idx-guest-${g}@santohotel.test` },
    });
    guestIds.push(guest.id);
  }

  const rooms = await prisma.room.findMany({ select: { id: true }, orderBy: { roomNumber: "asc" } });
  if (rooms.length === 0) {
    throw new Error("No rooms found - run `npm run db:seed` before the index check.");
  }

  const total = 5000;
  for (let start = 0; start < total; start += 500) {
    const rows: Array<[string, string, Date, Date, string]> = [];
    for (let i = start; i < start + 500; i++) {
      const checkIn = new Date(Date.UTC(2026, 0, 1) + (i % 400) * 86400_000);
      const checkOut = new Date(checkIn.getTime() + 2 * 86400_000);
      const bucket = i % 20;
      const status =
        bucket < 10
          ? "CONFIRMED"
          : bucket < 15
            ? "CHECKED_OUT"
            : bucket < 18
              ? "PENDING"
              : bucket < 19
                ? "NO_SHOW"
                : "CANCELLED";
      rows.push([
        `IDX-2026-${String(i).padStart(6, "0")}`,
        guestIds[i % guestIds.length],
        checkIn,
        checkOut,
        status,
      ]);
    }
    await prisma.$executeRawUnsafe(
      `INSERT INTO bookings (id, booking_reference, guest_id, check_in, check_out, adults, children, subtotal, taxes, fees, discount, total, booking_status, payment_status, created_at, updated_at)
       SELECT gen_random_uuid(), r.ref, r.guest::uuid, r.ci::date, r.co::date, 2, 0, 400, 40, 10, 0, 450, r.status::"BookingStatus", 'PENDING', now(), now()
       FROM (VALUES ${rows
         .map((r) => `('${r[0]}','${r[1]}','${r[2].toISOString()}','${r[3].toISOString()}','${r[4]}')`)
         .join(",")}) AS r(ref, guest, ci, co, status)
       ON CONFLICT (booking_reference) DO NOTHING`,
    );
  }

  await prisma.$executeRawUnsafe(
    `INSERT INTO booking_rooms (id, booking_id, room_id, nightly_rate, nights, room_total, created_at)
     SELECT gen_random_uuid(), b.id, (SELECT id FROM rooms ORDER BY room_number OFFSET (b.x % 9) LIMIT 1), 200, 2, 400, now()
     FROM (SELECT id, row_number() OVER () - 1 AS x FROM bookings WHERE booking_reference LIKE 'IDX-%') b`,
  );

  await prisma.$executeRawUnsafe(
    `INSERT INTO payments (id, booking_id, provider, provider_reference, amount, currency, status, refunded_amount, created_at, updated_at)
     SELECT gen_random_uuid(), b.id, 'stripe', 'IDX-' || b.booking_reference, 450, 'MYR', 'PAID', 0, now(), now()
     FROM (SELECT id, booking_reference FROM bookings WHERE booking_reference LIKE 'IDX-%') b`,
  );

  await prisma.$executeRawUnsafe(`ANALYZE bookings, booking_rooms, payments, rooms`);

  const counts = await prisma.$queryRawUnsafe<Array<Record<string, bigint>>>(
    `SELECT (SELECT count(*) FROM bookings) AS bookings, (SELECT count(*) FROM booking_rooms) AS booking_rooms, (SELECT count(*) FROM payments) AS payments`,
  );
  const c = counts[0];
  console.log(
    `workload: bookings=${Number(c.bookings)} booking_rooms=${Number(c.booking_rooms)} payments=${Number(c.payments)}`,
  );
}

async function main() {
  await seedWorkload();

  const rooms = await prisma.room.findMany({ select: { id: true }, orderBy: { roomNumber: "asc" } });
  const twoRooms = rooms.slice(0, 2).map((r) => `'${r.id}'`).join(",");
  const allRooms = rooms.map((r) => `'${r.id}'`).join(",");

  await explain(
    "bookings.booking_reference lookup",
    `SELECT * FROM bookings WHERE booking_reference = 'IDX-2026-001500'`,
    "bookings_booking_reference_key",
  );

  const guestId = (
    await prisma.$queryRawUnsafe<Array<{ id: string }>>(
      `SELECT id FROM guests WHERE email = 'idx-guest-7@santohotel.test'`,
    )
  )[0].id;

  await explain(
    "bookings.guest_id (history)",
    `SELECT * FROM bookings WHERE guest_id = '${guestId}' ORDER BY created_at DESC`,
    "bookings_guest_id_idx",
  );

  await explain(
    "bookings.check_in (prefix of composite)",
    `SELECT * FROM bookings WHERE check_in >= DATE '2026-06-01' AND check_in < DATE '2026-06-08'`,
    "bookings_check_in_check_out_idx",
  );

  await explain(
    "bookings.check_out (departures board)",
    `SELECT * FROM bookings WHERE check_out = DATE '2026-04-15'`,
    "bookings_check_out_idx",
  );

  await explain(
    "bookings.booking_status (prefix of composite)",
    `SELECT * FROM bookings WHERE booking_status = 'NO_SHOW'`,
    "bookings_booking_status_check_in_check_out_idx",
  );

  await explain(
    "rooms.room_type_id",
    `SELECT * FROM rooms WHERE room_type_id = (SELECT id FROM room_types ORDER BY slug LIMIT 1)`,
    "rooms_room_type_id_idx",
  );

  await explain(
    "rooms.status",
    `SELECT * FROM rooms WHERE status = 'AVAILABLE'`,
    "rooms_status_idx",
  );

  await explain(
    "booking_rooms.booking_id (prefix of unique)",
    `SELECT * FROM booking_rooms WHERE booking_id = (SELECT b.id FROM bookings b JOIN booking_rooms br ON br.booking_id = b.id LIMIT 1)`,
    "booking_rooms_booking_id_room_id_key",
  );

  await explain(
    "payments.booking_id",
    `SELECT * FROM payments WHERE booking_id = (SELECT b.id FROM bookings b JOIN payments p ON p.booking_id = b.id LIMIT 1)`,
    "payments_booking_id_idx",
  );

  await explain(
    "payments.provider_reference lookup",
    `SELECT * FROM payments WHERE provider_reference = 'IDX-IDX-2026-001500'`,
    "payments_provider_reference_key",
  );

  // The P4 overlap query: exclusion set for a requested stay.
  const overlapSql = `SELECT b.id FROM bookings b
     WHERE b.booking_status IN ('CONFIRMED','CHECKED_IN','PENDING')
       AND b.check_in < DATE '2026-01-13'
       AND b.check_out > DATE '2026-01-10'`;

  const overlapNatural = await plan(overlapSql, "planner");
  results.push({
    name: "OVERLAP: bookings composite chosen by planner",
    ok:
      overlapNatural.includes("bookings_booking_status_check_in_check_out_idx") ||
      overlapNatural.includes("bookings_check_in_check_out_idx"),
    detail: overlapNatural.split("\n")[0],
  });

  await explain(
    "OVERLAP: booking_rooms (room_id, booking_id) side",
    `SELECT br.booking_id FROM booking_rooms br WHERE br.room_id IN (${twoRooms})`,
    "booking_rooms_room_id_booking_id_idx",
  );

  const fullSql = `SELECT DISTINCT br.room_id
     FROM booking_rooms br
     JOIN bookings b ON b.id = br.booking_id
     WHERE br.room_id IN (${allRooms})
       AND b.booking_status IN ('CONFIRMED','CHECKED_IN','PENDING')
       AND b.check_in < DATE '2026-01-13'
       AND b.check_out > DATE '2026-01-10'`;

  const fullNatural = await plan(fullSql, "planner");
  results.push({
    name: "OVERLAP: full P4 join avoids seq scan on bookings",
    ok: !/Seq Scan on bookings/.test(fullNatural),
    detail: fullNatural.split("\n").filter((l) => /Index|Seq Scan/.test(l)).join(" | ").slice(0, 300),
  });
  await explain(
    "OVERLAP: full P4 join uses bookings composite (forced)",
    fullSql,
    "bookings_booking_status_check_in_check_out_idx",
  );

  const failed = results.filter((r) => !r.ok);
  for (const result of results) {
    console.log(`${result.ok ? "PASS" : "FAIL"}  ${result.name} -- ${result.detail}`);
  }
  console.log(`\n${results.length - failed.length}/${results.length} index checks passed.`);
  if (failed.length > 0) process.exitCode = 1;
}

main()
  .catch((error) => {
    console.error("Index check failed:", error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
