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
