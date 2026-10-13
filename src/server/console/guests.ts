import { prisma } from "@/lib/prisma";
import { writeAuditLog } from "@/server/audit/write";
import { ConsoleError } from "@/server/console/errors";
import type { GuestUpdateSchema } from "@/server/console/validation";
import { loadHotelContext } from "@/server/pricing/context";
import type { z } from "zod";

/**
 * P7 guest records — the front desk's view of a customer: contact and ID
 * details plus every reservation and payment, without direct database access.
 *
 * Staff may correct contact/ID details (audit: `guest.update`); the guest's
 * booking history and money are read-only here (they belong to the booking and
 * payment services).
 */

export type GuestUpdate = z.infer<typeof GuestUpdateSchema>;

export type GuestListRow = {
  id: string;
  firstName: string;
  lastName: string;
  email: string | null;
  phone: string | null;
  isActive: boolean;
  bookingCount: number;
  lastStay: string | null;
};

function escapeLike(value: string) {
  return value.replace(/[\\%_]/g, (match) => `\\${match}`);
}

export async function searchGuests(query: {
  q?: string;
  page: number;
  pageSize: number;
}): Promise<{ rows: GuestListRow[]; total: number; page: number; pageSize: number }> {
  const q = query.q?.trim();
  const where = q
    ? {
        OR: [
          { firstName: { contains: escapeLike(q), mode: "insensitive" as const } },
          { lastName: { contains: escapeLike(q), mode: "insensitive" as const } },
          { email: { contains: escapeLike(q), mode: "insensitive" as const } },
          { phone: { contains: escapeLike(q) } },
        ],
      }
    : {};

  const [total, rows] = await Promise.all([
    prisma.guest.count({ where }),
    prisma.guest.findMany({
      where,
      orderBy: [{ updatedAt: "desc" }],
      skip: (query.page - 1) * query.pageSize,
      take: query.pageSize,
      include: {
        bookings: {
          select: { checkIn: true, bookingStatus: true },
          orderBy: { checkIn: "desc" },
          take: 50,
        },
      },
    }),
  ]);

  return {
    total,
    page: query.page,
    pageSize: query.pageSize,
    rows: rows.map((guest) => {
      const stayed = guest.bookings.filter((booking) => booking.bookingStatus !== "CANCELLED");
      return {
        id: guest.id,
        firstName: guest.firstName,
        lastName: guest.lastName,
        email: guest.email,
        phone: guest.phone,
        isActive: guest.isActive,
        bookingCount: stayed.length,
        lastStay: stayed[0] ? stayed[0].checkIn.toISOString().slice(0, 10) : null,
      };
    }),
  };
}

export type GuestDetail = {
  id: string;
  firstName: string;
  lastName: string;
  email: string | null;
  phone: string | null;
  idType: string | null;
  idNumber: string | null;
  isActive: boolean;
  createdAt: string;
  bookings: Array<{
    id: string;
    bookingReference: string;
    checkIn: string;
    checkOut: string;
    bookingStatus: string;
    paymentStatus: string;
    total: string;
    currency: string;
    roomNumbers: string[];
  }>;
  payments: Array<{
    id: string;
    bookingReference: string;
    provider: string;
    amount: string;
    refundedAmount: string;
    status: string;
    paidAt: string | null;
  }>;
};

export async function getGuestDetail(id: string): Promise<GuestDetail> {
  const guest = await prisma.guest.findUnique({
    where: { id },
    include: {
      bookings: {
        orderBy: { checkIn: "desc" },
        include: {
          rooms: { select: { room: { select: { roomNumber: true } } } },
          payments: {
            select: {
              id: true,
              provider: true,
              amount: true,
              refundedAmount: true,
              status: true,
              paidAt: true,
            },
          },
        },
      },
    },
  });
  if (!guest) throw new ConsoleError("not_found", "guest not found");
  const { currency } = await loadHotelContext();

  return {
    id: guest.id,
    firstName: guest.firstName,
    lastName: guest.lastName,
    email: guest.email,
    phone: guest.phone,
    idType: guest.idType,
    idNumber: guest.idNumber,
    isActive: guest.isActive,
    createdAt: guest.createdAt.toISOString(),
    bookings: guest.bookings.map((booking) => ({
      id: booking.id,
      bookingReference: booking.bookingReference,
      checkIn: booking.checkIn.toISOString().slice(0, 10),
      checkOut: booking.checkOut.toISOString().slice(0, 10),
      bookingStatus: booking.bookingStatus,
      paymentStatus: booking.paymentStatus,
      total: booking.total.toString(),
      currency,
      roomNumbers: booking.rooms.map((line) => line.room.roomNumber),
    })),
    payments: guest.bookings.flatMap((booking) =>
      booking.payments.map((payment) => ({
        id: payment.id,
        bookingReference: booking.bookingReference,
        provider: payment.provider,
        amount: payment.amount.toString(),
        refundedAmount: payment.refundedAmount.toString(),
        status: payment.status,
        paidAt: payment.paidAt ? payment.paidAt.toISOString() : null,
      })),
    ),
  };
}

export async function updateGuest(id: string, input: GuestUpdate, actor: { userId: string }) {
  const existing = await prisma.guest.findUnique({ where: { id } });
  if (!existing) throw new ConsoleError("not_found", "guest not found");

  if (input.email && input.email !== existing.email) {
    const clash = await prisma.guest.findUnique({ where: { email: input.email } });
    if (clash && clash.id !== id) {
      throw new ConsoleError("conflict", `another guest already uses ${input.email}`);
    }
  }

  const data: Record<string, unknown> = {};
  const oldValues: Record<string, unknown> = {};
  const newValues: Record<string, unknown> = {};
  const fields = ["firstName", "lastName", "email", "phone", "idType", "idNumber", "isActive"] as const;

  for (const field of fields) {
    if (!(field in input)) continue;
    const next = (input as Record<string, unknown>)[field];
    if (next === undefined) continue;
    const current = (existing as unknown as Record<string, unknown>)[field];
    if (current === next) continue;
    data[field] = next;
    oldValues[field] = current;
    newValues[field] = next;
  }

  if (Object.keys(data).length === 0) return existing;

  const updated = await prisma.guest.update({ where: { id }, data });
  await writeAuditLog({
    userId: actor.userId,
    action: "guest.update",
    entityType: "guest",
    entityId: id,
    oldValues,
    newValues,
  });
  return updated;
}
