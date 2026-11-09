import "../../scripts/load-env";
import { after, before, beforeEach, describe, it } from "node:test";
import assert from "node:assert/strict";
import { NotificationStatus } from "../../src/generated/prisma/enums";
import {
  prisma,
  dateOnly,
  loadInventory,
  testHotelId,
  testOrganizationId,
  withStaffTenant,
} from "../helpers";
import {
  createBooking,
  cancelBooking,
  transitionBooking,
  type StaffActor,
} from "../../src/server/booking/service";
import { recordDeskPayment } from "../../src/server/payments/service";
import { computeQuote } from "../../src/server/pricing/service";
import { moneyString } from "../../src/server/pricing/model";
import {
  notifyBookingEvent,
  sendTestNotification,
} from "../../src/server/notifications/service";
import {
  setEmailTransportForTests,
  type EmailMessage,
} from "../../src/server/notifications/provider";

const SUFFIX = "@notify.test";
const ADMIN_EMAIL = `admin${SUFFIX}`;

let hotelId = "";
let organizationId = "";
let staffId = "";
let inventory: Awaited<ReturnType<typeof loadInventory>>;
let sent: EmailMessage[] = [];

function installTransport(options: { fail?: boolean } = {}) {
  sent = [];
  setEmailTransportForTests({
    async send(message) {
      if (options.fail) throw new Error("simulated_resend_failure");
      sent.push(message);
      return { id: `fake_${sent.length}` };
    },
  });
}

async function quotedTotal(roomId: string, checkIn: string, checkOut: string): Promise<string> {
  const quote = await computeQuote({
    hotelId,
    checkIn: dateOnly(checkIn),
    checkOut: dateOnly(checkOut),
    adults: 2,
    children: 0,
    roomIds: [roomId],
  });
  return moneyString(quote.snapshot.breakdown.total);
}

async function waitFor(
  label: string,
  predicate: () => boolean | Promise<boolean>,
  timeoutMs = 5_000,
): Promise<void> {
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    if (await predicate()) return;
    await new Promise((resolve) => setTimeout(resolve, 50));
  }
  assert.fail(`timed out waiting for ${label}`);
}

async function makeBooking(guestEmail: string, checkIn = "2027-12-01", checkOut = "2027-12-03") {
  const room = inventory.bySlug.get("deluxe-king")!.rooms[0];
  const total = await quotedTotal(room.id, checkIn, checkOut);
  return createBooking(
    {
      hotelId,
      checkIn,
      checkOut,
      adults: 2,
      children: 0,
      roomIds: [room.id],
      guest: { firstName: "Nadia", lastName: "Tester", email: guestEmail },
      expectedTotal: total,
    },
    { kind: "anonymous" },
  );
}

async function cleanup() {
  await prisma.notification.deleteMany({ where: { recipient: { endsWith: SUFFIX } } });
  await prisma.payment.deleteMany({
    where: { booking: { guest: { email: { endsWith: SUFFIX } } } },
  });
  await prisma.booking.deleteMany({
    where: { guest: { email: { endsWith: SUFFIX } } },
  });
  await prisma.guest.deleteMany({ where: { email: { endsWith: SUFFIX } } });
}

describe("Resend notification workflow", () => {
  before(async () => {
    hotelId = await testHotelId();
    organizationId = await testOrganizationId();
    inventory = await loadInventory();
    staffId = (await prisma.user.findFirst({ where: { role: "ADMIN" }, select: { id: true } }))!.id;
    process.env.EMAIL_ENABLED = "true";
    process.env.HOTEL_NOTIFICATION_EMAIL = ADMIN_EMAIL;
    process.env.APP_URL = "https://santohotel.test";
  });

  beforeEach(async () => {
    await cleanup();
    installTransport();
  });

  after(async () => {
    await cleanup();
    setEmailTransportForTests(null);
    process.env.EMAIL_ENABLED = "false";
    delete process.env.HOTEL_NOTIFICATION_EMAIL;
    await prisma.$disconnect();
  });

  it("sends a guest receipt and an admin new-booking email from the booking workflow", async () => {
    const guestEmail = `guest-received${SUFFIX}`;
    const booking = await makeBooking(guestEmail);

    await waitFor("booking received + admin new emails", () => sent.length >= 2);

    const guest = sent.find((message) => message.to.includes(guestEmail));
    const admin = sent.find((message) => message.to.includes(ADMIN_EMAIL));
    assert.ok(guest, "guest receipt was sent");
    assert.ok(admin, "admin new-booking alert was sent");
    assert.match(guest.subject, /received/i);
    assert.match(guest.html, /SANTO/);
    assert.match(guest.html, new RegExp(booking.bookingReference));
    assert.match(guest.html, /Deluxe King/);
    assert.match(guest.html, /Nadia Tester/);
    assert.match(admin.subject, /New reservation/);
    assert.match(admin.html, /Open in admin/);

    const rows = await prisma.notification.findMany({ where: { bookingId: booking.id } });
    assert.ok(rows.length >= 2);
    assert.ok(rows.every((row) => row.status === NotificationStatus.SENT));
    assert.ok(rows.every((row) => Boolean(row.providerId)));
    assert.ok(rows.some((row) => row.recipient === guestEmail));
    assert.ok(rows.some((row) => row.recipient === ADMIN_EMAIL));
  });

  it("does not send the same business notification twice", async () => {
    const guestEmail = `guest-dedupe${SUFFIX}`;
    const booking = await makeBooking(guestEmail);
    await waitFor("initial emails", () => sent.length >= 2);

    const before = sent.length;
    const initialRows = await prisma.notification.count({ where: { bookingId: booking.id } });
    const outcome = await notifyBookingEvent("booking.created", booking.id);
    assert.equal(outcome.sent, 0);
    assert.ok(outcome.duplicates >= 2);
    assert.equal(sent.length, before);
    assert.equal(
      await prisma.notification.count({ where: { bookingId: booking.id } }),
      initialRows,
    );
  });

  it("sends a confirmation email when the reservation is confirmed", async () => {
    const guestEmail = `guest-confirmed${SUFFIX}`;
    const booking = await makeBooking(guestEmail);
    await waitFor("initial emails", () => sent.length >= 2);
    sent = [];

    const actor: StaffActor = withStaffTenant(
      { kind: "staff", userId: staffId, email: ADMIN_EMAIL },
      organizationId,
    );
    await transitionBooking({ bookingId: booking.id, to: "CONFIRMED" }, actor);
    await waitFor("confirmation email", () =>
      sent.some((message) => message.to.includes(guestEmail) && /confirmed/i.test(message.subject)),
    );

    const confirmation = sent.find((message) => message.to.includes(guestEmail));
    assert.ok(confirmation);
    assert.match(confirmation!.html, /confirmed/i);
  });

  it("sends guest and admin cancellation emails when the guest cancels", async () => {
    const guestEmail = `guest-cancelled${SUFFIX}`;
    const booking = await makeBooking(guestEmail);
    await waitFor("initial emails", () => sent.length >= 2);
    sent = [];

    await cancelBooking(
      { bookingId: booking.id },
      { kind: "guest", guestId: booking.guestId },
    );
    await waitFor("cancellation emails", () => sent.length >= 2);

    const guest = sent.find((message) => message.to.includes(guestEmail));
    const admin = sent.find((message) => message.to.includes(ADMIN_EMAIL));
    assert.ok(guest);
    assert.ok(admin);
    assert.match(guest!.subject, /cancelled/i);
    assert.match(admin!.subject, /Guest cancelled/i);
  });

  it("sends payment receipts and dedupes a repeated payment event", async () => {
    const guestEmail = `guest-payment${SUFFIX}`;
    const booking = await makeBooking(guestEmail);
    await waitFor("initial emails", () => sent.length >= 2);
    sent = [];

    const payment = await recordDeskPayment(booking.id, { userId: staffId });
    await waitFor("guest and admin payment emails", () => {
      const paymentEmails = sent.filter((message) => /payment received/i.test(message.subject));
      return paymentEmails.length >= 2;
    });

    const guestPayment = sent.find(
      (message) => message.to.includes(guestEmail) && /payment received/i.test(message.subject),
    );
    const adminPayment = sent.find(
      (message) => message.to.includes(ADMIN_EMAIL) && /payment received/i.test(message.subject),
    );
    assert.ok(guestPayment);
    assert.ok(adminPayment);

    const before = sent.length;
    const repeat = await notifyBookingEvent("payment.received", booking.id, {
      paymentId: payment.id,
    });
    assert.equal(repeat.sent, 0);
    assert.ok(repeat.duplicates >= 2);
    assert.equal(sent.length, before);
  });

  it("records failures without breaking the booking", async () => {
    installTransport({ fail: true });
    const guestEmail = `guest-failure${SUFFIX}`;
    const booking = await makeBooking(guestEmail);

    await waitFor("failed notification rows", async () => {
      const rows = await prisma.notification.findMany({ where: { bookingId: booking.id } });
      return rows.length >= 2 && rows.every((row) => row.status === NotificationStatus.FAILED);
    });

    const persisted = await prisma.booking.findUnique({ where: { id: booking.id } });
    assert.ok(persisted, "the booking still exists");

    const rows = await prisma.notification.findMany({ where: { bookingId: booking.id } });
    assert.ok(rows.every((row) => Boolean(row.error)));
  });

  it("sends a branded test email through the reusable service", async () => {
    const result = await sendTestNotification({ to: ADMIN_EMAIL, hotelId });
    assert.equal(result.ok, true);
    assert.equal(result.transport, "test");
    const message = sent.find((entry) => entry.to.includes(ADMIN_EMAIL));
    assert.ok(message);
    assert.match(message!.subject, /delivery test/i);
    assert.match(message!.html, /Email delivery is working/);
  });
});
