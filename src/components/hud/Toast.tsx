"use client";

export function Toast({ message }: { message: string | null }) {
  return (
    <div
      className={`pointer-events-none fixed left-1/2 top-4 z-50 -translate-x-1/2 whitespace-nowrap rounded-full border px-4 py-1.5 text-xs font-bold tracking-wide transition-all duration-200 ${
        message ? "opacity-100 translate-y-0" : "-translate-y-2 opacity-0"
      }`}
      style={{
        background: "var(--green-dim)",
        borderColor: "rgba(34,197,94,0.4)",
        color: "var(--green)",
      }}
    >
      {message}
    </div>
  );
}
