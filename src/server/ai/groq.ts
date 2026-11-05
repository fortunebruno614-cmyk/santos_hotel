import { AI_TIMEOUT_MS, GROQ_API_KEY, GROQ_MODEL } from "@/config/ai";

/**
 * Minimal Groq chat-completions client (OpenAI-compatible wire format).
 *
 * Only what the concierge needs: chat messages, tool definitions, one
 * streaming path (the widget renders tokens as they arrive) and one
 * non-streaming path. Every failure surfaces as `GroqError` with a stable
 * `code` so the route can answer the browser with something honest instead of
 * a stack trace — and the API key never leaves this module.
 */

export type ChatRole = "system" | "user" | "assistant" | "tool";

export type ChatMessage =
  | { role: "system"; content: string }
  | { role: "user"; content: string }
  | { role: "assistant"; content: string | null; toolCalls?: ChatToolCall[] }
  | { role: "tool"; tool_call_id: string; name: string; content: string };

/** Wire shape Groq expects (tool results carry only the id + JSON payload). */
function toWire(message: ChatMessage): Record<string, unknown> {
  if (message.role === "assistant") {
    if (message.toolCalls && message.toolCalls.length > 0) {
      return {
        role: "assistant",
        content: message.content ?? "",
        tool_calls: message.toolCalls.map((call) => ({
          id: call.id,
          type: "function",
          function: { name: call.name, arguments: call.arguments },
        })),
      };
    }
    return { role: "assistant", content: message.content ?? "" };
  }
  if (message.role === "tool") {
    return { role: "tool", tool_call_id: message.tool_call_id, content: message.content };
  }
  return { role: message.role, content: message.content };
}

export type ToolDefinition = {
  type: "function";
  function: {
    name: string;
    description: string;
    parameters: Record<string, unknown>;
  };
};

export type ChatToolCall = { id: string; name: string; arguments: string };

export type AssistantTurn = {
  content: string;
  toolCalls: ChatToolCall[];
  finishReason: string;
};

export type StreamEvent =
  | { type: "text"; text: string }
  | { type: "turn"; turn: AssistantTurn };

export type GroqErrorCode =
  | "chat_disabled"
  | "invalid_api_key"
  | "rate_limited"
  | "bad_request"
  | "upstream_error"
  | "network_error"
  | "chat_timeout";

export class GroqError extends Error {
  readonly code: GroqErrorCode;
  readonly status: number;
  constructor(code: GroqErrorCode, message: string, status = 0) {
    super(message);
    this.name = "GroqError";
    this.code = code;
    this.status = status;
  }
}

const GROQ_URL = "https://api.groq.com/openai/v1/chat/completions";

/** Tools are optional; tool_choice stays on "auto" so the model decides. */
export type ChatRequest = {
  messages: ChatMessage[];
  tools?: ToolDefinition[];
  temperature?: number;
  maxTokens?: number;
  signal?: AbortSignal;
};

function requestBody(request: ChatRequest, stream: boolean) {
  return {
    model: GROQ_MODEL,
    messages: request.messages.map(toWire),
    ...(request.tools && request.tools.length > 0 ? { tools: request.tools, tool_choice: "auto" } : {}),
    temperature: request.temperature ?? 0.4,
    ...(request.maxTokens ? { max_tokens: request.maxTokens } : {}),
    stream,
  };
}

/**
 * The request signal (client disconnect) *and* the AI_TIMEOUT_MS ceiling on
 * the same controller — a hung upstream must not pin a connection open.
 * The caller disposes when it is done reading the body.
 */
function openRequest(request: ChatRequest): {
  signal: AbortSignal;
  dispose: () => void;
} {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(new Error("chat_timeout")), AI_TIMEOUT_MS);
  const onAbort = () => controller.abort(request.signal?.reason ?? new Error("aborted"));
  request.signal?.addEventListener("abort", onAbort, { once: true });
  return {
    signal: controller.signal,
    dispose: () => {
      clearTimeout(timer);
      request.signal?.removeEventListener("abort", onAbort);
    },
  };
}

async function errorFromBody(status: number, res: Response): Promise<GroqError> {
  let detail = "";
  try {
    const payload = (await res.json()) as { error?: { message?: string } };
    detail = payload.error?.message ?? "";
  } catch {
    // Non-JSON error body (proxy/HTML) — the status alone is the signal.
  }
  if (status === 401 || status === 403) {
    return new GroqError("invalid_api_key", "The chat service rejected its API key.", status);
  }
  if (status === 429) {
    return new GroqError("rate_limited", "The chat service is busy — try again in a moment.", status);
  }
  if (status >= 500) {
    return new GroqError("upstream_error", "The chat service is unavailable right now.", status);
  }
  return new GroqError(
    "bad_request",
    detail ? `Chat request rejected: ${detail.slice(0, 300)}` : "Chat request rejected.",
    status,
  );
}

async function post(request: ChatRequest, stream: boolean): Promise<{ res: Response; dispose: () => void }> {
  if (!GROQ_API_KEY) {
    throw new GroqError("chat_disabled", "AI chat is not configured (GROQ_API_KEY missing).", 503);
  }
  const { signal, dispose } = openRequest(request);
  try {
    const res = await fetch(GROQ_URL, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${GROQ_API_KEY}`,
      },
      body: JSON.stringify(requestBody(request, stream)),
      signal,
      cache: "no-store",
    });
    if (!res.ok) {
      dispose();
      throw await errorFromBody(res.status, res);
    }
    return { res, dispose };
  } catch (error) {
    dispose();
    if (error instanceof GroqError) throw error;
    const message = String((error as Error)?.message ?? "");
    if ((error as Error)?.name === "AbortError" || message.includes("chat_timeout") || message.includes("aborted")) {
      const timedOut = message.includes("chat_timeout");
      throw new GroqError(
        timedOut ? "chat_timeout" : "network_error",
        timedOut ? "The chat request timed out." : "The chat request was cancelled.",
      );
    }
    throw new GroqError("network_error", "Could not reach the chat service.");
  }
}

/** One non-streaming completion (used by tests and simple call sites). */
export async function groqChat(request: ChatRequest): Promise<AssistantTurn> {
  const { res, dispose } = await post(request, false);
  try {
    const payload = (await res.json()) as {
      choices?: Array<{ message?: { content?: string | null; tool_calls?: RawToolCall[] }; finish_reason?: string }>;
    };
    const choice = payload.choices?.[0];
    return {
      content: choice?.message?.content ?? "",
      toolCalls: (choice?.message?.tool_calls ?? []).map(normalizeToolCall).filter((call) => call.name),
      finishReason: choice?.finish_reason ?? "stop",
    };
  } catch {
    throw new GroqError("upstream_error", "The chat service sent an unreadable response.");
  } finally {
    dispose();
  }
}

type RawToolCall = {
  id?: string;
  function?: { name?: string; arguments?: string };
};

function normalizeToolCall(raw: RawToolCall, index: number): ChatToolCall {
  return {
    id: raw.id || `call_${index}`,
    name: raw.function?.name ?? "",
    arguments: raw.function?.arguments ?? "",
  };
}

/** Yields text deltas as they arrive, then a final `turn` with the full result. */
export async function* groqChatStream(request: ChatRequest): AsyncGenerator<StreamEvent> {
  const { res, dispose } = await post(request, true);
  try {
    const reader = res.body?.getReader();
    if (!reader) throw new GroqError("upstream_error", "The chat stream had no body.");

    const decoder = new TextDecoder();
    let buffer = "";
    let content = "";
    const calls = new Map<number, ChatToolCall>();
    let finishReason = "stop";

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });

      const lines = buffer.split("\n");
      buffer = lines.pop() ?? "";
      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed.startsWith("data:")) continue;
        const payload = trimmed.slice(5).trim();
        if (!payload || payload === "[DONE]") continue;

        let chunk: {
          choices?: Array<{
            delta?: { content?: string | null; tool_calls?: Array<RawToolCall & { index?: number }> };
            finish_reason?: string | null;
          }>;
        };
        try {
          chunk = JSON.parse(payload);
        } catch {
          continue; // keep-alive/comment noise never breaks the stream
        }
        const choice = chunk.choices?.[0];
        if (!choice) continue;

        const piece = choice.delta?.content;
        if (piece) {
          content += piece;
          yield { type: "text", text: piece };
        }
        for (const fragment of choice.delta?.tool_calls ?? []) {
          const index = fragment.index ?? 0;
          const current = calls.get(index) ?? { id: `call_${index}`, name: "", arguments: "" };
          if (fragment.id) current.id = fragment.id;
          if (fragment.function?.name) current.name += fragment.function.name;
          if (fragment.function?.arguments) current.arguments += fragment.function.arguments;
          calls.set(index, current);
        }
        if (choice.finish_reason) finishReason = choice.finish_reason;
      }
    }

    const toolCalls = [...calls.entries()]
      .sort((a, b) => a[0] - b[0])
      .map(([, call]) => call)
      .filter((call) => call.name.length > 0);

    yield { type: "turn", turn: { content, toolCalls, finishReason } };
  } catch (error) {
    if (error instanceof GroqError) throw error;
    const message = String((error as Error)?.message ?? "");
    if ((error as Error)?.name === "AbortError" || message.includes("chat_timeout") || message.includes("aborted")) {
      const timedOut = message.includes("chat_timeout");
      throw new GroqError(
        timedOut ? "chat_timeout" : "network_error",
        timedOut ? "The chat request timed out." : "The chat request was cancelled.",
      );
    }
    throw new GroqError("network_error", "Lost connection to the chat service.");
  } finally {
    dispose();
  }
}
