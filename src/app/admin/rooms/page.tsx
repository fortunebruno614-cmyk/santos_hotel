import { PageHeader } from "@/components/admin/ui";
import { prisma } from "@/lib/prisma";
import { RoomBoard } from "./room-board";
import { RoomsInventory } from "./rooms-inventory";
import { allowedRoomTransitions } from "@/server/booking/policy";
import { getConsoleContext } from "@/server/console/context";

/**
 * Staff rooms console (P7): the housekeeping status board plus the inventory
 * CRUD (add / edit / delete physical rooms). Legal next statuses come from the
 * same server policy the API enforces, so the UI can never offer an illegal
 * transition.
 */
export default async function AdminRoomsPage() {
  const { hotel } = await getConsoleContext();
  const [rooms, roomTypes] = await Promise.all([
    prisma.room.findMany({
      where: { roomType: { hotelId: hotel.id } },
      orderBy: { roomNumber: "asc" },
      include: { roomType: { select: { name: true } } },
    }),
    prisma.roomType.findMany({
      where: { hotelId: hotel.id },
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    }),
  ]);

  return (
    <div className="space-y-5">
      <PageHeader
        title="Rooms"
        description="Status board for housekeeping and the physical room inventory behind it."
      />

      <RoomBoard
        rooms={rooms.map((room) => ({
          id: room.id,
          roomNumber: room.roomNumber,
          floor: room.floor,
          status: room.status,
          roomTypeName: room.roomType.name,
          allowedTransitions: allowedRoomTransitions(room.status),
        }))}
      />

      <RoomsInventory
        rooms={rooms.map((room) => ({
          id: room.id,
          roomNumber: room.roomNumber,
          floor: room.floor,
          status: room.status,
          notes: room.notes,
          roomTypeId: room.roomTypeId,
          roomTypeName: room.roomType.name,
        }))}
        roomTypes={roomTypes}
      />
    </div>
  );
}
