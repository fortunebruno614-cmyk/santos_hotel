import { prisma } from "@/lib/prisma";
import { PromotionsManager } from "./promotions-manager";

/** Promotions catalog (P7 CRUD). */
export default async function AdminPromotionsPage() {
  const promotions = await prisma.promotion.findMany({
    orderBy: [{ status: "asc" }, { code: "asc" }],
    include: { _count: { select: { bookings: true } } },
  });

  return (
    <PromotionsManager
      promotions={promotions.map((row) => ({
        id: row.id,
        code: row.code,
        type: row.type,
        value: row.value.toString(),
        startAt: row.startAt.toISOString(),
        endAt: row.endAt.toISOString(),
        maxUses: row.maxUses,
        status: row.status,
        redeemed: row._count.bookings,
      }))}
    />
  );
}
