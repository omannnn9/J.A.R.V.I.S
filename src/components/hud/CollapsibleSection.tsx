"use client";

import { useState } from "react";

export function CollapsibleSection({
  title,
  defaultOpen = true,
  children,
}: {
  title: string;
  defaultOpen?: boolean;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="border-b" style={{ borderColor: "var(--border)" }}>
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center gap-1.5 px-4 py-2.5 text-left text-[11px] font-bold uppercase tracking-[2px] text-[var(--accent)]"
      >
        <span className="inline-block w-2.5 text-[9px] transition-transform" style={{ transform: open ? "rotate(90deg)" : "none" }}>
          ▸
        </span>
        {title}
      </button>
      {open && <div className="px-4 pb-3.5">{children}</div>}
    </div>
  );
}
