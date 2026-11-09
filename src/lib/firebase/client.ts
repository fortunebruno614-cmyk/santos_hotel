"use client";

import { getApp, getApps, initializeApp, type FirebaseApp } from "firebase/app";
import { getAnalytics, isSupported, type Analytics } from "firebase/analytics";
import {
  browserLocalPersistence,
  getAuth,
  GoogleAuthProvider,
  setPersistence,
  signInWithPopup,
  signOut,
  type Auth,
  type User,
  type UserCredential,
} from "firebase/auth";
import { firebaseConfig } from "@/lib/firebase/config";

/** Set when a silent session restore was rejected (prevents per-page retry loops). */
export const FIREBASE_SYNC_FAILURE_KEY = "santo.firebase.sync.failed";

let app: FirebaseApp | null = null;
let auth: Auth | null = null;
let analyticsPromise: Promise<Analytics | null> | null = null;

/** Is a Google session exchange currently talking to our own API? */
let sessionExchangeInFlight = false;

export function getFirebaseApp(): FirebaseApp {
  if (app) return app;
  app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);
  return app;
}

export function getFirebaseAuth(): Auth {
  if (auth) return auth;
  auth = getAuth(getFirebaseApp());
  return auth;
}

/**
 * Local persistence keeps the Firebase user across browser restarts. The
 * authoritative app session is still the httpOnly `session` cookie; this only
 * lets us silently re-establish it when the cookie has expired.
 */
export async function ensureAuthPersistence() {
  await setPersistence(getFirebaseAuth(), browserLocalPersistence);
}

export async function signInWithGoogle(): Promise<UserCredential> {
  await ensureAuthPersistence();
  const provider = new GoogleAuthProvider();
  provider.setCustomParameters({ prompt: "select_account" });
  return signInWithPopup(getFirebaseAuth(), provider);
}

export async function signOutOfFirebase() {
  // Never let a Firebase sign-out failure block clearing the server session.
  try {
    await signOut(getFirebaseAuth());
  } catch {
    // The server cookie is cleared by the caller regardless.
  }
}

export async function firebaseIdToken(user: User, forceRefresh = false) {
  return user.getIdToken(forceRefresh);
}

export function hasGoogleProvider(user: User) {
  return user.providerData.some((provider) => provider.providerId === "google.com");
}

export function beginSessionExchange() {
  sessionExchangeInFlight = true;
}

export function endSessionExchange() {
  sessionExchangeInFlight = false;
}

export function isSessionExchangeInFlight() {
  return sessionExchangeInFlight;
}

/** Analytics is optional and unsupported in some browsers/SSR contexts. */
export function initFirebaseAnalytics() {
  if (typeof window === "undefined" || !firebaseConfig.measurementId) return;
  analyticsPromise ??= isSupported()
    .then((supported) => (supported ? getAnalytics(getFirebaseApp()) : null))
    .catch(() => null);
  void analyticsPromise;
}
