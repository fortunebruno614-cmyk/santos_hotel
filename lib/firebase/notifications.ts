import { getMessaging, isSupported, onMessage, register, onRegistered, onUnregistered, unregister, type Messaging, type MessagePayload } from "firebase/messaging";
import { getFirebaseApp } from "./client";

export type NotificationStatus =
  | "unsupported"
  | "not-configured"
  | "permission-denied"
  | "idle"
  | "registering"
  | "registered"
  | "error";

export interface FcmRegistration {
  status: NotificationStatus;
  error?: string;
}

let messagingInstance: Messaging | null = null;
let isSupportedPromise: Promise<boolean> | null = null;

function siteName(): string {
  return "Santos Hotel";
}

/**
 * True when the browser supports web push / FCM and Firebase is configured.
 */
export async function notificationsSupported(): Promise<boolean> {
  if (typeof window === "undefined") return false;
  if (!isSupportedPromise) {
    isSupportedPromise = isSupported();
  }
  const supported = await isSupportedPromise;
  return supported;
}

function getMessagingInstance(): Messaging | null {
  const app = getFirebaseApp();
  if (!app) return null;
  if (!messagingInstance) {
    messagingInstance = getMessaging(app);
  }
  return messagingInstance;
}

export function getVapidKey(): string | undefined {
  const vapid = process.env.NEXT_PUBLIC_FIREBASE_VAPID_KEY;
  if (!vapid || vapid === "YOUR_VAPID_KEY_HERE") return undefined;
  return vapid;
}

/**
 * Subscribes to foreground messages (when the app tab is open).
 * The callback receives the message payload; return the URL to navigate to
 * (or null to not navigate).
 */
export function subscribeToForegroundMessages(
  callback: (payload: MessagePayload) => void
): () => void {
  const messaging = getMessagingInstance();
  if (!messaging) return () => {};
  if (typeof window === "undefined") return () => {};
  return onMessage(messaging, callback);
}

/**
 * Registers this device for FCM push notifications:
 * 1. Requests permission (browser prompt if not granted yet)
 * 2. Registers the Firebase app instance and obtains the FID registering token
 * 3. Returns the registration token (FID) to be stored server-side
 */
export async function registerForNotifications(): Promise<FcmRegistration & { fid?: string }> {
  if (typeof window === "undefined") {
    return { status: "unsupported", error: "Server-side context." };
  }

  const supported = await notificationsSupported();
  if (!supported) {
    return { status: "unsupported", error: "This browser does not support notifications." };
  }

  const messaging = getMessagingInstance();
  if (!messaging) {
    return { status: "not-configured", error: "Firebase is not configured on the client." };
  }

  const permission = Notification.permission;
  if (permission === "denied") {
    return {
      status: "permission-denied",
      error: "Notifications are blocked in your browser settings.",
    };
  }

  return new Promise((resolve) => {
    let settled = false;

    const finish = (reg: FcmRegistration & { fid?: string }) => {
      if (!settled) {
        settled = true;
        resolve(reg);
      }
    };

    onRegistered(messaging, async (fid) => {
      if (!fid) return;
      finish({ status: "registered", fid });
    });

    register(messaging, getVapidKey() ? { vapidKey: getVapidKey() } : undefined)
      .then(() => {
        // registration is initiated; fid arrives via onRegistered
        // safety timeout in case the callback never fires
        setTimeout(() => {
          finish({ status: "registering" });
        }, 10000);
      })
      .catch((err: { code?: string; message?: string }) => {
        if (err?.code === "messaging/permission-blocked" || err?.code === "messaging/permission-default") {
          finish({ status: "permission-denied", error: err.message });
        } else {
          finish({ status: "error", error: err?.message || "Failed to register for notifications." });
        }
      });
  });
}

/**
 * Unregisters this device from FCM push notifications.
 */
export async function unregisterFromNotifications(): Promise<void> {
  const messaging = getMessagingInstance();
  if (!messaging) return;
  if (typeof window === "undefined") return;
  try {
    await unregister(messaging);
  } catch {
    // best effort
  }
}

/**
 * Listens for FID unregistration events (fires from the SDK when the
 * device unregisters, used to clean up stale tokens server-side).
 */
export function subscribeToUnregistered(callback: (fid: string) => void): () => void {
  const messaging = getMessagingInstance();
  if (!messaging) return () => {};
  if (typeof window === "undefined") return () => {};
  return onUnregistered(messaging, (fid) => callback(fid));
}

export { siteName, onMessage, onRegistered, onUnregistered, register, unregister, getMessagingInstance };