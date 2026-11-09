import { Resend } from "resend";
import { emailTimeoutMs, resendApiKey } from "@/config/email";

/**
 * The only place the Resend SDK is constructed. A small transport interface
 * lets tests exercise the notification service without sending real mail.
 */

export type EmailMessage = {
  from: string;
  to: string[];
  subject: string;
  html: string;
  text: string;
  replyTo?: string | string[] | null;
  tags?: Array<{ name: string; value: string }>;
};

export type EmailSendResult = { id: string | null };

export interface EmailTransport {
  send(message: EmailMessage): Promise<EmailSendResult>;
}

export class EmailNotConfiguredError extends Error {
  constructor() {
    super("RESEND_API_KEY is not configured");
    this.name = "EmailNotConfiguredError";
  }
}

let testTransport: EmailTransport | null = null;
let resendClient: Resend | null = null;
let resendClientKey: string | null = null;

/** Test seam — pass null to restore the real Resend transport. */
export function setEmailTransportForTests(transport: EmailTransport | null) {
  testTransport = transport;
}

export function hasEmailTransport(): boolean {
  return testTransport !== null || Boolean(resendApiKey());
}

async function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      promise,
      new Promise<never>((_, reject) => {
        timer = setTimeout(() => reject(new Error("email_timeout")), ms);
      }),
    ]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

function getResendClient(): Resend {
  const key = resendApiKey();
  if (!key) throw new EmailNotConfiguredError();
  if (!resendClient || resendClientKey !== key) {
    resendClient = new Resend(key);
    resendClientKey = key;
  }
  return resendClient;
}

const resendTransport: EmailTransport = {
  async send(message) {
    const client = getResendClient();
    const response = await withTimeout(
      client.emails.send({
        from: message.from,
        to: message.to,
        subject: message.subject,
        html: message.html,
        text: message.text,
        ...(message.replyTo ? { replyTo: message.replyTo } : {}),
        ...(message.tags ? { tags: message.tags } : {}),
      }),
      emailTimeoutMs(),
    );

    if (response.error) {
      throw new Error(response.error.message || "resend_rejected");
    }
    return { id: response.data?.id ?? null };
  },
};

export function getEmailTransport(): EmailTransport {
  return testTransport ?? resendTransport;
}

export function emailProviderName(): string {
  return testTransport ? "test" : "resend";
}
