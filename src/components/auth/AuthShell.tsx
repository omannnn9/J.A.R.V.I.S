"use client";

import { useState } from "react";

export function AuthShell({
  subtitle,
  hint,
  children,
}: {
  subtitle: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-[var(--bg)] px-4 py-10">
      <div className="w-full max-w-[380px] rounded-[22px] border border-[var(--border)] bg-[var(--surface)] px-8 py-11 text-center">
        <div className="mb-1.5 text-[28px] font-bold tracking-[10px] text-[var(--text)]">
          <em className="not-italic text-[var(--accent)]">J</em>ARVIS
        </div>
        <div className="mb-3 text-[11px] uppercase tracking-[3px] text-[var(--muted)]">
          {subtitle}
        </div>
        {hint && (
          <p className="mb-7 text-[12px] leading-relaxed text-[var(--muted)]">{hint}</p>
        )}
        {children}
      </div>
    </div>
  );
}

export function useShake() {
  const [shake, setShake] = useState(false);
  const trigger = () => {
    setShake(false);
    requestAnimationFrame(() => setShake(true));
  };
  return { shake, trigger };
}

export function FieldInput(
  props: React.InputHTMLAttributes<HTMLInputElement> & { label: string }
) {
  const { label, id, ...rest } = props;
  return (
    <div className="mb-4 text-left">
      <label htmlFor={id} className="mb-1.5 block text-[11px] font-semibold tracking-wide text-[var(--muted)]">
        {label}
      </label>
      <input
        id={id}
        {...rest}
        className="w-full rounded-xl border-[1.5px] border-[var(--border)] bg-white/5 px-3.5 py-3 text-[14px] text-[var(--text)] outline-none transition-colors focus:border-[var(--accent)] focus:bg-[var(--accent-dim)]"
      />
    </div>
  );
}

export function SubmitButton({
  children,
  loading,
  ...rest
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { loading?: boolean }) {
  return (
    <button
      {...rest}
      disabled={loading || rest.disabled}
      className="w-full rounded-xl bg-[var(--accent)] py-3.5 text-[12px] font-bold tracking-[3px] text-white transition-opacity hover:opacity-90 active:scale-[0.98] disabled:opacity-50"
    >
      {loading ? "···" : children}
    </button>
  );
}
