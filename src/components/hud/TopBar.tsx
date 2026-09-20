"use client";

import { useClock } from "@/hooks/useClock";

export function TopBar({
  assistantName,
  onOpenSettings,
  onOpenMemory,
}: {
  assistantName: string;
  onOpenSettings: () => void;
  onOpenMemory: () => void;
}) {
  const { time, date } = useClock();

  return (
    <header
      className="flex shrink-0 items-center justify-between gap-2 border-b px-3 py-2.5 sm:px-5 sm:py-3"
      style={{ borderColor: "var(--border)", background: "rgba(0,0,0,0.3)" }}
    >
      <div className="flex min-w-0 flex-1 items-center gap-1.5 sm:w-[220px] sm:flex-none sm:gap-2">
        <span className="hidden text-[11px] font-bold uppercase tracking-[2px] text-[var(--muted)] sm:inline">
          Mark Liv
        </span>
        <button
          onClick={onOpenSettings}
          title="Settings"
          className="flex h-6 w-6 shrink-0 items-center justify-center rounded border text-[11px] text-[var(--muted)] transition-colors hover:text-[var(--accent)]"
          style={{ borderColor: "var(--border)" }}
        >
          ⚙
        </button>
        <button
          onClick={onOpenMemory}
          title="Memory"
          className="flex h-6 w-6 shrink-0 items-center justify-center rounded border text-[11px] text-[var(--muted)] transition-colors hover:text-[var(--accent)]"
          style={{ borderColor: "var(--border)" }}
        >
          🧠
        </button>
      </div>

      <div className="flex flex-col items-center">
        <div className="text-[17px] font-bold tracking-[3px] text-[var(--accent)] sm:text-[26px] sm:tracking-[6px]">
          {assistantName}
        </div>
        <div className="-mt-0.5 h-px w-16 sm:w-24" style={{ background: "var(--accent)", opacity: 0.5 }} />
        <div className="mt-1 hidden text-[10px] uppercase tracking-[2px] text-[var(--muted)] sm:block">
          A Friendly Assistant
        </div>
      </div>

      <div className="flex flex-1 flex-col items-end sm:w-[220px] sm:flex-none">
        <div className="font-mono text-[14px] font-bold text-[var(--text)] sm:text-[20px]">{time}</div>
        <div className="hidden text-[10px] text-[var(--muted)] sm:block">{date}</div>
      </div>
    </header>
  );
}
