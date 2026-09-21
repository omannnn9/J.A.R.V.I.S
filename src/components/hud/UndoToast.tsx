"use client";

export function UndoToast({
  pending,
  onUndo,
  onDismiss,
}: {
  pending: { message: string; restore: () => Promise<void> } | null;
  onUndo: () => void;
  onDismiss: () => void;
}) {
  return (
    <div
      className={`pointer-events-none fixed bottom-4 left-1/2 z-50 flex -translate-x-1/2 items-center gap-3 rounded-full border px-4 py-2 text-xs font-semibold transition-all duration-200 ${
        pending ? "translate-y-0 opacity-100" : "translate-y-2 opacity-0"
      }`}
      style={{ background: "var(--surface-strong)", borderColor: "var(--border)", color: "var(--text)" }}
    >
      <span className="max-w-[60vw] truncate">{pending?.message}</span>
      <button onClick={onUndo} className="pointer-events-auto font-bold text-[var(--accent)] hover:opacity-80">
        UNDO
      </button>
      <button onClick={onDismiss} className="pointer-events-auto text-[var(--muted)] hover:text-[var(--text)]">
        ✕
      </button>
    </div>
  );
}
