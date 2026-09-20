"use client";

import { useSystemStats } from "@/hooks/useSystemStats";

function StatBox({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <div
      className="flex items-center justify-between rounded-md border px-2.5 py-2"
      style={{ borderColor: "var(--border)", background: "rgba(0,0,0,0.2)" }}
    >
      <span className="text-[10px] font-bold uppercase tracking-wide text-[var(--muted)]">{label}</span>
      <span className="text-[12px] font-bold" style={{ color: color ?? "var(--muted)" }}>
        {value}
      </span>
    </div>
  );
}

export function SysMonitorPanel() {
  const { up, os, netMbps } = useSystemStats();

  return (
    <div className="flex flex-col gap-3">
      <div className="text-[11px] font-bold uppercase tracking-[2px] text-[var(--accent)]">◆ Sys Monitor</div>

      <div className="flex flex-col gap-1.5">
        <StatBox label="CPU" value="N/A" />
        <StatBox label="MEM" value="N/A" />
        <StatBox label="NET" value={netMbps ? `${netMbps} Mb/s` : "N/A"} color="var(--green)" />
        <StatBox label="GPU" value="N/A" />
        <StatBox label="TMP" value="N/A" color="var(--pink)" />
      </div>

      <div className="flex flex-col gap-1 pl-0.5 font-mono text-[11px]">
        <div>
          <span className="text-[var(--muted)]">UP </span>
          <span className="font-bold text-[var(--green)]">{up}</span>
        </div>
        <div className="text-[var(--muted)]">
          PROC <span className="text-[var(--text)]">N/A</span>
        </div>
        <div className="text-[var(--muted)]">
          OS <span className="text-[var(--text)]">{os ?? "N/A"}</span>
        </div>
      </div>

      <p className="text-[9.5px] leading-relaxed text-[var(--muted)]">
        Browsers don&apos;t expose real hardware telemetry to websites — that&apos;s why most of this reads N/A rather than a fabricated number.
      </p>
    </div>
  );
}
