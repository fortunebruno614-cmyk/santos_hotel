import { NextResponse } from "next/server";

export const runtime = "nodejs";

/**
 * Serves the Firebase Cloud Messaging service worker.
 *
 * The FCM web SDK looks for `/firebase-messaging-sw.js` at the root scope by
 * default. We generate it from environment variables so no Firebase values are
 * hardcoded, and we set caching headers so the browser keeps it fresh enough
 * for updates while still being service-worker friendly.
 */
export async function GET() {
  const apiKey = process.env.NEXT_PUBLIC_FIREBASE_API_KEY ?? "";
  const messagingSenderId = process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID ?? "";
  const projectId = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID ?? "";
  const appId = process.env.NEXT_PUBLIC_FIREBASE_APP_ID ?? "";
  const authDomain = process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN ?? "";
  const storageBucket = process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET ?? "";

  const sw = `
'use strict';
// Santos Hotel - Firebase Cloud Messaging service worker (generated from env)
importScripts('https://www.gstatic.com/firebasejs/12.19.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/12.19.0/firebase-messaging-compat.js');

const firebaseConfig = {
  apiKey: ${JSON.stringify(apiKey)},
  authDomain: ${JSON.stringify(authDomain)},
  projectId: ${JSON.stringify(projectId)},
  storageBucket: ${JSON.stringify(storageBucket)},
  messagingSenderId: ${JSON.stringify(messagingSenderId)},
  appId: ${JSON.stringify(appId)},
};

firebase.initializeApp(firebaseConfig);

const messaging = firebase.messaging();

messaging.onBackgroundMessage((payload) => {
  const title = payload.notification?.title || 'Santos Hotel';
  const options = {
    body: payload.notification?.body || '',
    icon: payload.notification?.icon || '/favicon.ico',
    badge: '/favicon.ico',
    data: {
      url: payload.data?.url || '/dashboard',
    },
  };
  self.registration.showNotification(title, options);
});

// Route the user to the right page when a notification is clicked.
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const targetUrl = event.notification.data?.url || '/dashboard';
  event.waitUntil(
    (async () => {
      const url = new URL(targetUrl, self.location.origin);
      const allClients = await clients.matchAll({ type: 'window', includeUncontrolled: true });
      for (const client of allClients) {
        if (client.url === url.href && 'focus' in client) {
          return client.focus();
        }
      }
      return clients.openWindow(url.href);
    })()
  );
});
`;

  return new NextResponse(sw.trim() + "\n", {
    headers: {
      "Content-Type": "application/javascript; charset=utf-8",
      "Service-Worker-Allowed": "/",
      "Cache-Control": "no-cache, no-store, must-revalidate",
      "X-Content-Type-Options": "nosniff",
    },
  });
}