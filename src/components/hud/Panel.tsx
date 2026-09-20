"use client";

export function Panel({
  title,
  open,
  onClose,
  children,
}: {
  title: string;
  open: boolean;
  onClose: () => void;
  children: React.ReactNode;
}) {
  return (
    <div
      className={`fixed inset-0 z-40 transition-opacity ${open ? "pointer-events-auto opacity-100" : "pointer-events-none opacity-0"}`}
    >
      <div className="absolute inset-0 bg-black/60" onClick={onClose} />
      <div
        className={`absolute right-0 top-0 flex h-full w-full max-w-sm flex-col border-l transition-transform duration-200 ${
          open ? "translate-x-0" : "translate-x-full"
        }`}
        style={{ background: "var(--bg-elevated)", borderColor: "var(--border)" }}
      >
        <div className="flex shrink-0 items-center justify-between border-b px-5 py-4" style={{ borderColor: "var(--border)" }}>
          <h2 className="text-sm font-bold uppercase tracking-[2px] text-[var(--text)]">{title}</h2>
          <button onClick={onClose} className="text-xl leading-none text-[var(--muted)] hover:text-[var(--text)]">
            ×
          </button>
        </div>
        <div className="flex-1 overflow-y-auto px-5 py-4">{children}</div>
      </div>
    </div>
  );
}
