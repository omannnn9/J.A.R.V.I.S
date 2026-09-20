"use client";

import { useClock } from "@/hooks/useClock";

export function TopBar({
  assistantName,
  onOpenSettings,
  onOpenMemory,
  asleep,
  onToggleSleep,
  muted,
  onToggleMute,
}: {
  assistantName: string;
  onOpenSettings: () => void;
  onOpenMemory: () => void;
  asleep: boolean;
  onToggleSleep: () => void;
  muted: boolean;
  onToggleMute: () => void;
}) {
  const { time, date } = useClock();

  return (
    <header
      className="flex shrink-0 items-center justify-between gap-2 border-b px-3 py-2.5 sm:px-5 sm:py-3"
      style={{ borderColor: "var(--border)", background: "rgba(0,0,0,0.3)" }}
    >
      <div className="flex shrink-0 items-center gap-1 sm:w-[220px] sm:gap-2">
        <span className="hidden text-[11px] font-bold uppercase tracking-[2px] text-[var(--muted)] sm:inline">
          Mark Liv
        </span>
        <button
          onClick={onOpenSettings}
          title="Settings"
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded border text-[14px] text-[var(--muted)] transition-colors hover:text-[var(--accent)] sm:h-6 sm:w-6 sm:text-[11px]"
          style={{ borderColor: "var(--border)" }}
        >
          ⚙
        </button>
        <button
          onClick={onOpenMemory}
          title="Memory"
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded border text-[14px] text-[var(--muted)] transition-colors hover:text-[var(--accent)] sm:h-6 sm:w-6 sm:text-[11px]"
          style={{ borderColor: "var(--border)" }}
        >
          🧠
        </button>
        <button
          onClick={onToggleSleep}
          title={asleep ? "Wake JARVIS" : "Put JARVIS to sleep"}
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded border text-[14px] transition-colors sm:h-6 sm:w-6 sm:text-[11px]"
          style={{
            borderColor: asleep ? "var(--accent-border)" : "var(--border)",
            color: asleep ? "var(--accent)" : "var(--muted)",
          }}
        >
          {asleep ? "👂" : "😴"}
        </button>
        <button
          onClick={onToggleMute}
          title={muted ? "Unmute [F4]" : "Mute [F4]"}
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded border text-[14px] transition-colors sm:h-6 sm:w-6 sm:text-[11px]"
          style={{
            borderColor: muted ? "var(--red-dim)" : "var(--border)",
            color: muted ? "var(--red)" : "var(--muted)",
          }}
        >
          {muted ? "🔇" : "🔊"}
        </button>
      </div>

      <div className="flex min-w-0 flex-1 flex-col items-center px-1">
        <div className="truncate text-[15px] font-bold tracking-[2px] text-[var(--accent)] sm:text-[26px] sm:tracking-[6px]">
          {assistantName}
        </div>
        <div className="-mt-0.5 h-px w-16 sm:w-24" style={{ background: "var(--accent)", opacity: 0.5 }} />
        <div className="mt-1 hidden text-[10px] uppercase tracking-[2px] text-[var(--muted)] sm:block">
          A Friendly Assistant
        </div>
      </div>

      <div className="flex shrink-0 flex-col items-end sm:w-[220px]">
        <div className="font-mono text-[13px] font-bold text-[var(--text)] sm:text-[20px]">{time}</div>
        <div className="hidden text-[10px] text-[var(--muted)] sm:block">{date}</div>
      </div>
    </header>
  );
}
