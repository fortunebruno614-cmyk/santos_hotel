import { prisma } from "@/lib/prisma";
import { BookingStatus, RoomStatus } from "@/generated/prisma/enums";
import { addDays } from "@/server/availability/overlap";
import { hotelToday, loadHotelContext } from "@/server/pricing/context";

/**
 * P7 dashboard — the front desk's morning view, computed on the server from
 * the same tables the rest of the console writes:
 *
 *   arrivals     bookings whose stay starts today and are not yet checked in
 *   departures   bookings whose stay ends today and are still checked in
 *   in-house     every CHECKED_IN reservation right now
 *   occupancy    room_nights sold for tonight ÷ sellable rooms
 *   board        7 nights × every physical room: free / sold (with the
 *                reservation) / blocked (maintenance or out of service)
 *
 * "Today" is the hotel's local date (`hotelToday`), never the server's UTC day.
 */

export const BOARD_NIGHTS = 7;

export type DashboardBookingRow = {
  id: string;
  bookingReference: string;
  guestName: string;
  roomNumbers: string[];
  adults: number;
  children: number;
  total: string;
  bookingStatus: string;
  paymentStatus: string;
  checkIn: string;
  checkOut: string;
  notes: string | null;
};

export type BoardCell = {
  night: string;
  kind: "free" | "sold" | "blocked";
  bookingReference: string | null;
};

export type DashboardData = {
  today: string;
  currency: string;
  checkInTime: string;
  checkOutTime: string;
  arrivals: DashboardBookingRow[];
  departures: DashboardBookingRow[];
  checkedOutToday: number;
  inHouse: DashboardBookingRow[];
  occupancy: { sold: number; sellable: number; percent: string };
  housekeeping: { cleaning: number; maintenance: number; outOfService: number; available: number };
  board: {
    from: string;
    nights: string[];
    rooms: Array<{
      id: string;
      roomNumber: string;
      floor: number | null;
      roomTypeName: string;
      status: RoomStatus;
      cells: BoardCell[];
    }>;
  };
};

function toRow(booking: {
  id: string;
  bookingReference: string;
  checkIn: Date;
  checkOut: Date;
  adults: number;
  children: number;
  total: { toString(): string };
  bookingStatus: string;
  paymentStatus: string;
  notes: string | null;
  guest: { firstName: string; lastName: string };
  rooms: Array<{ room: { roomNumber: string } }>;
}): DashboardBookingRow {
  return {
    id: booking.id,
    bookingReference: booking.bookingReference,
    guestName: `${booking.guest.firstName} ${booking.guest.lastName}`,
    roomNumbers: booking.rooms.map((line) => line.room.roomNumber),
    adults: booking.adults,
    children: booking.children,
    total: booking.total.toString(),
    bookingStatus: booking.bookingStatus,
    paymentStatus: booking.paymentStatus,
    checkIn: booking.checkIn.toISOString().slice(0, 10),
    checkOut: booking.checkOut.toISOString().slice(0, 10),
    notes: booking.notes,
  };
}

const BOARD_INCLUDE = {
  guest: { select: { firstName: true, lastName: true } },
  rooms: { select: { room: { select: { roomNumber: true } } } },
} as const;

export async function getDashboard(now: Date = new Date()): Promise<DashboardData> {
  const hotel = await loadHotelContext();
  const today = hotelToday(now, hotel.timezone);
  const lastNight = addDays(today, BOARD_NIGHTS - 1);
  const tomorrow = addDays(today, 1);

  const [arrivals, departures, inHouse, checkedOutToday, rooms, roomNights, housekeeping] =
    await Promise.all([
      prisma.booking.findMany({
        where: {
          checkIn: today,
          bookingStatus: { in: [BookingStatus.PENDING, BookingStatus.CONFIRMED] },
        },
        orderBy: { createdAt: "asc" },
        include: BOARD_INCLUDE,
      }),
      prisma.booking.findMany({
        where: { checkOut: today, bookingStatus: BookingStatus.CHECKED_IN },
        orderBy: { createdAt: "asc" },
        include: BOARD_INCLUDE,
      }),
      prisma.booking.findMany({
        where: { bookingStatus: BookingStatus.CHECKED_IN },
        orderBy: { checkOut: "asc" },
        include: BOARD_INCLUDE,
      }),
      prisma.booking.count({
        where: {
          checkOut: today,
          bookingStatus: BookingStatus.CHECKED_OUT,
          updatedAt: { gte: today, lt: tomorrow },
        },
      }),
      prisma.room.findMany({
        orderBy: { roomNumber: "asc" },
        include: { roomType: { select: { name: true } } },
      }),
      prisma.roomNight.findMany({
        where: { night: { gte: today, lte: lastNight } },
        select: {
          roomId: true,
          night: true,
          booking: { select: { bookingReference: true } },
        },
      }),
      prisma.room.groupBy({ by: ["status"], _count: { _all: true } }),
    ]);

  const blockedStatuses = new Set<RoomStatus>([RoomStatus.MAINTENANCE, RoomStatus.OUT_OF_SERVICE]);
  const sellable = rooms.filter((room) => !blockedStatuses.has(room.status)).length;
  const soldTonight = roomNights.filter(
    (night) => night.night.getTime() === today.getTime(),
  ).length;
  const percent = sellable > 0 ? Math.round((soldTonight / sellable) * 100) : 0;

  const nights: string[] = [];
  for (let index = 0; index < BOARD_NIGHTS; index += 1) {
    nights.push(addDays(today, index).toISOString().slice(0, 10));
  }

  const byRoomNight = new Map<string, string>();
  for (const night of roomNights) {
    byRoomNight.set(`${night.roomId}:${night.night.toISOString().slice(0, 10)}`, night.booking.bookingReference);
  }

  const counts = new Map(housekeeping.map((row) => [row.status, row._count._all]));

  return {
    today: today.toISOString().slice(0, 10),
    currency: hotel.currency,
    checkInTime: hotel.checkInTime,
    checkOutTime: hotel.checkOutTime,
    arrivals: arrivals.map(toRow),
    departures: departures.map(toRow),
    checkedOutToday,
    inHouse: inHouse.map(toRow),
    occupancy: { sold: soldTonight, sellable, percent: String(percent) },
    housekeeping: {
      cleaning: counts.get(RoomStatus.CLEANING) ?? 0,
      maintenance: counts.get(RoomStatus.MAINTENANCE) ?? 0,
      outOfService: counts.get(RoomStatus.OUT_OF_SERVICE) ?? 0,
      available: counts.get(RoomStatus.AVAILABLE) ?? 0,
    },
    board: {
      from: today.toISOString().slice(0, 10),
      nights,
      rooms: rooms.map((room) => ({
        id: room.id,
        roomNumber: room.roomNumber,
        floor: room.floor,
        roomTypeName: room.roomType.name,
        status: room.status,
        cells: nights.map((night) => {
          const blocked = blockedStatuses.has(room.status);
          const reference = byRoomNight.get(`${room.id}:${night}`) ?? null;
          return {
            night,
            kind: blocked ? ("blocked" as const) : reference ? ("sold" as const) : ("free" as const),
            bookingReference: reference,
          };
        }),
      })),
    },
  };
}
