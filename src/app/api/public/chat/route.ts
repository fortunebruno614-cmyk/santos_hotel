import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { AI_CHAT_ENABLED } from "@/config/ai";
import { getCurrentSession, isSessionValid } from "@/server/auth/dal";
import { getDefaultHotel } from "@/server/public/hotels";
import { requireHotelContext } from "@/server/pricing/context";
import { displayCurrency } from "@/server/currency/display";
import { BOOKING_CLAIM_COOKIE, verifyBookingClaim } from "@/server/booking/claim";
import { runConcierge } from "@/server/ai/concierge";
import { hitChat } from "@/server/ai/throttle";
import type { ChatMessage } from "@/server/ai/groq";
import type { ChatPrincipal, ConciergeContext } from "@/server/ai/tools";

/**
 * AI concierge chat (anonymous — under `/api/public` in src/config/access-map.ts).
 *
 *   POST /api/public/chat   { messages: [{ role: "user"|"assistant", content }] }
 *
 * Replies with `text/event-stream` so the bubble renders tokens as they
 * arrive: `meta` → (`text` | `tool` | `auth`)* → `done` | `error`. Tool calls
 * are executed server-side inside the turn (src/server/ai/concierge.ts); the
 * browser only ever sees their short human labels.
 *
 * Identity comes from the session cookie (validated against the DB) plus the
 * optional booking claim — never from the body — so a caller can only act as
 * themselves. Signup is the one effect that must leave the stream: a session
 * cookie cannot be set after the first byte, so the turn carries a short-lived
 * signed token that `POST /api/auth/session` redeems.
 */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const BodySchema = z.object({
  messages: z
    .array(
      z.object({
        role: z.enum(["user", "assistant"]),
        content: z.string().min(1).max(4_000),
      }),
    )
    .min(1)
    .max(40),
});

export async function POST(request: Request) {
  if (!AI_CHAT_ENABLED) {
    return NextResponse.json({ error: "chat_disabled" }, { status: 503 });
  }

  const parsed = BodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid_body" }, { status: 400 });
  }

  const ip =
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    request.headers.get("x-real-ip")?.trim() ||
    "local";
  const throttle = hitChat(ip);
  if (throttle.limited) {
    return NextResponse.json(
      { error: "rate_limited", retryAfterSec: throttle.retryAfterSec },
      { status: 429, headers: { "retry-after": String(throttle.retryAfterSec) } },
    );
  }

  // --- Identity (cookie first, database second; never from the payload) ---
  const rawSession = await getCurrentSession();
  const session = rawSession && (await isSessionValid(rawSession)) ? rawSession : null;

  let principal: ChatPrincipal = { kind: "anonymous" };
  if (session?.kind === "guest" && session.guestId) {
    const guest = await prisma.guest.findUnique({
      where: { id: session.guestId },
      select: { firstName: true, email: true, isActive: true },
    });
    principal = guest?.isActive
      ? {
          kind: "guest",
          guestId: session.guestId,
          firstName: guest.firstName || "guest",
          email: guest.email ?? session.email ?? null,
        }
      : { kind: "anonymous" };
  } else if (session?.kind === "staff" && session.userId) {
    principal = {
      kind: "staff",
      userId: session.userId,
      email: session.email ?? null,
      organizationId: session.orgId ?? "",
    };
  }

  const claim = await verifyBookingClaim(
    (await cookies()).get(BOOKING_CLAIM_COOKIE)?.value,
  );

  const hotelRow = await getDefaultHotel();
  if (!hotelRow) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }
  const hotel = await requireHotelContext(hotelRow.id);

  const context: ConciergeContext = {
    hotel,
    principal,
    claim,
    displayCurrency: await displayCurrency(),
  };
  const messages: ChatMessage[] = parsed.data.messages.map((message) => ({
    role: message.role,
    content: message.content,
  }));

  // --- Stream the turn; a client disconnect aborts the model request ---
  const encoder = new TextEncoder();
  const abort = new AbortController();
  const onAbort = () => abort.abort(new Error("client_disconnected"));
  request.signal.addEventListener("abort", onAbort, { once: true });

  const body = new ReadableStream<Uint8Array>({
    async start(controller) {
      let closed = false;
      const send = (event: string, data: unknown) => {
        if (closed) return;
        controller.enqueue(encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`));
      };
      try {
        for await (const event of runConcierge({ messages, context, signal: abort.signal })) {
          send(event.type, event);
        }
      } catch (error) {
        console.error("concierge turn failed", error);
        send("error", {
          type: "error",
          code: "internal",
          message: "The chat hit an unexpected problem — please try again.",
        });
      } finally {
        closed = true;
        request.signal.removeEventListener("abort", onAbort);
        try {
          controller.close();
        } catch {
          // Already cancelled by the client — nothing left to close.
        }
      }
    },
    cancel() {
      abort.abort(new Error("client_disconnected"));
    },
  });

  return new Response(body, {
    headers: {
      "content-type": "text/event-stream; charset=utf-8",
      "cache-control": "no-cache, no-transform",
      connection: "keep-alive",
      "x-accel-buffering": "no",
    },
  });
}
