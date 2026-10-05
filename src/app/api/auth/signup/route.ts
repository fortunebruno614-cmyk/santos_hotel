import { NextResponse } from "next/server";
import { createGuestAccount, setSessionCookie } from "@/server/auth/service";
import { auditSignup } from "@/server/audit/write";
import { AppRole } from "@/server/auth/roles";
import { GUEST_ACCOUNTS_ENABLED } from "@/config/auth";
import { normalizeEmail, SignupSchema } from "@/server/auth/validation";

export async function POST(request: Request) {
  if (!GUEST_ACCOUNTS_ENABLED) {
    return NextResponse.json({ error: "guest_accounts_disabled" }, { status: 403 });
  }

  const parsed = SignupSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(
      { error: "invalid_body", issues: parsed.error.flatten().fieldErrors },
      { status: 400 },
    );
  }

  const input = { ...parsed.data, email: normalizeEmail(parsed.data.email) };
  const result = await createGuestAccount(input);
  if (!result) {
    return NextResponse.json({ error: "email_taken" }, { status: 409 });
  }

  await setSessionCookie(result.payload);
  await auditSignup({ guestId: result.guest.id }, result.guest.email);

  return NextResponse.json(
    { role: AppRole.GUEST, guestId: result.guest.id, email: result.guest.email },
    { status: 201 },
  );
}
