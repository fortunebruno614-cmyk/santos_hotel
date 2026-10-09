import { BookingStatus, RoomStatus } from "@/generated/prisma/enums";

/** Human labels for the reservation and housekeeping boards (client + server). */

export const BOOKING_STATUS_LABELS: Record<BookingStatus, string> = {
  [BookingStatus.PENDING]: "Pending",
  [BookingStatus.CONFIRMED]: "Confirmed",
  [BookingStatus.CHECKED_IN]: "Checked in",
  [BookingStatus.CHECKED_OUT]: "Checked out",
  [BookingStatus.CANCELLED]: "Cancelled",
  [BookingStatus.NO_SHOW]: "No show",
};

export const ROOM_STATUS_LABELS: Record<RoomStatus, string> = {
  [RoomStatus.AVAILABLE]: "Available",
  [RoomStatus.RESERVED]: "Reserved",
  [RoomStatus.OCCUPIED]: "Occupied",
  [RoomStatus.CLEANING]: "Cleaning",
  [RoomStatus.MAINTENANCE]: "Maintenance",
  [RoomStatus.OUT_OF_SERVICE]: "Out of service",
};

export function bookingStatusLabel(status: string): string {
  return BOOKING_STATUS_LABELS[status as BookingStatus] ?? status;
}

export function roomStatusLabel(status: string): string {
  return ROOM_STATUS_LABELS[status as RoomStatus] ?? status;
}
