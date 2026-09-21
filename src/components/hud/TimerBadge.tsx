"use client";

import { useEffect, useState } from "react";

export function TimerBadge({
  timer,
  onDismiss,
}: {
  timer: { label: string; endAt: number } | null;
  onDismiss: () => void;
}) {
  const [remainingMs, setRemainingMs] = useState(0);

  useEffect(() => {
    if (!timer) return;
    const tick = () => setRemainingMs(Math.max(0, timer.endAt - Date.now()));
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [timer]);

  if (!timer) return null;

  const totalSeconds = Math.ceil(remainingMs / 1000);
  const mm = Math.floor(totalSeconds / 60);
  const ss = totalSeconds % 60;

  return (
    <div
      className="fixed left-1/2 top-3 z-50 flex -translate-x-1/2 items-center gap-2 rounded-full border px-3.5 py-1.5 text-xs font-semibold shadow-lg"
      style={{ background: "var(--surface-strong)", borderColor: "var(--accent-border)", color: "var(--text)" }}
    >
      <span className="text-[var(--accent)]">⏱</span>
      <span className="max-w-[35vw] truncate">{timer.label}</span>
      <span className="font-mono text-[var(--accent)]">
        {mm}:{ss.toString().padStart(2, "0")}
      </span>
      <button onClick={onDismiss} className="text-[var(--muted)] hover:text-[var(--text)]">
        ×
      </button>
    </div>
  );
}
