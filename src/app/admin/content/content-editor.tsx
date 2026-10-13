"use client";

import { useState } from "react";

/**
 * Website content editor (P7, admin only).
 *
 *   POST   /api/admin/content          — upsert a slot by key
 *   DELETE /api/admin/content/{key}    — reset a slot to its built-in default
 *
 * Every save/reset is audited with old → new values.
 */

export type ContentSlot = {
  key: string;
  title: string;
  body: string;
  updatedAt: string | null;
};

export function ContentEditor({ slots }: { slots: ContentSlot[] }) {
  const [drafts, setDrafts] = useState<Record<string, { title: string; body: string }>>(
    Object.fromEntries(slots.map((slot) => [slot.key, { title: slot.title, body: slot.body }])),
  );
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [savedKey, setSavedKey] = useState<string | null>(null);

  const post = async (key: string, payload: { title: string; body: string }) => {
    setBusy(true);
    setError(null);
    setSavedKey(null);
    try {
      const response = await fetch("/api/admin/content", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ key, ...payload }),
      });
      if (!response.ok) {
        const body = (await response.json().catch(() => ({}))) as { error?: string };
        setError(body.error ?? "Could not save this slot.");
        return;
      }
      setSavedKey(key);
    } catch {
      setError("Could not save this slot.");
    } finally {
      setBusy(false);
    }
  };

  const reset = async (key: string) => {
    if (!window.confirm(`Reset "${key}" to its built-in default text?`)) return;
    setBusy(true);
    setError(null);
    setSavedKey(null);
    try {
      const response = await fetch(`/api/admin/content/${encodeURIComponent(key)}`, {
        method: "DELETE",
      });
      if (!response.ok) {
        const body = (await response.json().catch(() => ({}))) as { error?: string };
        setError(body.error ?? "Could not reset this slot.");
        return;
      }
      window.location.reload();
    } catch {
      setError("Could not reset this slot.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-4">
      {error && <p className="text-sm text-red-600">{error}</p>}
      {slots.map((slot) => {
        const draft = drafts[slot.key];
        const dirty = draft.title !== slot.title || draft.body !== slot.body;
        return (
          <div key={slot.key} className="border rounded-md p-4 space-y-3 text-sm">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <p className="font-mono text-xs text-zinc-500">{slot.key}</p>
                <p className="font-medium">
                  {draft.title || "(no title)"}
                  {dirty && <span className="ml-2 text-xs text-amber-600">unsaved</span>}
                  {savedKey === slot.key && <span className="ml-2 text-xs text-green-700">saved</span>}
                </p>
              </div>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => post(slot.key, draft)}
                  disabled={busy || !dirty}
                  className="border px-3 py-1 rounded-md disabled:opacity-50"
                >
                  {busy && savedKey === null ? "Saving…" : "Save"}
                </button>
                <button
                  type="button"
                  onClick={() => reset(slot.key)}
                  disabled={busy}
                  className="border px-3 py-1 rounded-md text-red-600 disabled:opacity-50"
                >
                  Reset to default
                </button>
              </div>
            </div>
            <div className="flex flex-col gap-2">
              <input
                className="border px-2 py-1 rounded-md w-full"
                placeholder="Title"
                value={draft.title}
                onChange={(e) => setDrafts({ ...drafts, [slot.key]: { ...draft, title: e.target.value } })}
              />
              <textarea
                className="border px-2 py-1 rounded-md w-full text-sm"
                rows={3}
                placeholder="Body"
                value={draft.body}
                onChange={(e) => setDrafts({ ...drafts, [slot.key]: { ...draft, body: e.target.value } })}
              />
            </div>
            <p className="text-xs text-zinc-500">
              {slot.updatedAt
                ? `Last edited ${slot.updatedAt.slice(0, 16).replace("T", " ")} · `
                : ""}
              Shown on the public site on the next page load.
            </p>
          </div>
        );
      })}
    </div>
  );
}
