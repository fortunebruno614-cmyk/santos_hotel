"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useT } from "@/components/hotel/locale-provider";
import type { Dictionary } from "@/lib/dictionaries";
import {
  beginSessionExchange,
  endSessionExchange,
  FIREBASE_SYNC_FAILURE_KEY,
  firebaseIdToken,
  signInWithGoogle,
  signOutOfFirebase,
} from "@/lib/firebase/client";

/** API error codes → translated copy. Unknown codes fall back to `generic`. */
const SERVER_ERROR_KEYS: Record<string, keyof Dictionary> = {
  invalid_token: "auth.google.error.invalid_token",
  email_missing: "auth.google.error.email_unverified",
  email_unverified: "auth.google.error.email_unverified",
  provider_not_allowed: "auth.google.error.provider_not_allowed",
  account_disabled: "auth.google.error.account_disabled",
  signup_disabled: "auth.google.error.signup_disabled",
  staff_account: "auth.google.error.staff_account",
  identity_conflict: "auth.google.error.identity_conflict",
  rate_limited: "auth.google.error.rate_limited",
  server_error: "auth.google.error.generic",
};

/** Firebase SDK error codes → translated copy. */
const FIREBASE_ERROR_KEYS: Record<string, keyof Dictionary> = {
  "auth/popup-closed-by-user": "auth.google.error.popup_closed",
  "auth/cancelled-popup-request": "auth.google.error.popup_closed",
  "auth/popup-blocked": "auth.google.error.popup_blocked",
  "auth/unauthorized-domain": "auth.google.error.unauthorized_domain",
  "auth/network-request-failed": "auth.google.error.network",
  "auth/too-many-requests": "auth.google.error.rate_limited",
  "auth/operation-not-allowed": "auth.google.error.provider_not_allowed",
  "auth/account-exists-with-different-credential": "auth.google.error.identity_conflict",
  "auth/internal-error": "auth.google.error.generic",
};

function GoogleMark() {
  return (
    <svg viewBox="0 0 48 48" className="google-icon" aria-hidden="true" focusable="false">
      <path
        fill="#EA4335"
        d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"
      />
      <path
        fill="#4285F4"
        d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"
      />
      <path
        fill="#FBBC05"
        d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"
      />
      <path
        fill="#34A853"
        d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"
      />
    </svg>
  );
}

type ExchangeResponse = {
  ok?: boolean;
  redirectTo?: string;
  error?: string;
} | null;

export function GoogleSignInButton({
  next,
  mode = "login",
  className,
}: {
  next?: string | null;
  mode?: "login" | "signup";
  className?: string;
}) {
  const t = useT();
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [errorKey, setErrorKey] = useState<keyof Dictionary | null>(null);

  async function handleClick() {
    if (pending) return;
    setPending(true);
    setErrorKey(null);
    beginSessionExchange();

    try {
      const credential = await signInWithGoogle();
      const idToken = await firebaseIdToken(credential.user);

      const response = await fetch("/api/auth/firebase", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ idToken, next: next ?? undefined }),
        credentials: "same-origin",
      });
      const data = (await response.json().catch(() => null)) as ExchangeResponse;

      if (!response.ok || !data?.ok) {
        // Do not leave a Firebase-only session behind that would silently
        // retry on the next page load.
        await signOutOfFirebase();
        setErrorKey(SERVER_ERROR_KEYS[data?.error ?? ""] ?? "auth.google.error.generic");
        return;
      }

      sessionStorage.removeItem(FIREBASE_SYNC_FAILURE_KEY);
      router.replace(data.redirectTo ?? "/account");
      router.refresh();
    } catch (error) {
      const code =
        typeof error === "object" && error !== null && "code" in error
          ? String((error as { code?: unknown }).code)
          : "";
      setErrorKey(FIREBASE_ERROR_KEYS[code] ?? "auth.google.error.generic");
    } finally {
      endSessionExchange();
      setPending(false);
    }
  }

  return (
    <div className={`google-auth${className ? ` ${className}` : ""}`}>
      <Button
        type="button"
        variant="outline"
        className="google-button"
        onClick={handleClick}
        disabled={pending}
        aria-busy={pending}
      >
        {pending ? <Loader2 className="animate-spin" /> : <GoogleMark />}
        <span>
          {pending
            ? t("auth.google.signingIn")
            : mode === "signup"
              ? t("auth.google.signup")
              : t("auth.google.continue")}
        </span>
      </Button>
      {errorKey && (
        <p className="form-error" role="alert">
          {t(errorKey)}
        </p>
      )}
    </div>
  );
}
