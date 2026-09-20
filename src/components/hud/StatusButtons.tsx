"use client";

function StatusBadge({ top, bottom, active }: { top: string; bottom: string; active: boolean }) {
  return (
    <div
      className="rounded-md border py-2 text-center"
      style={
        active
          ? { borderColor: "rgba(34,224,138,0.35)", background: "var(--green-dim)" }
          : { borderColor: "var(--border)", background: "rgba(0,0,0,0.2)" }
      }
    >
      <div className="text-[9px] font-bold uppercase tracking-[1.5px] text-[var(--muted)]">{top}</div>
      <div className="text-[11px] font-bold uppercase tracking-[1.5px]" style={{ color: active ? "var(--green)" : "var(--muted)" }}>
        {bottom}
      </div>
    </div>
  );
}

export function StatusButtons({ aiCoreActive }: { aiCoreActive: boolean }) {
  return (
    <div className="flex flex-col gap-1.5">
      <StatusBadge top="AI CORE" bottom={aiCoreActive ? "ACTIVE" : "NO KEY"} active={aiCoreActive} />
      <StatusBadge top="SEC" bottom="CLEARED" active />
      <StatusBadge top="PROTOCOL" bottom="LIV" active={false} />
    </div>
  );
}
