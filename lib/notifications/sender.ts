import { getAdminMessaging, isAdminConfigured, missingAdminHint } from "../firebase/admin";

export interface PushPayload {
  title: string;
  body?: string;
  /** URL opened when the user clicks the notification. */
  url?: string;
  /** Optional image URL shown as the notification badge. */
  icon?: string;
  /** Arbitrary key/value data payload. */
  data?: Record<string, string>;
  /** FCM topic to subscribe/send to (uses `topic` target). */
  topic?: string;
}

export interface SendResult {
  success: boolean;
  messageIds: string[];
  failures: { index: number; error: string }[];
  error?: string;
  configured: boolean;
}

function buildMessage(payload: PushPayload): {
  notification?: { title: string; body?: string; image?: string };
  data?: Record<string, string>;
  webpush?: Record<string, unknown>;
  topic?: string;
} {
  const { title, body, url, icon, data = {}, topic } = payload;
  const message: ReturnType<typeof buildMessage> = {
    notification: {
      title,
      ...(body ? { body } : {}),
      ...(icon ? { image: icon } : {}),
    },
  };
  if (topic) {
    message.topic = topic;
  }
  message.data = {
    ...data,
    title,
    ...(body ? { body } : {}),
    ...(url ? { url } : {}),
    ...(icon ? { icon } : {}),
  };
  if (url) {
    message.webpush = {
      fcmOptions: { link: url },
      notification: { click_action: url },
    };
  }
  return message;
}

/**
 * Sends a push notification to a single device registered on this app.
 * Uses the Firebase Admin SDK; returns configured:false (never throws) when
 * the Admin credential is missing.
 */
export async function sendPushNotification(
  fid: string,
  payload: PushPayload
): Promise<SendResult> {
  if (!isAdminConfigured()) {
    return { success: false, messageIds: [], failures: [], configured: false, error: missingAdminHint() };
  }
  const messaging = await getAdminMessaging();
  if (!messaging) {
    return { success: false, messageIds: [], failures: [], configured: false, error: missingAdminHint() };
  }
  try {
    const { notification, data, webpush } = buildMessage(payload);
    const messageId = await messaging.send({
      fid,
      ...(notification ? { notification } : {}),
      ...(data ? { data } : {}),
      ...(webpush ? { webpush } : {}),
    } as Parameters<typeof messaging.send>[0]);
    return { success: true, messageIds: [messageId], failures: [], configured: true };
  } catch (err) {
    return { success: false, messageIds: [], failures: [], configured: true, error: (err as Error).message };
  }
}

/**
 * Sends a push notification to multiple devices (FIDs).
 */
export async function sendPushNotifications(
  fids: string[],
  payload: PushPayload
): Promise<SendResult> {
  if (!isAdminConfigured()) {
    return { success: false, messageIds: [], failures: [], configured: false, error: missingAdminHint() };
  }
  const messaging = await getAdminMessaging();
  if (!messaging) {
    return { success: false, messageIds: [], failures: [], configured: false, error: missingAdminHint() };
  }
  if (fids.length === 0) {
    return { success: true, messageIds: [], failures: [], configured: true };
  }

  try {
    const base = buildMessage(payload);
    const { notification, data, webpush } = base;
    const messages = fids.map((fid) => ({
      fid,
      ...(notification ? { notification } : {}),
      ...(data ? { data } : {}),
      ...(webpush ? { webpush } : {}),
    })) as Parameters<typeof messaging.sendEach>[0];
    const response = await messaging.sendEach(messages);
    const failures: { index: number; error: string }[] = [];
    response.responses.forEach((resp: { success: boolean; error?: { message: string } }, index: number) => {
      if (!resp.success) {
        failures.push({ index, error: resp.error?.message || "Unknown error" });
      }
    });
    return { success: failures.length === 0, messageIds: [], failures, configured: true };
  } catch (err) {
    return { success: false, messageIds: [], failures: [], configured: true, error: (err as Error).message };
  }
}

/**
 * Sends a push notification to a topic. Devices subscribed to the topic
 * receive the notification.
 */
export async function sendPushToTopic(payload: PushPayload): Promise<SendResult> {
  if (!isAdminConfigured()) {
    return { success: false, messageIds: [], failures: [], configured: false, error: missingAdminHint() };
  }
  const messaging = await getAdminMessaging();
  if (!messaging) {
    return { success: false, messageIds: [], failures: [], configured: false, error: missingAdminHint() };
  }
  try {
    const { topic } = payload;
    if (!topic) {
      return { success: false, messageIds: [], failures: [], configured: true, error: "Topic is required." };
    }
    const msg = { ...buildMessage(payload), topic };
    const messageId = await messaging.send(msg as Parameters<typeof messaging.send>[0]);
    return { success: true, messageIds: [messageId], failures: [], configured: true };
  } catch (err) {
    return { success: false, messageIds: [], failures: [], configured: true, error: (err as Error).message };
  }
}

/**
 * Subscribes a set of device FIDs to a topic.
 */
export async function subscribeFidsToTopic(fids: string[], topic: string) {
  if (!isAdminConfigured()) return { configured: false };
  const messaging = await getAdminMessaging();
  if (!messaging) return { configured: false };
  return messaging.subscribeToTopic(fids, topic);
}

/**
 * Unsubscribes a set of device FIDs from a topic.
 */
export async function unsubscribeFidsFromTopic(fids: string[], topic: string) {
  if (!isAdminConfigured()) return { configured: false };
  const messaging = await getAdminMessaging();
  if (!messaging) return { configured: false };
  return messaging.unsubscribeFromTopic(fids, topic);
}