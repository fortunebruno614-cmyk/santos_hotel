import { prisma } from "@/lib/prisma";
import { RatesManager } from "./rates-manager";

/** Rate catalog (P7 CRUD): dated price windows per room type. */
export default async function AdminRatesPage() {
  const [rates, roomTypes] = await Promise.all([
    prisma.rate.findMany({
      orderBy: [{ startDate: "desc" }, { name: "asc" }],
      include: { roomType: { select: { name: true } } },
    }),
    prisma.roomType.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true } }),
  ]);

  return (
    <RatesManager
      rates={rates.map((row) => ({
        id: row.id,
        roomTypeId: row.roomTypeId,
        roomTypeName: row.roomType.name,
        name: row.name,
        amount: row.amount.toString(),
        startDate: row.startDate.toISOString().slice(0, 10),
        endDate: row.endDate.toISOString().slice(0, 10),
        status: row.status,
      }))}
      roomTypes={roomTypes}
    />
  );
}
