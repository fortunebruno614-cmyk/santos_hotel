"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/utils/supabase/client";
import {
  notificationsSupported,
  registerForNotifications,
  unregisterFromNotifications,
  subscribeToForegroundMessages,
} from "@/lib/firebase/notifications";
import { registerDeviceToken } from "@/app/actions";

export default function NotificationProvider({ children }: { children: React.ReactNode }) {
  const [status, setStatus] = useState<
    "idle" | "registering" | "registered" | "denied" | "unsupported" | "error"
  >("idle");
  const [toast, setToast] = useState<{ title: string; body: string; url: string } | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [mounted, setMounted] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [syncWarning, setSyncWarning] = useState<string | null>(null);
  const router = useRouter();
  const supabase = useRef(createClient());

  useEffect(() => {
    setMounted(true);
    const s = supabase.current;

    s.auth.getUser().then(({ data }) => {
      if (data.user) setUserId(data.user.id);
    }).catch(() => {});

    const { data: listener } = s.auth.onAuthStateChange((_e, session) => {
      setUserId(session?.user.id ?? null);
      if (!session) setStatus("idle");
    });

    let unsubFg: (() => void) | undefined;

    notificationsSupported().then((ok) => {
      if (!ok) {
        setStatus("unsupported");
        return;
      }
      if (Notification.permission === "denied") {
        setStatus("denied");
        return;
      }
      unsubFg = subscribeToForegroundMessages((payload) => {
        const title = payload.notification?.title || payload.data?.title || "Santos Hotel";
        const body = payload.notification?.body || payload.data?.body || "";
        const url = payload.data?.url || "/dashboard";
        setToast({ title, body, url });
        setTimeout(() => setToast(null), 8000);
      });
    });

    return () => {
      listener.subscription.unsubscribe();
      unsubFg?.();
    };
  }, []);

  const enable = useCallback(async () => {
    if (status === "registering") return;
    setStatus("registering");
    setErrorMsg(null);
    setSyncWarning(null);
    try {
      const result = await registerForNotifications();

      if (result.status === "registered" && result.fid) {
        setStatus("registered");
        // Token persistence is best-effort: notifications are already enabled
        // on this device even if the server-side save fails.
        try {
          const r = await registerDeviceToken(result.fid, navigator.userAgent.slice(0, 200));
          if (!r.ok) {
            setSyncWarning(r.error || "Device token could not be saved to the server.");
          }
        } catch (e) {
          setSyncWarning(e instanceof Error ? e.message : "Device token could not be saved.");
        }
        return;
      }

      if (result.status === "permission-denied") {
        setStatus("denied");
        return;
      }

      setStatus("error");
      setErrorMsg(
        result.error ||
          (result.status === "unsupported"
            ? "Notifications are not supported in this browser."
            : "Failed to enable notifications.")
      );
    } catch (e) {
      setStatus("error");
      setErrorMsg(e instanceof Error ? e.message : "Failed to enable notifications.");
    }
  }, [status]);

  const disable = useCallback(async () => {
    try {
      await unregisterFromNotifications();
      setStatus("idle");
      setErrorMsg(null);
      setSyncWarning(null);
    } catch {
      setStatus("idle");
    }
  }, []);

  useEffect(() => {
    if (mounted && userId && Notification.permission === "granted" && status === "idle") {
      enable();
    }
  }, [mounted, userId, status, enable]);

  if (!mounted) return <>{children}</>;

  return (
    <>
      {children}

      {status === "denied" && (
        <div className="notifBanner notifBannerWarn">
          Notifications are blocked. Enable them in your browser site settings.
        </div>
      )}

      {status === "error" && (
        <div className="notifBanner notifBannerError">
          {errorMsg || "Failed to enable notifications."}
          <button
            onClick={() => {
              setErrorMsg(null);
              setStatus("idle");
            }}
          >
            Retry
          </button>
        </div>
      )}

      {syncWarning && status === "registered" && (
        <div className="notifBanner notifBannerWarn">
          Notifications are on, but the device token could not be synced: {syncWarning}
          <button onClick={() => setSyncWarning(null)}>Dismiss</button>
        </div>
      )}

      {toast && (
        <div className="notifToast" onClick={() => { router.push(toast.url); setToast(null); }}>
          <strong>{toast.title}</strong>
          <span>{toast.body}</span>
        </div>
      )}

      <button
        className="notifBell"
        onClick={status === "registered" ? disable : enable}
        disabled={status === "registering" || status === "unsupported"}
        aria-label="Toggle notifications"
        title={
          status === "registered"
            ? "Disable notifications"
            : status === "denied"
            ? "Notifications blocked in browser"
            : status === "unsupported"
            ? "Notifications not supported"
            : "Enable notifications"
        }
      >
        {status === "registering" ? "⏳" : status === "registered" ? "🔔" : "🔕"}
      </button>
    </>
  );
}