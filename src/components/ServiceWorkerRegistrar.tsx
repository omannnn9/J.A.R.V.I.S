"use client";

import { useEffect } from "react";

// Registers the (intentionally minimal) service worker so the app meets
// Chrome's PWA installability criteria — nothing here does any caching.
export function ServiceWorkerRegistrar() {
  useEffect(() => {
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.register("/sw.js").catch(() => {});
    }
  }, []);
  return null;
}
