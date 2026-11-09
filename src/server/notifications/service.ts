import { prisma } from "@/lib/prisma";
import {
  MemberStatus,
  NotificationChannel,
  NotificationStatus,
  Prisma,
  UserRole,
} from "@/generated/prisma/client";
import {
  configuredAdminEmails,
  emailEnabled,
  resendFromEmail,
  resendReplyTo,
} from "@/config/email";
import { EmailSchema } from "@/server/auth/validation";
import {
  EmailNotConfiguredError,
  emailProviderName,
  getEmailTransport,
  hasEmailTransport,
} from "@/server/notifications/provider";
import {
  renderAdminEmail,
  renderGuestEmail,
  renderTestEmail,
  type EmailBooking,
  type EmailHotel,
  type EmailPayment,
} from "@/server/notifications/templates";

/**
 * Resend notification workflow.
 *
 * Every delivery is written to `notifications` before it is sent, with a
 * deterministic `dedupeKey`; a replay/webhook retry therefore cannot send the
 * same message twice. Delivery failures are recorded (FAILED + error) and are
 * never thrown into the booking/payment transaction.
 */

const bookingInclude = {
  guest: true,
  hotel: true,
  rooms: { include: { room: { include: { roomType: true } } } },
} as const;

type BookingForEmail = Prisma.BookingGetPayload<{ include: typeof bookingInclude }>;

type DeliveryResult = "sent" | "failed" | "duplicate" | "skipped";

export type BookingNotificationEvent =
  | "booking.created"
  | "booking.confirmed"
  | "booking.cancelled"
  | "payment.received";

export type NotificationOutcome = {
  ok: boolean;
  sent: number;
  failed: number;
  duplicates: number;
  skipped: number;
};

function emptyOutcome(): NotificationOutcome {
  return { ok: true, sent: 0, failed: 0, duplicates: 0, skipped: 0 };
}

function isUniqueViolation(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { code?: unknown }).code === "P2002"
  );
}

function truncateError(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error ?? "unknown email failure");
  return message.slice(0, 500);
}

function validEmail(value: string | null | undefined): string | null {
  if (!value) return null;
  const normalized = value.trim().toLowerCase();
  return EmailSchema.safeParse(normalized).success ? normalized : null;
}

function toEmailBooking(booking: BookingForEmail): EmailBooking {
  return {
    id: booking.id,
    bookingReference: booking.bookingReference,
    guestName: `${booking.guest.firstName} ${booking.guest.lastName}`.trim(),
    guestEmail: validEmail(booking.guest.email),
    checkIn: booking.checkIn,
    checkOut: booking.checkOut,
    adults: booking.adults,
    children: booking.children,
    bookingStatus: booking.bookingStatus,
    paymentStatus: booking.paymentStatus,
    currency: booking.currency ?? booking.hotel?.currency ?? "NGN",
    total: booking.total.toString(),
    rooms: booking.rooms.map((line) => ({
      roomTypeName: line.room.roomType.name,
      roomNumber: line.room.roomNumber,
    })),
    createdAt: booking.createdAt,
  };
}

function toEmailHotel(hotel: NonNullable<BookingForEmail["hotel"]>): EmailHotel {
  return {
    id: hotel.id,
    name: hotel.name,
    email: hotel.email,
    phone: hotel.phone,
    addressLine1: hotel.addressLine1,
    addressLine2: hotel.addressLine2,
    city: hotel.city,
    postcode: hotel.postcode,
    country: hotel.country,
    checkInTime: hotel.checkInTime,
    checkOutTime: hotel.checkOutTime,
    timezone: hotel.timezone,
  };
}

/**
 * Precedence: explicit env recipient(s) → hotel profile e-mail → active
 * organization admins. A configured override intentionally replaces the
 * fallbacks so a production inbox does not also receive a duplicate at the
 * seeded/legacy address.
 */
async function resolveAdminRecipients(hotel: {
  organizationId: string;
  email: string | null;
}): Promise<string[]> {
  const configured = configuredAdminEmails()
    .map(validEmail)
    .filter((email): email is string => email !== null);
  if (configured.length > 0) return [...new Set(configured)];

  const hotelEmail = validEmail(hotel.email);
  if (hotelEmail) return [hotelEmail];

  try {
    const members = await prisma.organizationMember.findMany({
      where: {
        organizationId: hotel.organizationId,
        status: MemberStatus.ACTIVE,
        user: { is: { role: UserRole.ADMIN, isActive: true } },
      },
      orderBy: { createdAt: "asc" },
      take: 5,
      select: { user: { select: { email: true } } },
    });
    return [
      ...new Set(
        members
          .map((member) => validEmail(member.user.email))
          .filter((email): email is string => email !== null),
      ),
    ];
  } catch (error) {
    console.error("could not resolve organization admins for notification", error);
    return [];
  }
}

function tagValue(value: string): string {
  return value.replace(/[^a-zA-Z0-9_-]/g, "_").slice(0, 64);
}

async function deliverEmail(input: {
  dedupeKey: string | null;
  recipient: string;
  subject: string;
  html: string;
  text: string;
  hotelId: string | null;
  organizationId: string | null;
  bookingId: string | null;
  kind: string;
  bookingReference?: string | null;
  replyTo?: string | null;
}): Promise<DeliveryResult> {
  let notificationId: string;
  try {
    const row = await prisma.notification.create({
      data: {
        hotelId: input.hotelId,
        organizationId: input.organizationId,
        bookingId: input.bookingId,
        channel: NotificationChannel.EMAIL,
        recipient: input.recipient,
        subject: input.subject,
        body: input.text,
        status: NotificationStatus.PENDING,
        dedupeKey: input.dedupeKey,
      },
      select: { id: true },
    });
    notificationId = row.id;
  } catch (error) {
    if (isUniqueViolation(error)) return "duplicate";
    console.error("could not create notification row", error);
    return "failed";
  }

  if (!hasEmailTransport()) {
    await markFailed(notificationId, "RESEND_API_KEY is not configured");
    return "failed";
  }

  try {
    const result = await getEmailTransport().send({
      from: resendFromEmail(),
      to: [input.recipient],
      subject: input.subject,
      html: input.html,
      text: input.text,
      replyTo: input.replyTo ?? resendReplyTo(),
      tags: [
        { name: "type", value: tagValue(input.kind) },
        ...(input.bookingReference
          ? [{ name: "booking", value: tagValue(input.bookingReference) }]
          : []),
      ],
    });

    await prisma.notification.update({
      where: { id: notificationId },
      data: {
        status: NotificationStatus.SENT,
        sentAt: new Date(),
        providerId: result.id,
        error: null,
      },
    });
    return "sent";
  } catch (error) {
    await markFailed(notificationId, truncateError(error));
    console.error("email delivery failed", {
      recipient: input.recipient,
      subject: input.subject,
      reason: truncateError(error),
    });
    return "failed";
  }
}

async function markFailed(notificationId: string, reason: string): Promise<void> {
  try {
    await prisma.notification.update({
      where: { id: notificationId },
      data: { status: NotificationStatus.FAILED, error: reason.slice(0, 500) },
    });
  } catch (error) {
    console.error("could not update failed notification", error);
  }
}

function addResult(outcome: NotificationOutcome, result: DeliveryResult) {
  if (result === "sent") outcome.sent += 1;
  else if (result === "duplicate") outcome.duplicates += 1;
  else if (result === "failed") outcome.failed += 1;
  else outcome.skipped += 1;
}

export async function notifyBookingEvent(
  event: BookingNotificationEvent,
  bookingId: string,
  options: { actorKind?: "guest" | "staff"; paymentId?: string | null } = {},
): Promise<NotificationOutcome> {
  const outcome = emptyOutcome();
  if (!emailEnabled()) {
    outcome.skipped += 1;
    return outcome;
  }

  try {
    const booking = await prisma.booking.findUnique({
      where: { id: bookingId },
      include: bookingInclude,
    });
    if (!booking || !booking.hotel) {
      outcome.skipped += 1;
      return outcome;
    }

    const emailBooking = toEmailBooking(booking);
    const hotel = toEmailHotel(booking.hotel);
    const adminRecipients = await resolveAdminRecipients(booking.hotel);
    const payment = options.paymentId
      ? await prisma.payment.findUnique({ where: { id: options.paymentId } })
      : null;
    const emailPayment: EmailPayment | null = payment
      ? {
          id: payment.id,
          amount: payment.amount.toString(),
          currency: payment.currency,
          provider: payment.provider,
          paidAt: payment.paidAt,
        }
      : null;

    const tasks: Array<Promise<DeliveryResult>> = [];

    const queueGuest = (
      kind: "received" | "confirmed" | "cancelled" | "payment",
      dedupeKey: string,
    ) => {
      if (!emailBooking.guestEmail) {
        outcome.skipped += 1;
        return;
      }
      const rendered = renderGuestEmail(kind, emailBooking, hotel, emailPayment);
      tasks.push(
        deliverEmail({
          dedupeKey,
          recipient: emailBooking.guestEmail,
          subject: rendered.subject,
          html: rendered.html,
          text: rendered.text,
          hotelId: booking.hotelId ?? null,
          organizationId: booking.organizationId,
          bookingId: booking.id,
          kind: `guest.${kind}`,
          bookingReference: booking.bookingReference,
          replyTo: hotel.email,
        }),
      );
    };

    const queueAdmin = (
      kind: "new" | "cancelled" | "payment",
      dedupeKey: string,
      recipient: string,
    ) => {
      const rendered = renderAdminEmail(kind, emailBooking, hotel, emailPayment);
      tasks.push(
        deliverEmail({
          dedupeKey,
          recipient,
          subject: rendered.subject,
          html: rendered.html,
          text: rendered.text,
          hotelId: booking.hotelId ?? null,
          organizationId: booking.organizationId,
          bookingId: booking.id,
          kind: `admin.${kind}`,
          bookingReference: booking.bookingReference,
          replyTo: hotel.email,
        }),
      );
    };

    if (event === "booking.created") {
      const guestKind = emailBooking.bookingStatus === "CONFIRMED" ? "confirmed" : "received";
      queueGuest(guestKind, `booking:${booking.id}:guest:${guestKind}`);

      if (adminRecipients.length === 0) {
        outcome.skipped += 1;
      } else {
        for (const recipient of adminRecipients) {
          queueAdmin("new", `booking:${booking.id}:admin:new:${recipient}`, recipient);
        }
      }
    } else if (event === "booking.confirmed") {
      queueGuest("confirmed", `booking:${booking.id}:guest:confirmed`);
    } else if (event === "booking.cancelled") {
      queueGuest("cancelled", `booking:${booking.id}:guest:cancelled`);

      if (options.actorKind !== "staff") {
        if (adminRecipients.length === 0) {
          outcome.skipped += 1;
        } else {
          for (const recipient of adminRecipients) {
            queueAdmin(
              "cancelled",
              `booking:${booking.id}:admin:cancelled:${recipient}`,
              recipient,
            );
          }
        }
      }
    } else if (event === "payment.received") {
      const paymentKey = payment?.id ?? `booking-${booking.id}`;
      queueGuest("payment", `payment:${paymentKey}:guest:paid`);

      if (adminRecipients.length === 0) {
        outcome.skipped += 1;
      } else {
        for (const recipient of adminRecipients) {
          queueAdmin("payment", `payment:${paymentKey}:admin:paid:${recipient}`, recipient);
        }
      }
    }

    const settled = await Promise.allSettled(tasks);
    for (const entry of settled) {
      if (entry.status === "rejected") outcome.failed += 1;
      else addResult(outcome, entry.value);
    }
    return outcome;
  } catch (error) {
    console.error("notification workflow failed", {
      event,
      bookingId,
      reason: truncateError(error),
    });
    return { ...outcome, ok: false };
  }
}

export async function sendTestNotification(input: {
  to: string;
  hotelId: string;
}): Promise<{ ok: boolean; transport: string; result: DeliveryResult }> {
  if (!emailEnabled()) throw new EmailNotConfiguredError();
  if (!hasEmailTransport()) throw new EmailNotConfiguredError();

  const hotel = await prisma.hotel.findUnique({ where: { id: input.hotelId } });
  if (!hotel) throw new Error("hotel_not_found");

  const emailHotel: EmailHotel = {
    id: hotel.id,
    name: hotel.name,
    email: hotel.email,
    phone: hotel.phone,
    addressLine1: hotel.addressLine1,
    addressLine2: hotel.addressLine2,
    city: hotel.city,
    postcode: hotel.postcode,
    country: hotel.country,
    checkInTime: hotel.checkInTime,
    checkOutTime: hotel.checkOutTime,
    timezone: hotel.timezone,
  };
  const rendered = renderTestEmail(emailHotel, input.to);
  const result = await deliverEmail({
    dedupeKey: null,
    recipient: input.to,
    subject: rendered.subject,
    html: rendered.html,
    text: rendered.text,
    hotelId: hotel.id,
    organizationId: hotel.organizationId,
    bookingId: null,
    kind: "test",
    replyTo: hotel.email,
  });

  return { ok: result === "sent", transport: emailProviderName(), result };
}

export async function listRecentNotifications(hotelId: string, limit = 50) {
  return prisma.notification.findMany({
    where: { hotelId },
    orderBy: { createdAt: "desc" },
    take: Math.min(Math.max(limit, 1), 100),
    select: {
      id: true,
      recipient: true,
      subject: true,
      status: true,
      error: true,
      providerId: true,
      sentAt: true,
      createdAt: true,
      channel: true,
      booking: {
        select: {
          bookingReference: true,
          guest: { select: { firstName: true, lastName: true } },
        },
      },
    },
  });
}

export { EmailNotConfiguredError };
