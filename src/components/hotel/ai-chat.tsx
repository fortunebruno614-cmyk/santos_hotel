"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { Fragment, useCallback, useEffect, useRef, useState } from "react";
import { MessageCircle, Send, Sparkles, X } from "lucide-react";
import { useT } from "@/components/hotel/locale-provider";
import type { Translator } from "@/lib/dictionaries";

/**
 * Floating AI concierge for every public page (mounted in HotelShell).
 *
 * One POST to /api/public/chat streams the turn back as SSE:
 *   meta → (text | tool | auth)* → done | error
 * `text` deltas render live, `tool` events become the little activity rows
 * ("Checking availability…"), `auth` redeems the sign-up session token on a
 * separate plain request (a cookie can't be set mid-stream), and the whole
 * conversation survives a refresh via sessionStorage.
 *
 * The display language travels on the `santo_locale` cookie, so the server
 * replies in it too — this component only translates its own chrome.
 */

type Activity = { name: string; status: "start" | "success" | "error"; detail?: string };

type ChatEntry = {
  id: string;
  role: "user" | "assistant";
  content: string;
  activity?: Activity[];
  notice?: string | null;
};

const STORAGE_KEY = "santo-concierge-v1";

/** Tool name → dictionary key for its activity label (start state). */
const TOOL_LABEL_KEYS: Record<string, keyof import("@/lib/dictionaries").Dictionary> = {
  suggest_rooms: "chat.tool.suggest_rooms",
  check_availability: "chat.tool.check_availability",
  check_discount: "chat.tool.check_discount",
  best_selling_rooms: "chat.tool.best_selling_rooms",
  create_reservation: "chat.tool.create_reservation",
  signup_user: "chat.tool.signup_user",
  lookup_booking: "chat.tool.lookup_booking",
  check_out_stay: "chat.tool.check_out_stay",
};

const QUICK_PROMPT_KEYS = [
  "chat.quick.rooms",
  "chat.quick.discounts",
  "chat.quick.best",
  "chat.quick.book",
  "chat.quick.signup",
  "chat.quick.checkout",
] as const satisfies readonly (keyof import("@/lib/dictionaries").Dictionary)[];

function greeting(t: Translator, signedIn: boolean): ChatEntry {
  return {
    id: "greeting",
    role: "assistant",
    content: t(signedIn ? "chat.greeting.signedIn" : "chat.greeting.guest"),
  };
}

function uid(): string {
  return `m_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

/** Inline **bold** and [label](href) — the only markdown the model is told to use. */
function renderInline(text: string): React.ReactNode[] {
  const nodes: React.ReactNode[] = [];
  const pattern = /(\*\*[^*]+\*\*)|(\[[^\]]+\]\([^)\s]+\))/g;
  let cursor = 0;
  let key = 0;
  let match: RegExpExecArray | null;
  while ((match = pattern.exec(text)) !== null) {
    if (match.index > cursor) nodes.push(text.slice(cursor, match.index));
    const token = match[0];
    if (token.startsWith("**")) {
      nodes.push(<strong key={key++}>{token.slice(2, -2)}</strong>);
    } else {
      const parts = /^\[([^\]]+)\]\(([^)\s]+)\)$/.exec(token);
      if (parts) {
        const [, label, href] = parts;
        nodes.push(
          href.startsWith("/") ? (
            <Link key={key++} href={href}>
              {label}
            </Link>
          ) : (
            <a key={key++} href={href} target="_blank" rel="noreferrer">
              {label}
            </a>
          ),
        );
      } else {
        nodes.push(token);
      }
    }
    cursor = match.index + token.length;
  }
  if (cursor < text.length) nodes.push(text.slice(cursor));
  return nodes;
}

/** Paragraphs + bullet lists, nothing heavier (the model is told the same). */
function RichText({ text }: { text: string }) {
  const blocks: React.ReactNode[] = [];
  let bullets: string[] = [];
  const flush = () => {
    if (bullets.length === 0) return;
    blocks.push(
      <ul key={`ul_${blocks.length}`}>
        {bullets.map((item, index) => (
          <li key={index}>{renderInline(item)}</li>
        ))}
      </ul>,
    );
    bullets = [];
  };
  for (const line of text.split("\n")) {
    const trimmed = line.trim();
    if (trimmed.startsWith("- ") || trimmed.startsWith("• ")) {
      bullets.push(trimmed.slice(2));
      continue;
    }
    flush();
    if (!trimmed) continue;
    blocks.push(<p key={`p_${blocks.length}`}>{renderInline(trimmed)}</p>);
  }
  flush();
  return <>{blocks}</>;
}

function activityLabel(t: Translator, activity: Activity): string {
  const key = TOOL_LABEL_KEYS[activity.name];
  const base = key ? t(key) : activity.name.replace(/_/g, " ");
  if (activity.status === "start") return `${base}…`;
  return activity.detail ?? base;
}

/** Reads an SSE body, invoking `onEvent` per complete event. */
async function readEventStream(
  response: Response,
  onEvent: (event: string, data: Record<string, unknown>) => void,
): Promise<void> {
  const reader = response.body?.getReader();
  if (!reader) throw new Error("empty_stream");
  const decoder = new TextDecoder();
  let buffer = "";
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const blocks = buffer.split("\n\n");
    buffer = blocks.pop() ?? "";
    for (const block of blocks) {
      let event = "message";
      let data = "";
      for (const line of block.split("\n")) {
        if (line.startsWith("event:")) event = line.slice(6).trim();
        else if (line.startsWith("data:")) data += line.slice(5).trim();
      }
      if (!data) continue;
      try {
        onEvent(event, JSON.parse(data) as Record<string, unknown>);
      } catch {
        // A malformed frame never kills the turn — the next one still renders.
      }
    }
  }
}

export function AiChat({ signedIn }: { signedIn: boolean }) {
  const router = useRouter();
  const t = useT();
  const [open, setOpen] = useState(false);
  const [entries, setEntries] = useState<ChatEntry[]>(() => [greeting(t, signedIn)]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const abortRef = useRef<AbortController | null>(null);
  const loadedRef = useRef(false);
  const logRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const patch = useCallback((id: string, next: (entry: ChatEntry) => ChatEntry) => {
    setEntries((prev) => prev.map((entry) => (entry.id === id ? next(entry) : entry)));
  }, []);

  // Restore the conversation (once) so a refresh doesn't drop the thread.
  useEffect(() => {
    try {
      const raw = window.sessionStorage.getItem(STORAGE_KEY);
      const saved: unknown = raw ? JSON.parse(raw) : null;
      if (Array.isArray(saved) && saved.length > 0) {
        setEntries(saved as ChatEntry[]);
      }
    } catch {
      // Private mode or quota — start fresh.
    }
    loadedRef.current = true;
  }, []);

  // The header switcher changes the locale in place — re-render the opening
  // greeting (only if it is still the untouched first message).
  useEffect(() => {
    setEntries((prev) =>
      prev.map((entry) =>
        entry.id === "greeting" && entry.role === "assistant"
          ? { ...entry, content: greeting(t, signedIn).content }
          : entry,
      ),
    );
  }, [t, signedIn]);

  useEffect(() => {
    if (!loadedRef.current) return;
    try {
      window.sessionStorage.setItem(STORAGE_KEY, JSON.stringify(entries.slice(-40)));
    } catch {
      // Ignore quota failures — the chat still works in memory.
    }
  }, [entries]);

  useEffect(() => {
    const el = logRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [entries, busy, open]);

  useEffect(() => () => abortRef.current?.abort(), []);

  const redeemSession = useCallback(
    async (token: string) => {
      try {
        const response = await fetch("/api/auth/session", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ token }),
        });
        if (response.ok) router.refresh();
      } catch {
        // The account exists either way; the header updates on next load.
      }
    },
    [router],
  );

  const send = useCallback(
    async (raw: string) => {
      const text = raw.trim();
      if (!text || busy) return;

      const history = entries
        .filter((entry) => entry.content.trim().length > 0)
        .map((entry) => ({ role: entry.role, content: entry.content }));
      const replyId = uid();
      setEntries((prev) => [
        ...prev,
        { id: uid(), role: "user", content: text },
        { id: replyId, role: "assistant", content: "", activity: [], notice: null },
      ]);
      setInput("");
      setBusy(true);

      const controller = new AbortController();
      abortRef.current = controller;
      let sawDone = false;

      try {
        const response = await fetch("/api/public/chat", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ messages: [...history, { role: "user", content: text }] }),
          signal: controller.signal,
        });

        if (!response.ok || !response.body) {
          throw new Error(
            response.status === 503
              ? t("chat.error.offline")
              : response.status === 429
                ? t("chat.error.rateLimited")
                : t("chat.error.unreachable"),
          );
        }

        await readEventStream(response, (event, data) => {
          if (event === "text" && typeof data.text === "string") {
            patch(replyId, (entry) => ({ ...entry, content: entry.content + data.text }));
          } else if (event === "tool") {
            const activity: Activity = {
              name: String(data.name ?? "tool"),
              status: (data.status as Activity["status"]) ?? "start",
              detail: typeof data.detail === "string" ? data.detail : undefined,
            };
            patch(replyId, (entry) => {
              const list = entry.activity ?? [];
              if (activity.status === "start") return { ...entry, activity: [...list, activity] };
              const index = list.findIndex(
                (item) => item.name === activity.name && item.status === "start",
              );
              if (index === -1) return { ...entry, activity: [...list, activity] };
              const next = [...list];
              next[index] = activity;
              return { ...entry, activity: next };
            });
          } else if (event === "auth" && typeof data.token === "string") {
            void redeemSession(data.token);
          } else if (event === "error") {
            patch(replyId, (entry) => ({
              ...entry,
              notice:
                typeof data.message === "string" ? data.message : t("chat.error.generic"),
            }));
          } else if (event === "done") {
            sawDone = true;
          }
        });

        if (!sawDone) {
          patch(replyId, (entry) =>
            entry.content ? entry : { ...entry, notice: t("chat.error.cutOff") },
          );
        }
      } catch (error) {
        const aborted = (error as Error)?.name === "AbortError";
        patch(replyId, (entry) => ({
          ...entry,
          notice: aborted
            ? entry.content
              ? null
              : t("chat.error.stopped")
            : (error as Error)?.message || t("chat.error.connection"),
        }));
      } finally {
        abortRef.current = null;
        setBusy(false);
      }
    },
    [busy, entries, patch, redeemSession, t],
  );

  const stop = useCallback(() => {
    abortRef.current?.abort();
  }, []);

  const userTurns = entries.filter((entry) => entry.role === "user").length;
  const last = entries[entries.length - 1];
  const showTyping = busy && last?.role === "assistant" && !last.content;
  const showChips = !busy && userTurns <= 1;

  return (
    <>
      {open && (
        <section
          className="santo-chat-panel"
          role="dialog"
          aria-label={t("chat.panelAria")}
          aria-modal="false"
        >
          <header className="santo-chat-head">
            <span className="chat-avatar" aria-hidden="true">
              <Sparkles size={15} />
            </span>
            <div>
              <div className="santo-chat-title">{t("chat.title")}</div>
              <div className="santo-chat-status">
                <span className="status-dot" aria-hidden="true" />
                {t("chat.status")}
              </div>
            </div>
            <button
              type="button"
              className="santo-chat-close"
              onClick={() => setOpen(false)}
              aria-label={t("chat.closeAria")}
            >
              <X size={16} />
            </button>
          </header>

          <div
            className="santo-chat-log"
            ref={logRef}
            role="log"
            aria-live="polite"
            aria-relevant="additions text"
          >
            {entries.map((entry) => (
              <Fragment key={entry.id}>
                {entry.activity && entry.activity.length > 0 && (
                  <div className="santo-chat-activity">
                    {entry.activity.map((activity, index) => (
                      <span key={`${entry.id}_${index}`}>
                        <i
                          className={`activity-dot${
                            activity.status === "success"
                              ? " done"
                              : activity.status === "error"
                                ? " failed"
                                : ""
                          }`}
                          aria-hidden="true"
                        />
                        {activityLabel(t, activity)}
                      </span>
                    ))}
                  </div>
                )}
                {entry.content &&
                  (entry.role === "user" ? (
                    <div className="santo-chat-msg santo-chat-user">{entry.content}</div>
                  ) : (
                    <div className="santo-chat-msg santo-chat-bot">
                      <RichText text={entry.content} />
                    </div>
                  ))}
                {entry.notice && <div className="santo-chat-notice">{entry.notice}</div>}
              </Fragment>
            ))}
            {showTyping && (
              <div className="santo-chat-typing" aria-label={t("chat.typingAria")}>
                <i />
                <i />
                <i />
              </div>
            )}
          </div>

          {showChips && (
            <div className="santo-chat-chips">
              {QUICK_PROMPT_KEYS.map((key) => (
                <button
                  key={key}
                  type="button"
                  className="santo-chat-chip"
                  onClick={() => void send(t(key))}
                >
                  {t(key)}
                </button>
              ))}
            </div>
          )}

          <form
            className="santo-chat-form"
            onSubmit={(event) => {
              event.preventDefault();
              void send(input);
            }}
          >
            <textarea
              ref={inputRef}
              className="santo-chat-input"
              rows={1}
              value={input}
              placeholder={t("chat.placeholder")}
              aria-label={t("chat.inputAria")}
              disabled={busy}
              onChange={(event) => {
                setInput(event.target.value);
                const el = event.target;
                el.style.height = "38px";
                el.style.height = `${Math.min(el.scrollHeight, 104)}px`;
              }}
              onKeyDown={(event) => {
                if (event.key === "Enter" && !event.shiftKey) {
                  event.preventDefault();
                  void send(input);
                }
              }}
            />
            {busy ? (
              <button type="button" className="santo-chat-stop" onClick={stop}>
                {t("chat.stop")}
              </button>
            ) : (
              <button
                type="submit"
                className="santo-chat-send"
                disabled={!input.trim()}
                aria-label={t("chat.sendAria")}
              >
                <Send size={15} />
              </button>
            )}
          </form>
          <div className="santo-chat-foot">{t("chat.footer")}</div>
        </section>
      )}

      <button
        type="button"
        className="santo-chat-fab"
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
        aria-label={open ? t("chat.fabCloseAria") : t("chat.fabOpenAria")}
      >
        {open ? <X size={17} /> : <MessageCircle size={17} />}
        <span>{open ? t("chat.fabClose") : t("chat.fabOpen")}</span>
        {!open && <span className="fab-dot" aria-hidden="true" />}
      </button>
    </>
  );
}
