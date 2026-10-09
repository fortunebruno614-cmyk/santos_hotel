import { NextResponse } from "next/server";
import { guardApi } from "@/server/auth/api";
import { AppRole, Permissions } from "@/server/auth/roles";
import { InitiatePaymentSchema } from "@/server/booking/validation";
import { initiatePayment, recordDeskPayment } from "@/server/payments/service";
import { bookingErrorResponse, invalidBody } from "@/server/booking/http";

/**
 * Staff payments (desk).
 *
 *   POST /api/staff/payments
 *   { bookingId, mode: "desk" | "online" }
 *
 *   mode "desk"   — money taken at the desk (cash/card terminal): records a
 *                   PAID payment immediately and confirms the booking.
 *   mode "online" — prepares/reuses a pending gateway intent the guest will
 *                   complete (returns the checkout path).
 *
 * Both are idempotent under a booking lock: a double-click cannot capture or
 * initiate twice.
 */
export async function POST(request: Request) {
  const auth = await guardApi({
    route: "/api/staff/payments",
    roles: [AppRole.STAFF, AppRole.ADMIN],
    permission: Permissions.MANAGE_PAYMENTS,
  });
  if (auth instanceof NextResponse) return auth;

  const body = await request.json().catch(() => null);
  const parsedInitiate = InitiatePaymentSchema.safeParse(body);
  if (!parsedInitiate.success) return invalidBody(parsedInitiate.error.flatten().fieldErrors);

  const mode =
    body && typeof body === "object" && "mode" in body && body.mode === "desk" ? "desk" : "online";

  try {
    if (mode === "desk") {
      const payment = await recordDeskPayment(parsedInitiate.data.bookingId, {
        userId: auth.userId!,
      });
      return NextResponse.json({ payment }, { status: 201 });
    }
    const result = await initiatePayment(parsedInitiate.data.bookingId, {
      userId: auth.userId!,
    });
    return NextResponse.json(result, { status: result.created ? 201 : 200 });
  } catch (error) {
    return bookingErrorResponse(error);
  }
}
