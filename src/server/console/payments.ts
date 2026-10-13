import { prisma } from "@/lib/prisma";
import { Prisma } from "@/generated/prisma/client";
import type { PaymentSearchInput } from "@/server/console/validation";

/**
 * P7 payment records — the ledger view behind `/admin/payments` and
 * `GET /api/staff/payments`. Filters compose: status plus booking-reference
 * search; rows are newest-first with booking correlation for the desk.
 */

export type PaymentListRow = {
  id: string;
  bookingId: string;
  bookingReference: string;
  bookingStatus: string;
  paymentStatus: string;
  guestName: string;
  provider: string;
  providerReference: string | null;
  amount: string;
  refundedAmount: string;
  currency: string;
  status: string;
  paidAt: string | null;
  refundedAt: string | null;
  createdAt: string;
};

export type PaymentSearchResult = {
  rows: PaymentListRow[];
  total: number;
  page: number;
  pageSize: number;
};

export async function searchPayments(query: PaymentSearchInput): Promise<PaymentSearchResult> {
  const where: Prisma.PaymentWhereInput = {
    ...(query.status ? { status: query.status } : {}),
    ...(query.reference
      ? { booking: { bookingReference: { contains: query.reference, mode: "insensitive" } } }
      : {}),
  };

  const [total, payments] = await Promise.all([
    prisma.payment.count({ where }),
    prisma.payment.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (query.page - 1) * query.pageSize,
      take: query.pageSize,
      include: {
        booking: {
          select: {
            id: true,
            bookingReference: true,
            bookingStatus: true,
            paymentStatus: true,
            guest: { select: { firstName: true, lastName: true } },
          },
        },
      },
    }),
  ]);

  return {
    total,
    page: query.page,
    pageSize: query.pageSize,
    rows: payments.map((payment) => ({
      id: payment.id,
      bookingId: payment.bookingId,
      bookingReference: payment.booking.bookingReference,
      bookingStatus: payment.booking.bookingStatus,
      paymentStatus: payment.booking.paymentStatus,
      guestName: `${payment.booking.guest.firstName} ${payment.booking.guest.lastName}`,
      provider: payment.provider,
      providerReference: payment.providerReference,
      amount: payment.amount.toString(),
      refundedAmount: payment.refundedAmount.toString(),
      currency: payment.currency,
      status: payment.status,
      paidAt: payment.paidAt ? payment.paidAt.toISOString() : null,
      refundedAt: payment.refundedAt ? payment.refundedAt.toISOString() : null,
      createdAt: payment.createdAt.toISOString(),
    })),
  };
}
