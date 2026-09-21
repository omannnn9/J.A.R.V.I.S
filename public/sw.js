// Intentionally minimal: this app is fundamentally online-only (Gemini
// Live over WebSocket, Supabase for everything else), so there's no real
// offline experience worth building. This file exists because Chrome's
// PWA installability check requires a registered service worker with a
// fetch handler — it just passes every request straight through to the
// network rather than caching anything that could go stale across
// deploys (Next.js's own hashed asset filenames already handle caching).
self.addEventListener("install", () => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener("fetch", (event) => {
  event.respondWith(fetch(event.request));
});

// The one piece of real offline-adjacent behavior this service worker
// provides: showing a system notification for a push the browser delivered
// while the tab wasn't open or wasn't foregrounded — the whole point of
// wiring up push in the first place.
self.addEventListener("push", (event) => {
  let payload = { title: "JARVIS reminder", body: "" };
  try {
    if (event.data) payload = { ...payload, ...event.data.json() };
  } catch {
    if (event.data) payload.body = event.data.text();
  }
  event.waitUntil(
    self.registration.showNotification(payload.title, {
      body: payload.body,
      icon: "/icons/icon-192.png",
      badge: "/icons/icon-192.png",
    })
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((clients) => {
      for (const client of clients) {
        if ("focus" in client) return client.focus();
      }
      if (self.clients.openWindow) return self.clients.openWindow("/");
    })
  );
});
