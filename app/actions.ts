"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { createClient } from "@/utils/supabase/server";

export async function login(formData: FormData) {
  const cookieStore = await cookies();
  const supabase = createClient(cookieStore);

  const email = formData.get("email") as string;
  const password = formData.get("password") as string;

  const { error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (error) {
    redirect("/login?error=" + encodeURIComponent(error.message));
  }

  redirect("/dashboard");
}

export async function register(formData: FormData) {
  const cookieStore = await cookies();
  const supabase = createClient(cookieStore);

  const email = formData.get("email") as string;
  const password = formData.get("password") as string;
  const fullName = formData.get("fullName") as string;

  const { error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: {
        full_name: fullName,
      },
    },
  });

  if (error) {
    redirect("/register?error=" + encodeURIComponent(error.message));
  }

  redirect("/login?message=Account created. Please log in.");
}

export async function signOut() {
  const cookieStore = await cookies();
  const supabase = createClient(cookieStore);

  await supabase.auth.signOut();
  redirect("/");
}

export async function getProfile() {
  const cookieStore = await cookies();
  const supabase = createClient(cookieStore);

  const { data: { user } } = await supabase.auth.getUser();
  return user;
}

export async function uploadAvatar(file: File) {
  const cookieStore = await cookies();
  const supabase = createClient(cookieStore);

  if (!file || file.size === 0) {
    return { error: "No file selected." };
  }

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return { error: "Not logged in." };
  }

  const fileExt = file.name.split(".").pop();
  const filePath = `${user.id}.${fileExt}`;

  const { error: uploadError } = await supabase.storage
    .from("santos_hotel")
    .upload(filePath, file, { upsert: true });

  if (uploadError) {
    return { error: uploadError.message };
  }

  const { data: urlData } = supabase.storage.from("santos_hotel").getPublicUrl(filePath);

  const { error: updateError } = await supabase.auth.updateUser({
    data: { avatar_url: urlData.publicUrl },
  });

  if (updateError) {
    return { error: updateError.message };
  }

  return { url: urlData.publicUrl };
}

export async function updateProfile(formData: FormData) {
  const cookieStore = await cookies();
  const supabase = createClient(cookieStore);

  const fullName = formData.get("fullName") as string;
  const phone = formData.get("phone") as string;

  const { error } = await supabase.auth.updateUser({
    data: {
      full_name: fullName,
      phone,
    },
  });

  if (error) {
    redirect("/dashboard/profile?error=" + encodeURIComponent(error.message));
  }

  redirect("/dashboard/profile?message=Profile updated successfully.");
}

export async function updateEmail(formData: FormData) {
  const cookieStore = await cookies();
  const supabase = createClient(cookieStore);

  const email = formData.get("email") as string;

  const { error } = await supabase.auth.updateUser({ email });

  if (error) {
    redirect("/dashboard/profile?error=" + encodeURIComponent(error.message));
  }

  redirect("/dashboard/profile?message=Confirmation email sent to your new address.");
}

export async function updatePassword(formData: FormData) {
  const cookieStore = await cookies();
  const supabase = createClient(cookieStore);

  const password = formData.get("password") as string;

  const { error } = await supabase.auth.updateUser({ password });

  if (error) {
    redirect("/dashboard/profile?error=" + encodeURIComponent(error.message));
  }

  redirect("/dashboard/profile?message=Password updated successfully.");
}

export async function getBookings() {
  const cookieStore = await cookies();
  const supabase = createClient(cookieStore);

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return [];

  const { data } = await supabase
    .from("bookings")
    .select("*")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false });

  return data ?? [];
}

const PAYSTACK_SECRET = process.env.PAYSTACK_SECRET_KEY!;

export async function initializePayment(email: string, amount: number, metadata: Record<string, string>) {
  const res = await fetch("https://api.paystack.co/transaction/initialize", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${PAYSTACK_SECRET}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      email,
      amount: amount * 100,
      currency: "NGN",
      metadata,
    }),
  });

  const data = await res.json();
  if (!data.status) {
    return { error: data.message || "Payment initialization failed" };
  }

  return { url: data.data.authorization_url, reference: data.data.reference };
}

export async function verifyPayment(reference: string) {
  const res = await fetch(`https://api.paystack.co/transaction/verify/${reference}`, {
    headers: {
      Authorization: `Bearer ${PAYSTACK_SECRET}`,
    },
  });

  const data = await res.json();
  if (!data.status) {
    return { verified: false, error: data.message };
  }

  return { verified: data.data.status === "success", data: data.data };
}

// ------------------------------------------------------------
// FCM push notifications
// ------------------------------------------------------------

/**
 * Registers (upserts) a device token for the currently logged-in user.
 * Duplicate tokens for the same user are collapsed via the unique constraint.
 */
export async function registerDeviceToken(token: string, deviceName?: string) {
  if (!token || token.trim() === "") {
    return { ok: false, error: "Token is required." };
  }

  const cookieStore = await cookies();
  const supabase = createClient(cookieStore);

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return { ok: false, error: "Please log in first." };
  }

  const { error } = await supabase.from("fcm_tokens").upsert(
    {
      user_id: user.id,
      token: token.trim(),
      device_name: deviceName?.slice(0, 200) || "Web",
      last_seen_at: new Date().toISOString(),
    },
    { onConflict: "user_id,token" }
  );

  if (error) {
    console.error("[fcm] registerDeviceToken failed:", error.message);
    const friendly = error.message.includes("Could not find the table")
      ? "fcm_tokens table is missing — run create-fcm-tokens-table.sql in the Supabase SQL Editor."
      : error.message;
    return { ok: false, error: friendly };
  }

  console.log("[fcm] device token saved for user", user.id, "fid", token.slice(0, 12) + "...");
  return { ok: true };
}

/**
 * Removes a device token for the currently logged-in user.
 */
export async function removeDeviceToken(token: string) {
  const cookieStore = await cookies();
  const supabase = createClient(cookieStore);

  const { data: { user } } = await supabase.auth.getUser();
  if (!user || !token) return { ok: true };

  await supabase.from("fcm_tokens").delete().eq("user_id", user.id).eq("token", token);

  return { ok: true };
}

/**
 * Deletes all device tokens from the currently logged-in user's devices
 * (used on sign-out / unsubscribe-all).
 */
export async function clearAllDeviceTokens() {
  const cookieStore = await cookies();
  const supabase = createClient(cookieStore);

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: true };

  await supabase.from("fcm_tokens").delete().eq("user_id", user.id);

  return { ok: true };
}

/**
 * Returns the device tokens currently registered for the user.
 */
export async function getMyDeviceTokens() {
  const cookieStore = await cookies();
  const supabase = createClient(cookieStore);

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return [];

  const { data } = await supabase
    .from("fcm_tokens")
    .select("token, device_name, created_at, last_seen_at")
    .eq("user_id", user.id);

  return data ?? [];
}

/**
 * Sends a test push notification to the current user's own devices.
 */
export async function sendTestNotification(title = "Santos Hotel", body = "This is a test notification!") {
  const cookieStore = await cookies();
  const supabase = createClient(cookieStore);

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return { ok: false, error: "Please log in first." };
  }

  const { data: tokens } = await supabase
    .from("fcm_tokens")
    .select("token")
    .eq("user_id", user.id);

  if (!tokens || tokens.length === 0) {
    return {
      ok: false,
      error: "No devices registered yet. Enable notifications on this browser first.",
    };
  }

  const { sendPushNotifications } = await import("@/lib/notifications/sender");
  const result = await sendPushNotifications(
    tokens.map((t) => t.token),
    { title, body, url: "/dashboard" }
  );

  if (result.error) {
    return { ok: false, error: result.error };
  }
  return {
    ok: result.success,
    failed: result.failures.length,
    messageIds: result.messageIds,
    configured: result.configured,
  };
}