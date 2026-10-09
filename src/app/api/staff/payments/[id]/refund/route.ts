import { NextResponse } from "next/server";
import { guardApi } from "@/server/auth/api";
import { AppRole, Permissions } from "@/server/auth/roles";
import { RefundSchema } from "@/server/booking/validation";
import { refundPayment } from "@/server/payments/service";
import { bookingErrorResponse, invalidBody } from "@/server/booking/http";

/**
 * Staff refund of one payment (full or partial).
 *
 *   POST /api/staff/payments/{id}/refund
 *   { amount? }   — omit for the full remaining balance; otherwise 0.01…remaining
 *
 * The provider is called first; the row only moves to REFUNDED /
 * PARTIALLY_REFUNDED when the provider accepts, and the booking's paymentStatus
 * is re-derived in the same transaction.
 */
type Params = { params: Promise<{ id: string }> };

export async function POST(request: Request, context: Params) {
  const auth = await guardApi({
    route: "/api/staff/payments/[id]/refund",
    roles: [AppRole.STAFF, AppRole.ADMIN],
    permission: Permissions.MANAGE_PAYMENTS,
  });
  if (auth instanceof NextResponse) return auth;
  const { id } = await context.params;

  const parsed = RefundSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return invalidBody(parsed.error.flatten().fieldErrors);

  try {
    const payment = await refundPayment(
      { paymentId: id, amount: parsed.data.amount ?? null },
      { userId: auth.userId! },
    );
    return NextResponse.json({ payment });
  } catch (error) {
    return bookingErrorResponse(error);
  }
}
