import "../../scripts/load-env";
import { describe, it, before, after } from "node:test";
import assert from "node:assert/strict";
import { BookingStatus, PaymentStatus, PromotionType, RecordStatus, RoomStatus, UserRole } from "../../src/generated/prisma/enums";
import { ConsoleError } from "../../src/server/console/errors";
import {
  createAmenity,
  createPromotion,
  createRate,
  createRoom,
  createRoomType,
  deleteAmenity,
  deletePromotion,
  deleteRate,
  deleteRoom,
  deleteRoomType,
  updateAmenity,
  updatePromotion,
  updateRate,
  updateRoom,
  updateRoomType,
} from "../../src/server/console/catalog";
import { searchBookings } from "../../src/server/console/bookings";
import { getDashboard } from "../../src/server/console/dashboard";
import { getGuestDetail, searchGuests, updateGuest } from "../../src/server/console/guests";
import { searchPayments } from "../../src/server/console/payments";
import { searchAudit } from "../../src/server/console/audit";
import {
  CONTENT_DEFAULTS,
  deleteContent,
  getContent,
  getSettings,
  updateSettings,
  upsertContent,
} from "../../src/server/console/settings";
import { createUser, deleteUser, listUsers, updateUser } from "../../src/server/console/users";
import {
  AmenityUpsertSchema,
  PromotionUpsertSchema,
  RateUpsertSchema,
  RoomTypeUpsertSchema,
  RoomUpsertSchema,
  SettingsPatchSchema,
} from "../../src/server/console/validation";
import { createBooking, transitionBooking } from "../../src/server/booking/service";
import { TransitionError } from "../../src/server/booking/policy";
import { computeQuote } from "../../src/server/pricing/service";
import { moneyString } from "../../src/server/pricing/model";
import { hotelToday, loadHotelContext } from "../../src/server/pricing/context";
import { recordDeskPayment, refundPayment } from "../../src/server/payments/service";
import { dateOnly, loadInventory, prisma } from "../helpers";

/** P7 admin console gate: catalog CRUD, settings/content, users, guests,
 *  reservation & payment search, the dashboard and the audit trail — plus a
 *  one-week simulated operation driven entirely through the services the UI
 *  calls. */

const SUFFIX = "@p7.test";

let inventory: Awaited<ReturnType<typeof loadInventory>>;
let adminId = "";
let staffId = "";
const auditEntityIds = new Set<string>();

async function ensureUser(name: string, email: string, role: "ADMIN" | "STAFF"): Promise<string> {
  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) return existing.id;
  const created = await prisma.user.create({
    data: { name, email, passwordHash: "test-hash", role },
  });
  return created.id;
}

async function auditOf(action: string, entityId: string) {
  return prisma.auditLog.findFirst({ where: { action, entityId }, orderBy: { createdAt: "desc" } });
}

async function auditCount(where: Record<string, unknown>) {
  return prisma.auditLog.count({ where: where as never });
}

/**
 * Books a freshly created room of our own (unique `P7…` number), so the tests
 * never depend on leftover rows in the seed and never fight over stock. The
 * `after` hook sweeps rooms, bookings and guests by these markers.
 */
async function createOwnBooking(tag: string) {
  const actor = { userId: adminId };
  const hotel = await loadHotelContext();
  const today = hotelToday(new Date(), hotel.timezone);
  const checkIn = today.toISOString().slice(0, 10);
  const checkoutDay = new Date(today);
  checkoutDay.setUTCDate(checkoutDay.getUTCDate() + 1);
  const checkOut = checkoutDay.toISOString().slice(0, 10);

  const type = inventory.bySlug.get("deluxe-king")!;
  const room = await createRoom(
    RoomUpsertSchema.parse({
      roomNumber: `P7${tag[0].toUpperCase()}${Date.now().toString(36)}`,
      roomTypeId: type.id,
      status: RoomStatus.AVAILABLE,
    }),
    actor,
  );
  auditEntityIds.add(room.id);

  const email = `p7-${tag}${SUFFIX}`;
  const guest = await prisma.guest.create({
    data: { firstName: "P7", lastName: tag, email },
  });
  auditEntityIds.add(guest.id);

  const quote = await computeQuote({
    checkIn: dateOnly(checkIn),
    checkOut: dateOnly(checkOut),
    adults: 2,
    children: 0,
    roomIds: [room.id],
  });
  const booking = await createBooking(
    {
      checkIn,
      checkOut,
      adults: 2,
      children: 0,
      roomIds: [room.id],
      guest: { firstName: "P7", lastName: tag, email },
      expectedTotal: moneyString(quote.snapshot.breakdown.total),
    },
    { kind: "guest", guestId: guest.id },
  );
  auditEntityIds.add(booking.id);

  return { booking, room, guest };
}

before(async () => {
  inventory = await loadInventory();
  adminId = await ensureUser("P7 Admin", `p7-admin${SUFFIX}`, "ADMIN");
  staffId = await ensureUser("P7 Staff", `p7-staff${SUFFIX}`, "STAFF");
});

after(async () => {
  await prisma.auditLog.deleteMany({ where: { entityId: { in: [...auditEntityIds] } } });
  await prisma.payment.deleteMany({ where: { booking: { guest: { email: { endsWith: SUFFIX } } } } });
  await prisma.booking.deleteMany({ where: { guest: { email: { endsWith: SUFFIX } } } });
  await prisma.guest.deleteMany({ where: { email: { endsWith: SUFFIX } } });
  await prisma.room.deleteMany({ where: { roomNumber: { startsWith: "P7" } } });
  await prisma.rate.deleteMany({ where: { name: { startsWith: "P7" } } });
  await prisma.promotion.deleteMany({ where: { code: { startsWith: "P7" } } });
  await prisma.amenity.deleteMany({ where: { name: { startsWith: "P7" } } });
  await prisma.roomType.deleteMany({ where: { slug: { startsWith: "p7" } } });
  await prisma.siteContent.deleteMany({ where: { key: { startsWith: "p7." } } });
  await prisma.user.deleteMany({ where: { email: { endsWith: SUFFIX } } });
});

describe("P7 catalog CRUD", () => {
  it("creates, updates and deletes an amenity with an audit row", async () => {
    const actor = { userId: adminId };
    const created = await createAmenity(AmenityUpsertSchema.parse({ name: "P7 Sauna" }), actor);
    auditEntityIds.add(created.id);
    const createLog = await auditOf("amenity.create", created.id);
    assert.ok(createLog, "amenity.create must be audited");

    const updated = await updateAmenity(
      created.id,
      AmenityUpsertSchema.parse({ name: "P7 Sauna", description: "Finnish sauna" }),
      actor,
    );
    assert.equal(updated.description, "Finnish sauna");
    const updateLog = await auditOf("amenity.update", created.id);
    assert.ok(updateLog, "amenity.update must be audited");

    await deleteAmenity(created.id, actor);
    assert.equal(await prisma.amenity.findUnique({ where: { id: created.id } }), null);
    const deleteLog = await auditOf("amenity.delete", created.id);
    assert.ok(deleteLog, "amenity.delete must be audited");
  });

  it("rejects a duplicate amenity name with a conflict", async () => {
    const actor = { userId: adminId };
    const first = await createAmenity(AmenityUpsertSchema.parse({ name: "P7 Duplicated" }), actor);
    auditEntityIds.add(first.id);
    await assert.rejects(
      () => createAmenity(AmenityUpsertSchema.parse({ name: "P7 Duplicated" }), actor),
      (error: unknown) => error instanceof ConsoleError && error.code === "conflict",
    );
    await deleteAmenity(first.id, actor);
  });

  it("creates a room type, edits pricing and refuses deleting one still in use", async () => {
    const actor = { userId: adminId };
    const amenity = await createAmenity(AmenityUpsertSchema.parse({ name: "P7 Minibar" }), actor);
    auditEntityIds.add(amenity.id);

    const type = await createRoomType(
      RoomTypeUpsertSchema.parse({
        name: "P7 Test Suite",
        slug: "p7-test-suite",
        maxAdults: 2,
        maxChildren: 1,
        basePrice: "249.00",
        amenityIds: [amenity.id],
      }),
      actor,
    );
    auditEntityIds.add(type.id);
    const createLog = await auditOf("room_type.create", type.id);
    assert.ok(createLog, "room_type.create must be audited");
    assert.ok(
      (createLog?.newValues as Record<string, unknown> | null)?.name === "P7 Test Suite",
      "audit new values carry the created row",
    );

    await assert.rejects(
      () =>
        createRoomType(
          RoomTypeUpsertSchema.parse({
            name: "P7 Test Suite",
            slug: "p7-test-suite-dup",
            maxAdults: 2,
            maxChildren: 0,
            basePrice: "199.00",
          }),
          actor,
        ),
      (error: unknown) => error instanceof ConsoleError && error.code === "conflict",
    );

    const updated = await updateRoomType(
      type.id,
      RoomTypeUpsertSchema.parse({
        name: "P7 Test Suite",
        slug: "p7-test-suite",
        maxAdults: 3,
        maxChildren: 1,
        basePrice: "279.00",
        status: RecordStatus.ACTIVE,
        amenityIds: [amenity.id],
      }),
      actor,
    );
    assert.equal(updated.maxAdults, 3);
    assert.equal(Number(updated.basePrice), 279);
    const updateLog = await auditOf("room_type.update", type.id);
    assert.ok(updateLog, "room_type.update must be audited");

    const room = await createRoom(
      RoomUpsertSchema.parse({
        roomNumber: "P7-101",
        floor: 1,
        roomTypeId: type.id,
        status: RoomStatus.AVAILABLE,
      }),
      actor,
    );
    auditEntityIds.add(room.id);

    // With a room attached the delete is refused (destructive guard).
    await assert.rejects(
      () => deleteRoomType(type.id, actor),
      (error: unknown) => error instanceof ConsoleError && error.code === "in_use",
    );

    await deleteRoom(room.id, actor);
    await deleteRoomType(type.id, actor);
    await deleteAmenity(amenity.id, actor);
  });

  it("enforces the housekeeping transition table on room edits", async () => {
    const actor = { userId: adminId };
    const type = inventory.bySlug.get("deluxe-king")!;
    const room = await createRoom(
      RoomUpsertSchema.parse({
        roomNumber: `P7-${Date.now().toString(36)}`,
        roomTypeId: type.id,
        status: RoomStatus.AVAILABLE,
      }),
      actor,
    );
    auditEntityIds.add(room.id);

    const cleaning = await updateRoom(
      room.id,
      RoomUpsertSchema.parse({
        roomNumber: room.roomNumber,
        roomTypeId: type.id,
        status: RoomStatus.CLEANING,
      }),
      actor,
    );
    assert.equal(cleaning.status, RoomStatus.CLEANING);

    const base = RoomUpsertSchema.parse({
      roomNumber: room.roomNumber,
      roomTypeId: type.id,
      status: RoomStatus.CLEANING,
    });
    await assert.rejects(
      () => updateRoom(room.id, { ...base, status: RoomStatus.OCCUPIED }, actor),
      (error: unknown) => error instanceof TransitionError && error.code === "invalid_room_transition",
    );

    await deleteRoom(room.id, actor);
  });

  it("refuses deleting a room that has reservation history", async () => {
    const actor = { userId: adminId };
    const { room } = await createOwnBooking("hist");
    await assert.rejects(
      () => deleteRoom(room.id, actor),
      (error: unknown) => error instanceof ConsoleError && error.code === "in_use",
    );
    assert.ok(await prisma.room.findUnique({ where: { id: room.id } }), "the room is kept");
  });

  it("manages seasonal rates", async () => {
    const actor = { userId: adminId };
    const type = inventory.bySlug.get("deluxe-king")!;
    const rate = await createRate(
      RateUpsertSchema.parse({
        roomTypeId: type.id,
        name: "P7 Festive",
        amount: "329.00",
        startDate: "2027-12-01",
        endDate: "2027-12-31",
      }),
      actor,
    );
    auditEntityIds.add(rate.id);
    assert.ok(await auditOf("rate.create", rate.id));

    const updated = await updateRate(
      rate.id,
      RateUpsertSchema.parse({
        roomTypeId: type.id,
        name: "P7 Festive",
        amount: "359.00",
        startDate: "2027-12-01",
        endDate: "2027-12-31",
        status: RecordStatus.ACTIVE,
      }),
      actor,
    );
    assert.equal(Number(updated.amount), 359);
    assert.ok(await auditOf("rate.update", rate.id));

    await deleteRate(rate.id, actor);
    assert.ok(await auditOf("rate.delete", rate.id));
  });

  it("manages promotions and guards redeemed codes", async () => {
    const actor = { userId: adminId };
    const startAt = new Date(Date.now() + 86_400_000).toISOString();
    const endAt = new Date(Date.now() + 7 * 86_400_000).toISOString();
    const promotion = await createPromotion(
      PromotionUpsertSchema.parse({
        code: "P7WEEK",
        type: PromotionType.PERCENTAGE,
        value: "10",
        startAt,
        endAt,
        maxUses: 5,
      }),
      actor,
    );
    auditEntityIds.add(promotion.id);
    assert.equal(promotion.code, "P7WEEK");
    assert.ok(await auditOf("promotion.create", promotion.id));

    await assert.rejects(
      () =>
        createPromotion(
          PromotionUpsertSchema.parse({
            code: "P7WEEK",
            type: PromotionType.PERCENTAGE,
            value: "15",
            startAt,
            endAt,
          }),
          actor,
        ),
      (error: unknown) => error instanceof ConsoleError && error.code === "conflict",
    );

    const updated = await updatePromotion(
      promotion.id,
      PromotionUpsertSchema.parse({
        code: "P7WEEK2",
        type: PromotionType.PERCENTAGE,
        value: "15",
        startAt,
        endAt,
        status: RecordStatus.ACTIVE,
      }),
      actor,
    );
    assert.equal(updated.code, "P7WEEK2");
    assert.ok(await auditOf("promotion.update", promotion.id));

    await deletePromotion(promotion.id, actor);
    assert.ok(await auditOf("promotion.delete", promotion.id));
  });
});

describe("P7 settings & content", () => {
  it("applies a partial settings patch and audits old → new values", async () => {
    const before = await getSettings();
    const beforeCount = await auditCount({
      action: "settings.update",
      entityType: "hotel",
      entityId: before.id,
    });

    const updated = await updateSettings(
      { taxRatePercent: 8.5, checkInTime: "15:00" },
      { userId: adminId },
    );
    auditEntityIds.add(before.id);
    assert.equal(Number(updated.taxRatePercent), 8.5);
    assert.equal(updated.checkInTime, "15:00");

    const log = await prisma.auditLog.findFirst({
      where: { action: "settings.update", entityId: before.id },
      orderBy: { createdAt: "desc" },
    });
    assert.ok(log, "settings.update must be audited");
    assert.equal(
      Number((log!.oldValues as Record<string, unknown>).taxRatePercent),
      Number(before.taxRatePercent),
    );
    assert.equal(Number((log!.newValues as Record<string, unknown>).taxRatePercent), 8.5);

    // The running app picks the change up on the very next read.
    const hotel = await loadHotelContext();
    assert.equal(hotel.checkInTime, "15:00");

    // A no-op patch writes nothing and no audit row.
    await updateSettings({ taxRatePercent: 8.5, checkInTime: "15:00" }, { userId: adminId });
    const afterCount = await auditCount({
      action: "settings.update",
      entityType: "hotel",
      entityId: before.id,
    });
    assert.equal(afterCount, beforeCount + 1, "no audit row for a no-op patch");

    await updateSettings(
      { taxRatePercent: Number(before.taxRatePercent), checkInTime: before.checkInTime },
      { userId: adminId },
    );
  });

  it("rejects out-of-range settings at the wire boundary", () => {
    assert.equal(SettingsPatchSchema.safeParse({ taxRatePercent: -1 }).success, false);
    assert.equal(SettingsPatchSchema.safeParse({ taxRatePercent: 101 }).success, false);
    assert.equal(SettingsPatchSchema.safeParse({ checkInTime: "25:00" }).success, false);
    assert.equal(SettingsPatchSchema.safeParse({ currency: "RINGGIT" }).success, false);
    assert.equal(SettingsPatchSchema.safeParse({}).success, false, "empty patch is rejected");
  });

  it("edits and resets website content slots", async () => {
    const key = "p7.test-slot";
    const created = await upsertContent(
      { key, title: "P7 hello", body: "P7 body" },
      { userId: adminId },
    );
    auditEntityIds.add(key);
    assert.equal(created.title, "P7 hello");
    assert.ok(await auditOf("content.create", key));

    await upsertContent({ key, title: "P7 hello v2", body: "P7 body v2" }, { userId: adminId });
    assert.ok(await auditOf("content.update", key));
    assert.equal((await getContent(key))?.title, "P7 hello v2");

    await deleteContent(key, { userId: adminId });
    assert.ok(await auditOf("content.delete", key));
    assert.equal(await getContent(key), null, "reset removes the row; unknown keys have no default");

    // The built-in slots keep serving their defaults until edited.
    const hero = await getContent("home.hero");
    assert.equal(hero?.title, CONTENT_DEFAULTS["home.hero"].title);
  });
});

describe("P7 users & permissions", () => {
  it("creates, renames and deletes an account with audit rows", async () => {
    const actor = { userId: adminId };
    const email = `p7-created${SUFFIX}`;
    const created = await createUser(
      { name: "P7 Created", email, password: "password123", role: UserRole.STAFF },
      actor,
    );
    auditEntityIds.add(created.id);
    assert.ok(await auditOf("user.create", created.id));

    const stored = await prisma.user.findUnique({ where: { id: created.id } });
    assert.ok(stored?.passwordHash && stored.passwordHash !== "password123", "password must be hashed");

    const renamed = await updateUser(created.id, { name: "P7 Renamed" }, actor);
    assert.equal(renamed.name, "P7 Renamed");
    assert.ok(await auditOf("user.update", created.id));

    const promoted = await updateUser(created.id, { role: UserRole.ADMIN }, actor);
    assert.equal(promoted.role, UserRole.ADMIN);
    const permissionLog = await auditOf("permission.change", created.id);
    assert.ok(permissionLog, "role changes keep their permission.change action");

    await deleteUser(created.id, actor);
    assert.equal(await prisma.user.findUnique({ where: { id: created.id } }), null);
    assert.ok(await auditOf("user.delete", created.id));
  });

  it("refuses duplicate e-mails", async () => {
    const actor = { userId: adminId };
    const email = `p7-dupe${SUFFIX}`;
    const first = await createUser(
      { name: "P7 Dupe", email, password: "password123", role: UserRole.STAFF },
      actor,
    );
    auditEntityIds.add(first.id);
    await assert.rejects(
      () => createUser({ name: "P7 Dupe", email, password: "password123", role: UserRole.STAFF }, actor),
      (error: unknown) => error instanceof ConsoleError && error.code === "conflict",
    );
    await deleteUser(first.id, actor);
  });

  it("refuses self-demotion, self-deletion and removing the last admin", async () => {
    const actor = { userId: adminId };
    await assert.rejects(
      () => updateUser(adminId, { role: UserRole.STAFF }, actor),
      (error: unknown) => error instanceof ConsoleError && error.code === "cannot_change_self",
    );
    await assert.rejects(
      () => deleteUser(adminId, actor),
      (error: unknown) => error instanceof ConsoleError && error.code === "cannot_delete_self",
    );

    // Isolate the last-admin guard: a lone admin must not be able to lose
    // admin status (role or active flag), so every *other* active admin —
    // including the actor — steps aside first.
    const lone = await ensureUser("P7 Lone Admin", `p7-lone-admin${SUFFIX}`, "ADMIN");
    auditEntityIds.add(lone);
    const others = await prisma.user.findMany({
      where: { role: UserRole.ADMIN, isActive: true, id: { not: lone } },
      select: { id: true },
    });
    await prisma.user.updateMany({
      where: { id: { in: others.map((row) => row.id) } },
      data: { isActive: false },
    });
    try {
      await assert.rejects(
        () => updateUser(lone, { role: UserRole.STAFF }, actor),
        (error: unknown) => error instanceof ConsoleError && error.code === "last_admin",
      );
      await assert.rejects(
        () => updateUser(lone, { isActive: false }, actor),
        (error: unknown) => error instanceof ConsoleError && error.code === "last_admin",
      );
      await assert.rejects(
        () => deleteUser(lone, actor),
        (error: unknown) => error instanceof ConsoleError && error.code === "last_admin",
      );
    } finally {
      await prisma.user.updateMany({
        where: { id: { in: others.map((row) => row.id) } },
        data: { isActive: true },
      });
      await prisma.user.delete({ where: { id: lone } });
      auditEntityIds.delete(lone);
    }
  });

  it("deactivates an account so it can no longer sign in", async () => {
    const actor = { userId: adminId };
    const email = `p7-toggle${SUFFIX}`;
    const user = await createUser(
      { name: "P7 Toggle", email, password: "password123", role: UserRole.STAFF },
      actor,
    );
    auditEntityIds.add(user.id);
    const deactivated = await updateUser(user.id, { isActive: false }, actor);
    assert.equal(deactivated.isActive, false);

    const login = await prisma.user.findUnique({ where: { email } });
    assert.equal(login?.isActive, false);

    await deleteUser(user.id, actor);
    assert.ok((await listUsers()).every((row) => row.email !== email));
  });
});

describe("P7 guests, reservations & payments", () => {
  it("corrects guest contact details and records guest.update", async () => {
    const email = `p7-guest${SUFFIX}`;
    const guest = await prisma.guest.create({
      data: { firstName: "P7", lastName: "Guest", email },
    });
    auditEntityIds.add(guest.id);

    const other = await prisma.guest.create({
      data: { firstName: "P7", lastName: "Other", email: `p7-other${SUFFIX}` },
    });
    auditEntityIds.add(other.id);

    const updated = await updateGuest(
      guest.id,
      { phone: "+60123456789", idType: "Passport", idNumber: "P123456" },
      { userId: staffId },
    );
    assert.equal(updated.phone, "+60123456789");
    assert.ok(await auditOf("guest.update", guest.id));

    await assert.rejects(
      () => updateGuest(guest.id, { email: other.email! }, { userId: staffId }),
      (error: unknown) => error instanceof ConsoleError && error.code === "conflict",
    );

    const detail = await getGuestDetail(guest.id);
    assert.equal(detail.idType, "Passport");

    const found = await searchGuests({ q: "p7-guest", page: 1, pageSize: 10 });
    assert.ok(found.rows.some((row) => row.id === guest.id));
  });

  it("finds reservations by reference, status, guest and room number", async () => {
    const { booking, room } = await createOwnBooking("search");

    const byReference = await searchBookings({
      q: booking.bookingReference,
      page: 1,
      pageSize: 10,
    });
    assert.equal(byReference.rows.length, 1);
    assert.equal(byReference.rows[0].id, booking.id);

    const byStatus = await searchBookings({
      status: booking.bookingStatus,
      page: 1,
      pageSize: 100,
    });
    assert.ok(byStatus.rows.some((row) => row.id === booking.id));

    const byRoom = await searchBookings({ q: room.roomNumber, page: 1, pageSize: 100 });
    assert.ok(byRoom.rows.some((row) => row.id === booking.id));

    const firstPage = await searchBookings({ page: 1, pageSize: 1 });
    assert.equal(firstPage.page, 1);
    assert.ok(firstPage.total >= 1, "at least one reservation exists");
  });

  it("returns an empty page for a query that matches nothing", async () => {
    const empty = await searchBookings({ q: "NO-SUCH-REFERENCE-P7", page: 1, pageSize: 25 });
    assert.equal(empty.total, 0);
    assert.equal(empty.rows.length, 0);
  });

  it("lists the payment ledger with booking correlation", async () => {
    const rows = await searchPayments({ status: PaymentStatus.PAID, page: 1, pageSize: 5 });
    for (const row of rows.rows) {
      assert.ok(row.bookingReference.length > 0);
      assert.equal(row.status, "PAID");
    }
    const filtered = await searchPayments({
      reference: "NO-SUCH-REF-P7",
      page: 1,
      pageSize: 25,
    });
    assert.equal(filtered.total, 0);
  });
});

describe("P7 dashboard", () => {
  it("computes the front-desk morning view from live tables", async () => {
    const board = await getDashboard(new Date());
    assert.equal(board.board.nights.length, 7);
    assert.ok(board.board.rooms.length > 0, "the board lists every physical room");
    assert.ok(Number(board.occupancy.percent) >= 0 && Number(board.occupancy.percent) <= 100);
    assert.ok(board.occupancy.sellable <= board.board.rooms.length);
    assert.ok(Array.isArray(board.arrivals) && Array.isArray(board.departures));
    assert.ok(board.housekeeping.available <= board.board.rooms.length);
  });
});

describe("P7 week of simulated operations", () => {
  it("drives a stay from quote to check-out, refund and audit trail", async () => {
    const actor = { userId: adminId };
    const staff = { kind: "staff" as const, userId: staffId, email: `p7-staff${SUFFIX}` };
    const hotel = await loadHotelContext();
    const today = hotelToday(new Date(), hotel.timezone);
    const checkIn = today.toISOString().slice(0, 10);
    const checkOut = dateOnly(today.toISOString().slice(0, 10));
    checkOut.setUTCDate(checkOut.getUTCDate() + 2);
    const checkOutIso = checkOut.toISOString().slice(0, 10);

    const email = `p7-week${SUFFIX}`;
    const guest = await prisma.guest.create({
      data: { firstName: "P7", lastName: "Week", email },
    });
    auditEntityIds.add(guest.id);

    // A room of our own so the simulation never fights other tests for stock.
    const type = inventory.bySlug.get("deluxe-king")!;
    const room = await createRoom(
      RoomUpsertSchema.parse({
        roomNumber: `P7W-${Date.now().toString(36)}`,
        roomTypeId: type.id,
        status: RoomStatus.AVAILABLE,
      }),
      actor,
    );
    auditEntityIds.add(room.id);

    // 1. Quote and reserve (day 0).
    const quote = await computeQuote({
      checkIn: dateOnly(checkIn),
      checkOut: dateOnly(checkOutIso),
      adults: 2,
      children: 0,
      roomIds: [room.id],
    });
    const booking = await createBooking(
      {
        checkIn,
        checkOut: checkOutIso,
        adults: 2,
        children: 0,
        roomIds: [room.id],
        guest: { firstName: "P7", lastName: "Week", email },
        expectedTotal: moneyString(quote.snapshot.breakdown.total),
      },
      { kind: "guest", guestId: guest.id },
    );
    auditEntityIds.add(booking.id);

    // The desk finds it straight away.
    const found = await searchBookings({ q: booking.bookingReference, page: 1, pageSize: 10 });
    assert.equal(found.rows[0]?.id, booking.id);
    assert.equal(found.rows[0]?.bookingStatus, BookingStatus.PENDING);

    // 2. Morning dashboard lists it as an arrival.
    const arrivals = await getDashboard(new Date());
    assert.ok(
      arrivals.arrivals.some((row) => row.id === booking.id),
      "a same-day booking shows up in arrivals",
    );

    // 3. Confirm and capture the money at the desk.
    await transitionBooking({ bookingId: booking.id, to: BookingStatus.CONFIRMED }, staff);
    const payment = await recordDeskPayment(booking.id, { userId: staffId });
    auditEntityIds.add(payment.id);

    const paid = await searchPayments({ reference: booking.bookingReference, page: 1, pageSize: 5 });
    assert.equal(paid.rows[0]?.status, PaymentStatus.PAID);
    assert.ok(await auditOf("payment.desk_capture", payment.id));

    // 4. Check-in once the arrival date arrives.
    await transitionBooking({ bookingId: booking.id, to: BookingStatus.CHECKED_IN }, staff);
    const inHouse = await getDashboard(new Date());
    assert.ok(inHouse.inHouse.some((row) => row.id === booking.id));

    // 5. Check-out on the same simulated day, then refund the stay.
    await transitionBooking({ bookingId: booking.id, to: BookingStatus.CHECKED_OUT }, staff);
    await refundPayment({ paymentId: payment.id }, { userId: staffId });
    assert.ok(await auditOf("payment.refund", payment.id));

    const refunded = await searchPayments({
      status: PaymentStatus.REFUNDED,
      reference: booking.bookingReference,
      page: 1,
      pageSize: 5,
    });
    assert.equal(refunded.rows.length, 1);

    // 6. The guest record shows the stay and the money.
    const detail = await getGuestDetail(guest.id);
    assert.equal(detail.bookings[0].bookingReference, booking.bookingReference);
    assert.equal(detail.payments[0].status, "REFUNDED");

    // 7. Every step of the week is on the audit trail.
    for (const action of ["booking.create", "booking.transition", "payment.desk_capture", "payment.refund"]) {
      const hits = await searchAudit({ action, page: 1, pageSize: 100 });
      assert.ok(
        hits.rows.some(
          (row) => row.entityId === booking.id || row.entityId === payment.id,
        ),
        `expected an audit row for ${action}`,
      );
    }

    // The 7-night board carries the sold nights for our room.
    const board = await getDashboard(new Date());
    const ourRow = board.board.rooms.find((row) => row.id === room.id);
    assert.ok(ourRow, "the simulated room appears on the board");
    assert.ok(
      ourRow!.cells.some((cell) => cell.kind === "sold"),
      "sold nights are rendered on the availability board",
    );
  });
});
