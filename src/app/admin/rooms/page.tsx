import { prisma } from "@/lib/prisma";
import { RoomBoard } from "./room-board";
import { RoomsInventory } from "./rooms-inventory";
import { allowedRoomTransitions } from "@/server/booking/policy";

/**
 * Staff rooms console (P7): the housekeeping status board plus the inventory
 * CRUD (add / edit / delete physical rooms). Legal next statuses come from the
 * same server policy the API enforces, so the UI can never offer an illegal
 * transition.
 */
export default async function AdminRoomsPage() {
  const [rooms, roomTypes] = await Promise.all([
    prisma.room.findMany({
      orderBy: { roomNumber: "asc" },
      include: { roomType: { select: { name: true } } },
    }),
    prisma.roomType.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true } }),
  ]);

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold">Rooms</h1>
        <p className="text-sm text-zinc-500">
          Status board for housekeeping and the room inventory behind it.
        </p>
      </div>

      <section className="space-y-3">
        <h2 className="text-lg font-medium">Status board</h2>
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
      </section>

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
