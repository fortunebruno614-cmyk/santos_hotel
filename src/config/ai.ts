/**
 * AI concierge (live chat) flags — the same reversible-defaults style as the
 * other src/config modules: every value is an env var, nothing is hardcoded
 * into the product.
 *
 *   GROQ_API_KEY         Groq key used server-side for the chat completions
 *                        that drive the floating widget. Never exposed to the
 *                        browser (no NEXT_PUBLIC_ prefix).
 *   GROQ_MODEL           Chat model id with tool calling (default
 *                        "openai/gpt-oss-120b").
 *   AI_CHAT_ENABLED      false disables the endpoint (503) even when a key is
 *                        present — the kill switch for a runaway bill.
 *   AI_MAX_TOOL_ROUNDS   Tool-call round trips one turn may spend before the
 *                        assistant must answer with what it has.
 *   AI_MAX_HISTORY       Largest number of prior messages replayed per turn
 *                        (keeps context — and cost — bounded).
 *   AI_TIMEOUT_MS        Ceiling for a single Groq request.
 */

function envInt(raw: string | undefined, fallback: number, min: number, max: number): number {
  if (raw === undefined || raw.trim() === "") return fallback;
  const value = Number.parseInt(raw, 10);
  return Number.isInteger(value) && value >= min && value <= max ? value : fallback;
}

export const GROQ_API_KEY = process.env.GROQ_API_KEY?.trim() || null;

export const GROQ_MODEL = process.env.GROQ_MODEL?.trim() || "openai/gpt-oss-120b";

export const AI_CHAT_ENABLED =
  process.env.AI_CHAT_ENABLED !== "false" && Boolean(GROQ_API_KEY);

export const AI_MAX_TOOL_ROUNDS = envInt(process.env.AI_MAX_TOOL_ROUNDS, 6, 1, 12);

export const AI_MAX_HISTORY = envInt(process.env.AI_MAX_HISTORY, 30, 2, 100);

export const AI_TIMEOUT_MS = envInt(process.env.AI_TIMEOUT_MS, 45_000, 5_000, 120_000);
