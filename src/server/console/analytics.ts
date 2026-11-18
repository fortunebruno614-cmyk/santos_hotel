import { prisma } from "@/lib/prisma";
import { BookingStatus, PaymentStatus, RoomStatus } from "@/generated/prisma/enums";
import { hotelToday, requireHotelContext } from "@/server/pricing/context";

/**
 * Executive analytics for the tenant dashboard. Revenue is recognised against
 * booking stays, expenses against the expense ledger; both are scoped to the
 * active hotel and resolved server-side. The URL only selects a range.
 */

export type AnalyticsRange = "30d" | "90d" | "12m";

export const ANALYTICS_RANGES: Array<{ value: AnalyticsRange; label: string }> = [
  { value: "30d", label: "Last 30 days" },
  { value: "90d", label: "Last 90 days" },
  { value: "12m", label: "Last 12 months" },
];

export function parseAnalyticsRange(value: string | undefined): AnalyticsRange {
  return value === "90d" || value === "12m" ? value : "30d";
}

export type KpiValue = {
  value: number;
  previous: number;
  changePct: number;
  spark: number[];
};

export type ChartPoint = {
  label: string;
  revenue: number;
  expenses: number;
  net: number;
  previousRevenue: number;
};

export type ExpenseSlice = {
  category: string;
  amount: number;
  pct: number;
  color: string;
};

export type TransactionRow = {
  id: string;
  reference: string;
  customer: string;
  date: string;
  category: string;
  status: string;
  amount: number;
  currency: string;
  bookingId: string;
};

export type ExecutiveAnalytics = {
  range: AnalyticsRange;
  from: string;
  to: string;
  timezone: string;
  currency: string;
  generatedAt: string;
  kpis: {
    revenue: KpiValue;
    expenses: KpiValue;
    netProfit: KpiValue;
    activeCustomers: KpiValue;
    transactions: KpiValue;
    growth: KpiValue;
  };
  series: ChartPoint[];
  operations: {
    occupancy: number;
    completion: number;
    activeOperations: number;
    performance: number;
    sellableRooms: number;
    soldNights: number;
  };
  financial: {
    currentBalance: number;
    availableCash: number;
    outstanding: number;
    target: number;
    progress: number;
    history: Array<{ label: string; value: number }>;
  };
  expenses: ExpenseSlice[];
  expenseTotal: number;
  transactions: TransactionRow[];
};

const CATEGORY_COLORS: Record<string, string> = {
  SALARIES: "#111827",
  UTILITIES: "#2563eb",
  MAINTENANCE: "#d97706",
  MARKETING: "#15803d",
  SUPPLIES: "#7c3aed",
  TAXES: "#dc2626",
  OTHER: "#64748b",
};

const REVENUE_STATUSES: BookingStatus[] = [
  BookingStatus.PENDING,
  BookingStatus.CONFIRMED,
  BookingStatus.CHECKED_IN,
  BookingStatus.CHECKED_OUT,
  BookingStatus.NO_SHOW,
];

function toNumber(value: { toString(): string } | null | undefined) {
  return value ? Number(value.toString()) : 0;
}

function changePct(current: number, previous: number) {
  if (previous === 0) return current === 0 ? 0 : 100;
  return ((current - previous) / previous) * 100;
}

function dayKey(date: Date) {
  return date.toISOString().slice(0, 10);
}

function monthKey(date: Date) {
  return date.toISOString().slice(0, 7);
}

export async function getExecutiveAnalytics(
  hotelId: string,
  range: AnalyticsRange,
  now: Date = new Date(),
): Promise<ExecutiveAnalytics> {
  const hotel = await requireHotelContext(hotelId);
  const today = hotelToday(now, hotel.timezone);
  const nowDate = new Date(now);

  const days = range === "30d" ? 30 : range === "90d" ? 90 : 365;
  const from = new Date(nowDate.getTime() - days * 86_400_000);
  const previousTo = new Date(from.getTime() - 1);
  const previousFrom = new Date(previousTo.getTime() - days * 86_400_000);

  const bookingWindow = (start: Date, end: Date) => ({
    hotelId,
    checkIn: { gte: start, lte: end },
  });

  const [
    currentBookings,
    previousBookingTotals,
    currentExpenses,
    previousExpenseTotals,
    sellableRooms,
  ] = await Promise.all([
    prisma.booking.findMany({
      where: bookingWindow(from, nowDate),
      orderBy: [{ checkIn: "desc" }, { createdAt: "desc" }],
      select: {
        id: true,
        bookingReference: true,
        checkIn: true,
        checkOut: true,
        createdAt: true,
        total: true,
        currency: true,
        bookingStatus: true,
        paymentStatus: true,
        guest: { select: { id: true, firstName: true, lastName: true } },
        rooms: {
          select: {
            room: { select: { roomNumber: true, roomType: { select: { name: true } } } },
          },
        },
      },
    }),
    prisma.booking.aggregate({
      where: {
        ...bookingWindow(previousFrom, previousTo),
        bookingStatus: { in: REVENUE_STATUSES },
      },
      _sum: { total: true },
      _count: { _all: true },
    }),
    prisma.expense.findMany({
      where: { hotelId, incurredAt: { gte: from, lte: nowDate } },
      select: { category: true, amount: true, incurredAt: true },
    }),
    prisma.expense.aggregate({
      where: { hotelId, incurredAt: { gte: previousFrom, lte: previousTo } },
      _sum: { amount: true },
    }),
    prisma.room.count({
      where: {
        roomType: { hotelId },
        status: { notIn: [RoomStatus.MAINTENANCE, RoomStatus.OUT_OF_SERVICE] },
      },
    }),
  ]);

  const previousBookings = await prisma.booking.findMany({
    where: {
      ...bookingWindow(previousFrom, previousTo),
      bookingStatus: { in: REVENUE_STATUSES },
    },
    select: { guestId: true },
    distinct: ["guestId"],
  });

  const [soldNights, currentInHouse, todayArrivals, allTime, outstanding, totalExpenseRows] =
    await Promise.all([
      prisma.roomNight.count({
        where: { hotelId, night: { gte: from, lte: nowDate } },
      }),
      prisma.booking.count({
        where: { hotelId, bookingStatus: BookingStatus.CHECKED_IN },
      }),
      prisma.booking.count({
        where: {
          hotelId,
          checkIn: today,
          bookingStatus: { in: [BookingStatus.PENDING, BookingStatus.CONFIRMED] },
        },
      }),
      prisma.booking.aggregate({
        where: { hotelId, bookingStatus: { in: REVENUE_STATUSES } },
        _sum: { total: true },
      }),
      prisma.booking.aggregate({
        where: {
          hotelId,
          bookingStatus: {
            in: [BookingStatus.PENDING, BookingStatus.CONFIRMED, BookingStatus.CHECKED_IN],
          },
          paymentStatus: { in: [PaymentStatus.PENDING, PaymentStatus.FAILED] },
        },
        _sum: { total: true },
      }),
      prisma.expense.aggregate({
        where: { hotelId, incurredAt: { lte: nowDate } },
        _sum: { amount: true },
      }),
    ]);

  // --- Series buckets ------------------------------------------------------
  const monthly = range === "12m";
  const bucketCount = monthly ? 12 : range === "90d" ? 90 : 30;
  const buckets: Array<{ key: string; label: string; revenue: number; expenses: number; bookings: number }> = [];
  if (monthly) {
    for (let offset = bucketCount - 1; offset >= 0; offset -= 1) {
      const date = new Date(Date.UTC(nowDate.getUTCFullYear(), nowDate.getUTCMonth() - offset, 1));
      buckets.push({
        key: monthKey(date),
        label: date.toLocaleString("en", { month: "short", timeZone: "UTC" }),
        revenue: 0,
        expenses: 0,
        bookings: 0,
      });
    }
  } else {
    for (let offset = bucketCount - 1; offset >= 0; offset -= 1) {
      const date = new Date(nowDate.getTime() - offset * 86_400_000);
      buckets.push({
        key: dayKey(date),
        label: date.toLocaleString("en", { day: "2-digit", month: "short", timeZone: "UTC" }),
        revenue: 0,
        expenses: 0,
        bookings: 0,
      });
    }
  }
  const bucketByKey = new Map(buckets.map((bucket) => [bucket.key, bucket]));

  let revenueTotal = 0;
  const guests = new Set<string>();
  for (const booking of currentBookings) {
    const bucket = bucketByKey.get(monthly ? monthKey(booking.checkIn) : dayKey(booking.checkIn));
    if (bucket) bucket.bookings += 1;
    if (!REVENUE_STATUSES.includes(booking.bookingStatus)) continue;
    const amount = toNumber(booking.total);
    revenueTotal += amount;
    guests.add(booking.guest.id);
    if (bucket) bucket.revenue += amount;
  }

  let expenseTotal = 0;
  const byCategory = new Map<string, number>();
  for (const expense of currentExpenses) {
    const amount = toNumber(expense.amount);
    expenseTotal += amount;
    byCategory.set(expense.category, (byCategory.get(expense.category) ?? 0) + amount);

    if (monthly) {
      const bucket = bucketByKey.get(monthKey(expense.incurredAt));
      if (bucket) bucket.expenses += amount;
    } else {
      // Expenses are recorded weekly/monthly in lumps; amortise each entry
      // across the following week so the daily chart shows a trend rather
      // than an artificial one-day cliff.
      const daily = amount / 7;
      for (let offset = 0; offset < 7; offset += 1) {
        const day = new Date(expense.incurredAt.getTime() + offset * 86_400_000);
        const bucket = bucketByKey.get(dayKey(day));
        if (bucket) bucket.expenses += daily;
      }
    }
  }

  const previousRevenue = toNumber(previousBookingTotals._sum.total);
  const previousExpenseTotal = toNumber(previousExpenseTotals._sum.amount);
  const previousNet = previousRevenue - previousExpenseTotal;
  const previousTransactions = previousBookingTotals._count._all;
  const previousActiveCustomers = previousBookings.length;

  const series: ChartPoint[] = buckets.map((bucket) => ({
    label: bucket.label,
    revenue: Math.round(bucket.revenue),
    expenses: Math.round(bucket.expenses),
    net: Math.round(bucket.revenue - bucket.expenses),
    previousRevenue:
      previousRevenue > 0 && buckets.length > 0
        ? Math.round(previousRevenue / buckets.length)
        : 0,
  }));

  const netProfit = revenueTotal - expenseTotal;
  const transactionCount = currentBookings.length;
  const activeCustomers = guests.size;

  const statusCounts = new Map<string, number>();
  for (const booking of currentBookings) {
    statusCounts.set(booking.bookingStatus, (statusCounts.get(booking.bookingStatus) ?? 0) + 1);
  }
  const completed = statusCounts.get(BookingStatus.CHECKED_OUT) ?? 0;
  const cancelled = statusCounts.get(BookingStatus.CANCELLED) ?? 0;
  const noShow = statusCounts.get(BookingStatus.NO_SHOW) ?? 0;
  const completion = completed + cancelled + noShow > 0 ? (completed / (completed + cancelled + noShow)) * 100 : 0;
  const paidBookings = currentBookings.filter(
    (booking) =>
      booking.paymentStatus === PaymentStatus.PAID ||
      booking.paymentStatus === PaymentStatus.PARTIALLY_REFUNDED,
  ).length;
  const performance = transactionCount > 0 ? (paidBookings / transactionCount) * 100 : 0;
  const periodNights = Math.max(1, Math.ceil((nowDate.getTime() - from.getTime()) / 86_400_000));
  const occupancy = sellableRooms > 0 ? (soldNights / (sellableRooms * periodNights)) * 100 : 0;

  const allTimeRevenue = toNumber(allTime._sum.total);
  const allTimeExpenses = toNumber(totalExpenseRows._sum.amount);
  const currentBalance = allTimeRevenue - allTimeExpenses;
  const availableCash = currentBalance;
  const outstandingTotal = toNumber(outstanding._sum.total);
  const target = Math.max(previousRevenue > 0 ? previousRevenue * 1.1 : revenueTotal * 1.1, 1_000_000);

  const history: Array<{ label: string; value: number }> = [];
  for (let offset = 11; offset >= 0; offset -= 1) {
    const monthStart = new Date(Date.UTC(nowDate.getUTCFullYear(), nowDate.getUTCMonth() - offset, 1));
    const monthEnd = new Date(Date.UTC(nowDate.getUTCFullYear(), nowDate.getUTCMonth() - offset + 1, 0));
    const [monthBookings, monthExpenses] = await Promise.all([
      prisma.booking.aggregate({
        where: {
          hotelId,
          bookingStatus: { in: REVENUE_STATUSES },
          checkIn: { gte: monthStart, lte: monthEnd },
        },
        _sum: { total: true },
      }),
      prisma.expense.aggregate({
        where: { hotelId, incurredAt: { gte: monthStart, lte: monthEnd } },
        _sum: { amount: true },
      }),
    ]);
    history.push({
      label: monthStart.toLocaleString("en", { month: "short", timeZone: "UTC" }),
      value:
        toNumber(monthBookings._sum.total) - toNumber(monthExpenses._sum.amount),
    });
  }

  const expenseSlices: ExpenseSlice[] = [...byCategory.entries()]
    .map(([category, amount]) => ({
      category,
      amount,
      pct: expenseTotal > 0 ? (amount / expenseTotal) * 100 : 0,
      color: CATEGORY_COLORS[category] ?? CATEGORY_COLORS.OTHER,
    }))
    .sort((a, b) => b.amount - a.amount);

  const transactions: TransactionRow[] = currentBookings.slice(0, 160).map((booking) => {
    const typeName = booking.rooms[0]?.room.roomType.name ?? "Accommodation";
    return {
      id: booking.id,
      reference: booking.bookingReference,
      customer: `${booking.guest.firstName} ${booking.guest.lastName}`,
      date: booking.createdAt.toISOString(),
      category: typeName,
      status: booking.bookingStatus,
      amount: toNumber(booking.total),
      currency: booking.currency ?? hotel.currency,
      bookingId: booking.id,
    };
  });

  const spark = (selector: (point: ChartPoint) => number) => series.map((point) => selector(point));

  return {
    range,
    from: from.toISOString().slice(0, 10),
    to: nowDate.toISOString().slice(0, 10),
    timezone: hotel.timezone,
    currency: hotel.currency,
    generatedAt: nowDate.toISOString(),
    kpis: {
      revenue: {
        value: revenueTotal,
        previous: previousRevenue,
        changePct: changePct(revenueTotal, previousRevenue),
        spark: spark((point) => point.revenue),
      },
      expenses: {
        value: expenseTotal,
        previous: previousExpenseTotal,
        changePct: changePct(expenseTotal, previousExpenseTotal),
        spark: spark((point) => point.expenses),
      },
      netProfit: {
        value: netProfit,
        previous: previousNet,
        changePct: changePct(netProfit, previousNet),
        spark: spark((point) => point.net),
      },
      activeCustomers: {
        value: activeCustomers,
        previous: previousActiveCustomers,
        changePct: changePct(activeCustomers, previousActiveCustomers),
        spark: [],
      },
      transactions: {
        value: transactionCount,
        previous: previousTransactions,
        changePct: changePct(transactionCount, previousTransactions),
        spark: [],
      },
      growth: {
        value: changePct(revenueTotal, previousRevenue),
        previous: 0,
        changePct: changePct(revenueTotal, previousRevenue),
        spark: spark((point) => point.net),
      },
    },
    series,
    operations: {
      occupancy: Math.min(100, Math.max(0, occupancy)),
      completion: Math.min(100, Math.max(0, completion)),
      activeOperations: currentInHouse + todayArrivals,
      performance: Math.min(100, Math.max(0, performance)),
      sellableRooms,
      soldNights,
    },
    financial: {
      currentBalance,
      availableCash,
      outstanding: outstandingTotal,
      target,
      progress: target > 0 ? Math.min(100, (revenueTotal / target) * 100) : 0,
      history,
    },
    expenses: expenseSlices,
    expenseTotal,
    transactions,
  };
}
