"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { onAuthStateChanged } from "firebase/auth";
import {
  beginSessionExchange,
  endSessionExchange,
  FIREBASE_SYNC_FAILURE_KEY,
  firebaseIdToken,
  getFirebaseAuth,
  hasGoogleProvider,
  initFirebaseAnalytics,
  isSessionExchangeInFlight,
  signOutOfFirebase,
} from "@/lib/firebase/client";

/**
 * Restores the server session after a browser restart when the 7-day cookie
 * has expired but Firebase's local persistence still has the Google user.
 *
 * This never *creates* a session for a freshly-signed-out visitor: sign-out
 * clears Firebase first (see SignOutButton), and a rejected exchange is
 * remembered for the tab so it cannot loop.
 */
export function FirebaseSessionSync({ signedIn }: { signedIn: boolean }) {
  const router = useRouter();

  useEffect(() => {
    initFirebaseAnalytics();

    if (signedIn) {
      sessionStorage.removeItem(FIREBASE_SYNC_FAILURE_KEY);
      return;
    }
    if (sessionStorage.getItem(FIREBASE_SYNC_FAILURE_KEY) === "1") return;

    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | undefined;

    const unsubscribe = onAuthStateChanged(getFirebaseAuth(), (user) => {
      if (cancelled || !user || !hasGoogleProvider(user)) return;
      if (isSessionExchangeInFlight()) return;

      // Give an explicit Google-button flow time to win the race on /login.
      if (timer) clearTimeout(timer);
      timer = setTimeout(async () => {
        if (cancelled || isSessionExchangeInFlight()) return;
        beginSessionExchange();
        try {
          const idToken = await firebaseIdToken(user);
          const response = await fetch("/api/auth/firebase", {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ idToken }),
            credentials: "same-origin",
          });
          if (response.ok && !cancelled) {
            sessionStorage.removeItem(FIREBASE_SYNC_FAILURE_KEY);
            router.refresh();
          } else {
            sessionStorage.setItem(FIREBASE_SYNC_FAILURE_KEY, "1");
            await signOutOfFirebase();
          }
        } catch {
          sessionStorage.setItem(FIREBASE_SYNC_FAILURE_KEY, "1");
        } finally {
          endSessionExchange();
        }
      }, 1_200);
    });

    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
      unsubscribe();
    };
  }, [signedIn, router]);

  return null;
}
