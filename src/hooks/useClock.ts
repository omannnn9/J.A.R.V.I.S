"use client";

import { useEffect, useState } from "react";

export function useClock() {
  // Starts null on both server and client (avoids a hydration mismatch),
  // then ticks alive once mounted.
  const [now, setNow] = useState<Date | null>(null);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- first tick of a live clock, not derived state
    setNow(new Date());
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);

  if (!now) return { time: "--:--:--", date: "" };

  const time = now.toLocaleTimeString(undefined, { hour12: false });
  const date = now.toLocaleDateString(undefined, {
    weekday: "short",
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
  return { time, date };
}
