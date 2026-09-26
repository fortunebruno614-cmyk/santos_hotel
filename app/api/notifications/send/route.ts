import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createClient } from "@/utils/supabase/server";
import {
  sendPushNotification,
  sendPushNotifications,
  sendPushToTopic,
  subscribeFidsToTopic,
  type PushPayload,
} from "@/lib/notifications/sender";

export const runtime = "nodejs";

async function requireUser() {
  const cookieStore = await cookies();
  const supabase = createClient(cookieStore);
  const { data: { user } } = await supabase.auth.getUser();
  return { supabase, user };
}

/**
 * POST /api/notifications/send
 *
 * Body:
 *   {
 *     fid?: string,           // single device
 *     fids?: string[],        // multiple devices
 *     topic?: string,         // topic-based
 *     subscribe?: string[],   // FIDs to subscribe to `topic`
 *     title: string,
 *     body?: string,
 *     url?: string,
 *     icon?: string,
 *     data?: Record<string, string>
 *   }
 */
export async function POST(request: NextRequest) {
  try {
    const { supabase, user } = await requireUser();
    if (!user) {
      return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
    }

    const payload = (await request.json()) as PushPayload & {
      fid?: string;
      fids?: string[];
      subscribe?: string[];
    };

    if (!payload.title || payload.title.trim() === "") {
      return NextResponse.json({ ok: false, error: "title is required" }, { status: 400 });
    }

    // Topic subscription management
    if (payload.subscribe && payload.subscribe.length > 0 && payload.topic) {
      const result = await subscribeFidsToTopic(payload.subscribe, payload.topic);
      return NextResponse.json({ ok: true, result });
    }

    // Topic-based send
    if (payload.topic && !payload.fid && !payload.fids) {
      const result = await sendPushToTopic(payload);
      return NextResponse.json({
        ok: result.success,
        messageIds: result.messageIds,
        failures: result.failures,
        error: result.error,
        configured: result.configured,
      });
    }

    // Single device
    if (payload.fid) {
      const result = await sendPushNotification(payload.fid, payload);
      return NextResponse.json({
        ok: result.success,
        messageIds: result.messageIds,
        error: result.error,
        configured: result.configured,
      });
    }

    // Multiple devices
    if (payload.fids && payload.fids.length > 0) {
      const result = await sendPushNotifications(payload.fids, payload);
      return NextResponse.json({
        ok: result.success,
        messageIds: result.messageIds,
        failures: result.failures,
        error: result.error,
        configured: result.configured,
      });
    }

    // No target specified — default: send to the caller's own devices
    const { data: tokens } = await supabase
      .from("fcm_tokens")
      .select("token")
      .eq("user_id", user.id);

    if (!tokens || tokens.length === 0) {
      return NextResponse.json(
        { ok: false, error: "No registered devices found for this user." },
        { status: 404 }
      );
    }

    const result = await sendPushNotifications(
      tokens.map((t) => t.token),
      payload
    );

    return NextResponse.json({
      ok: result.success,
      messageIds: result.messageIds,
      failures: result.failures,
      error: result.error,
      configured: result.configured,
      targetCount: tokens.length,
    });
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: (err as Error).message },
      { status: 500 }
    );
  }
}