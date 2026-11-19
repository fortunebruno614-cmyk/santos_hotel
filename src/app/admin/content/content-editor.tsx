"use client";

import { useState } from "react";
import {
  Badge,
  Card,
  CardBody,
  CardHeader,
  Field,
  InlineError,
} from "@/components/admin/ui";
import { Button } from "@/components/ui/button";

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
    <div className="space-y-5">
      <InlineError>{error}</InlineError>
      <div className="grid gap-4 xl:grid-cols-2">
        {slots.map((slot) => {
          const draft = drafts[slot.key];
          const dirty = draft.title !== slot.title || draft.body !== slot.body;
          return (
            <Card key={slot.key} className="flex flex-col">
              <CardHeader
                title={draft.title || "(no title)"}
                description={<span className="admin-mono">{slot.key}</span>}
                actions={
                  <div className="flex flex-wrap items-center gap-1.5">
                    {dirty && <Badge tone="warning">Unsaved</Badge>}
                    {savedKey === slot.key && <Badge tone="success">Saved</Badge>}
                  </div>
                }
              />
              <CardBody className="flex flex-1 flex-col gap-3">
                <Field label="Title">
                  <input
                    placeholder="Title"
                    value={draft.title}
                    onChange={(e) =>
                      setDrafts({ ...drafts, [slot.key]: { ...draft, title: e.target.value } })
                    }
                  />
                </Field>
                <Field label="Body">
                  <textarea
                    rows={4}
                    placeholder="Body"
                    value={draft.body}
                    onChange={(e) =>
                      setDrafts({ ...drafts, [slot.key]: { ...draft, body: e.target.value } })
                    }
                  />
                </Field>
                <div className="mt-auto flex flex-wrap items-center justify-between gap-2 pt-1">
                  <p className="text-xs text-muted-foreground">
                    {slot.updatedAt
                      ? `Last edited ${slot.updatedAt.slice(0, 16).replace("T", " ")} · shown on the next page load.`
                      : "Shown on the public site on the next page load."}
                  </p>
                  <div className="flex gap-2">
                    <Button
                      type="button"
                      onClick={() => post(slot.key, draft)}
                      disabled={busy || !dirty}
                      size="sm"
                    >
                      {busy ? "Saving…" : "Save"}
                    </Button>
                    <Button
                      type="button"
                      onClick={() => reset(slot.key)}
                      disabled={busy}
                      variant="outline"
                      size="sm"
                      className="text-red-700 hover:bg-red-50 hover:text-red-800"
                    >
                      Reset to default
                    </Button>
                  </div>
                </div>
              </CardBody>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
