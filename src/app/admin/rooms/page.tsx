import { prisma } from "@/lib/prisma";
import { RoomBoard } from "./room-board";
import { allowedRoomTransitions } from "@/server/booking/policy";

/**
 * Staff room board. The legal next statuses come from the same server policy
 * the API enforces, so the UI can never offer an illegal transition.
 */
export default async function AdminRoomsPage() {
  const rooms = await prisma.room.findMany({
    orderBy: { roomNumber: "asc" },
    include: { roomType: { select: { name: true } } },
  });

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold">Rooms</h1>
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
    </div>
  );
}
