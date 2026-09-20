"use client";

import { useEffect, useState } from "react";

export interface SystemStats {
  up: string; // time since this session started — a browser can't see OS uptime
  os: string | null; // best guess from the browser's own UA string
  netMbps: number | null; // Network Information API — Chrome/Edge/Android only
}

function detectOS(): string | null {
  if (typeof navigator === "undefined") return null;
  const ua = navigator.userAgent;
  if (/Windows/i.test(ua)) return "Windows";
  if (/Mac OS X/i.test(ua) && !/Mobile/i.test(ua)) return "macOS";
  if (/iPhone|iPad|iPod/i.test(ua)) return "iOS";
  if (/Android/i.test(ua)) return "Android";
  if (/Linux/i.test(ua)) return "Linux";
  return null;
}

function fmtUptime(ms: number): string {
  const totalSeconds = Math.floor(ms / 1000);
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const s = totalSeconds % 60;
  return h > 0
    ? `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`
    : `${m}:${String(s).padStart(2, "0")}`;
}

function detectDownlink(): number | null {
  if (typeof navigator === "undefined") return null;
  const conn = (navigator as unknown as { connection?: { downlink?: number } }).connection;
  return typeof conn?.downlink === "number" ? conn.downlink : null;
}

export function useSystemStats(): SystemStats {
  const [startedAt] = useState(() => Date.now());
  const [up, setUp] = useState("0:00");
  // Both start null/neutral on server and client alike (avoids a hydration
  // mismatch), then fill in from the browser once mounted.
  const [os, setOs] = useState<string | null>(null);
  const [netMbps, setNetMbps] = useState<number | null>(null);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- one-time read of browser-only APIs, not derived state
    setOs(detectOS());
    setNetMbps(detectDownlink());

    const id = setInterval(() => setUp(fmtUptime(Date.now() - startedAt)), 1000);
    return () => clearInterval(id);
  }, [startedAt]);

  return { up, os, netMbps };
}
