import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { QuoteQuerySchema } from "@/server/booking/validation";
import { parseDateOnly } from "@/server/availability/overlap";
import { assertRoomsAvailable } from "@/server/availability/service";
import { buildQuote } from "@/server/pricing/service";
import { bookingErrorResponse, invalidBody } from "@/server/booking/http";

/**
 * Public price quote (anonymous — under `/api/public` in src/config/access-map.ts).
 *
 *   GET /api/public/quote?checkIn=2026-11-01&checkOut=2026-11-03&adults=2&children=1
 *       &rooms=<roomId>[,<roomId>…]&promotionCode=STAY10
 *
 * Prices a concrete room allocation server-side (rate × nights + taxes/fees −
 * discount) and — because a price for an unusable room is a lie — re-checks
 * availability first. It is read-only: holds are only ever taken inside the
 * checkout transaction.
 */
export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  const parsed = QuoteQuerySchema.safeParse({
    checkIn: params.get("checkIn") ?? undefined,
    checkOut: params.get("checkOut") ?? undefined,
    adults: params.get("adults") ?? undefined,
    children: params.get("children") ?? undefined,
    rooms: params.get("rooms") ?? undefined,
    promotionCode: params.get("promotionCode") ?? undefined,
  });

  if (!parsed.success) return invalidBody(parsed.error.flatten().fieldErrors);

  try {
    const checkIn = parseDateOnly(parsed.data.checkIn)!;
    const checkOut = parseDateOnly(parsed.data.checkOut)!;
    const stay = {
      checkIn,
      checkOut,
      adults: parsed.data.adults,
      children: parsed.data.children,
    };
    await assertRoomsAvailable(prisma, stay, parsed.data.roomIds);
    const quote = await buildQuote({
      ...stay,
      roomIds: parsed.data.roomIds,
      promotionCode: parsed.data.promotionCode ?? null,
    });
    return NextResponse.json(quote);
  } catch (error) {
    return bookingErrorResponse(error);
  }
}
