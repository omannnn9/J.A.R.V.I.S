"use client";

import type { AvatarState } from "./Avatar";

export function Header({
  assistantName,
  state,
  onOpenMemory,
  onOpenSettings,
  onSignOut,
}: {
  assistantName: string;
  state: AvatarState;
  onOpenMemory: () => void;
  onOpenSettings: () => void;
  onSignOut: () => void;
}) {
  const active = state !== "asleep";
  return (
    <header
      className="flex shrink-0 items-center gap-2.5 border-b px-4 py-3 sm:px-6"
      style={{ borderColor: "var(--border)", background: "rgba(7,9,15,0.95)" }}
    >
      <div className="text-[15px] font-bold tracking-[6px]">
        <em className="not-italic text-[var(--accent)]">{assistantName.charAt(0)}</em>
        {assistantName.slice(1)}
      </div>

      <div
        className="flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[10px] font-bold uppercase tracking-[1.5px]"
        style={
          active
            ? { background: "var(--green-dim)", borderColor: "rgba(34,197,94,0.3)", color: "var(--green)" }
            : { background: "var(--surface)", borderColor: "var(--border)", color: "var(--muted)" }
        }
      >
        <span
          className="h-1.5 w-1.5 rounded-full"
          style={{
            background: active ? "var(--green)" : "var(--muted)",
            animation: active ? "blink-dot 2s infinite" : undefined,
          }}
        />
        {active ? "Active" : "Sleeping"}
      </div>

      <div className="flex-1" />

      <button
        onClick={onOpenMemory}
        title="Memory"
        className="rounded-lg border px-2.5 py-1.5 text-xs text-[var(--muted)] transition-colors hover:text-[var(--text)]"
        style={{ background: "var(--surface)", borderColor: "var(--border)" }}
      >
        🧠 <span className="hidden sm:inline">Memory</span>
      </button>
      <button
        onClick={onOpenSettings}
        title="Settings"
        className="rounded-lg border px-2.5 py-1.5 text-xs text-[var(--muted)] transition-colors hover:text-[var(--text)]"
        style={{ background: "var(--surface)", borderColor: "var(--border)" }}
      >
        ⚙️ <span className="hidden sm:inline">Settings</span>
      </button>
      <button
        onClick={onSignOut}
        title="Sign out"
        className="rounded-lg border px-2.5 py-1.5 text-xs text-[var(--muted)] transition-colors hover:text-[var(--text)]"
        style={{ background: "var(--surface)", borderColor: "var(--border)" }}
      >
        ⏻
      </button>
    </header>
  );
}
