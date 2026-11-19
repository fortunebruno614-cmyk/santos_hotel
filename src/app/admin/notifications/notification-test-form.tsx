"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Card, CardBody, CardHeader, Field } from "@/components/admin/ui";
import { Button } from "@/components/ui/button";

const ERROR_MESSAGES: Record<string, string> = {
  invalid_body: "Enter a valid email address.",
  recipient_required: "Enter a recipient email address.",
  email_not_configured: "Email is not configured. Set RESEND_API_KEY on the server.",
  email_failed: "Resend did not accept the message. Check RESEND_FROM_EMAIL and the server log.",
};

export function NotificationTestForm({ defaultEmail }: { defaultEmail: string | null }) {
  const router = useRouter();
  const [to, setTo] = useState(defaultEmail ?? "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    setSuccess(null);

    try {
      const response = await fetch("/api/admin/notifications/test", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ to }),
      });
      const data = (await response.json().catch(() => ({}))) as {
        error?: string;
        message?: string;
      };
      if (!response.ok) {
        setError(ERROR_MESSAGES[data.error ?? ""] ?? ERROR_MESSAGES.email_failed);
        return;
      }
      setSuccess(data.message ?? "Test email accepted.");
      router.refresh();
    } catch {
      setError("Could not reach the notification endpoint.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card>
      <CardHeader
        title="Send a test email"
        description="Uses the same Resend transport and Santo Hotel template as booking notifications."
      />
      <CardBody>
        <form onSubmit={submit} className="space-y-4">
          <Field label="Recipient" className="max-w-md">
            <input
              type="email"
              required
              value={to}
              onChange={(event) => setTo(event.target.value)}
              placeholder="admin@your-domain.com"
            />
          </Field>
          <div className="flex flex-wrap items-center gap-3">
            <Button type="submit" disabled={busy} size="sm">
              {busy ? "Sending…" : "Send test email"}
            </Button>
            {success && <p className="text-sm text-emerald-700">{success}</p>}
            {error && <p className="text-sm text-red-700">{error}</p>}
          </div>
        </form>
      </CardBody>
    </Card>
  );
}
