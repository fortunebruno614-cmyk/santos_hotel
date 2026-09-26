import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createClient } from "@/utils/supabase/server";

const PAYSTACK_SECRET = process.env.PAYSTACK_SECRET_KEY!;

function isMissingColumn(message: string | undefined | null): boolean {
  if (!message) return false;
  return (
    message.includes("payment_reference") ||
    message.includes("Could not find the") ||
    /42703/.test(message)
  );
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const reference = searchParams.get("reference");
  const baseUrl = new URL(request.url).origin;

  console.log("[verify] entry reference=", reference);

  if (!reference) {
    console.log("[verify] exit: no reference");
    return NextResponse.redirect(`${baseUrl}/dashboard/thank-you`);
  }

  // Verify payment with Paystack
  const paystackRes = await fetch(`https://api.paystack.co/transaction/verify/${reference}`, {
    headers: { Authorization: `Bearer ${PAYSTACK_SECRET}` },
  });

  const paystackData = await paystackRes.json();

  const cookieStore = await cookies();
  const supabase = createClient(cookieStore);

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    console.log("[verify] exit: no user session");
    return NextResponse.redirect(`${baseUrl}/login`);
  }

  const meta = paystackData.data?.metadata;
  const status = paystackData.data?.status;
  console.log("[verify] paystack status=", status, "room_id=", meta?.room_id, "raw=", JSON.stringify(paystackData?.message || paystackData?.data?.message || null));

  if (status === "success" && meta?.room_id) {
    // Check if booking already exists for this reference
    const dup = await supabase
      .from("bookings")
      .select("id")
      .eq("payment_reference", reference)
      .single();

    if (dup.error && isMissingColumn(dup.error.message)) {
      console.log("[verify] payment_reference column missing — skipping dedupe check");
    } else if (dup.data) {
      console.log("[verify] exit: booking already exists id=", dup.data.id, "-> sending push anyway");
      await tryPush(supabase, user.id, meta, dup.data.id);
      return NextResponse.redirect(`${baseUrl}/dashboard/thank-you?id=${dup.data.id}`);
    }

    const row = {
      user_id: user.id,
      room_id: Number(meta.room_id),
      room_name: meta.room_name,
      checkin: meta.checkin,
      checkout: meta.checkout,
      guests: Number(meta.guests),
      full_name: meta.full_name,
      email: meta.email,
      phone: meta.phone,
      total_price: Number(meta.total_price),
      status: "confirmed",
    };

    let { data: booking, error } = await supabase
      .from("bookings")
      .insert({ ...row, payment_reference: reference })
      .select("id")
      .single();

    // Schema fallback: if payment_reference column doesn't exist yet, insert without it
    if (error && isMissingColumn(error.message)) {
      console.log("[verify] payment_reference column missing — retrying insert without it. Run add-payment-reference.sql");
      const retry = await supabase.from("bookings").insert(row).select("id").single();
      booking = retry.data;
      error = retry.error;
    }

    if (error || !booking) {
      console.log("[verify] exit: booking insert failed:", error?.message ?? "no booking id returned");
      return NextResponse.redirect(`${baseUrl}/dashboard/thank-you`);
    }

    console.log("[verify] booking created id=", booking.id);

    // Send confirmation email (non-blocking)
    try {
      const { sendBookingEmail } = await import("@/lib/send-email");
      sendBookingEmail({
        id: booking.id,
        room_id: Number(meta.room_id),
        room_name: meta.room_name,
        checkin: meta.checkin,
        checkout: meta.checkout,
        guests: Number(meta.guests),
        full_name: meta.full_name,
        email: meta.email,
        phone: meta.phone,
        total_price: Number(meta.total_price),
        payment_reference: reference,
      }).catch((e) => console.error("[email] send failed:", e?.message || e));
    } catch (e) {
      console.error("[email] exception:", (e as Error)?.message || e);
    }

    await tryPush(supabase, user.id, meta, booking.id);

    return NextResponse.redirect(`${baseUrl}/dashboard/thank-you?id=${booking.id}`);
  }

  // Payment failed or no metadata — still go to thank you page
  console.log("[verify] exit: payment not successful or missing metadata");
  return NextResponse.redirect(`${baseUrl}/dashboard/thank-you`);
}

async function tryPush(
  supabase: ReturnType<typeof createClient>,
  userId: string,
  meta: { room_name?: string; [k: string]: unknown },
  bookingId: string
) {
  try {
    const { sendPushNotifications } = await import("@/lib/notifications/sender");
    const { data, error } = await supabase
      .from("fcm_tokens")
      .select("token")
      .eq("user_id", userId);

    if (error) {
      console.error("[push] failed to load fcm_tokens:", error.message);
      return;
    }
    if (!data || data.length === 0) {
      console.log("[push] no fcm_tokens rows for user", userId);
      return;
    }
    console.log("[push] sending to", data.length, "device(s)");
    const r = await sendPushNotifications(
      data.map((t: { token: string }) => t.token),
      {
        title: "Booking Confirmed!",
        body: `Your reservation for ${meta.room_name ?? "your room"} is confirmed. View details.`,
        url: "/dashboard/thank-you?id=" + bookingId,
      }
    );
    console.log("[push] booking notify:", JSON.stringify(r));
  } catch (e) {
    console.error("[push] booking notify exception:", (e as Error)?.message || e);
  }
}
