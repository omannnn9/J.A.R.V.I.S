"use client";

import { useState } from "react";

export function CommandInput({
  onSend,
  disabled,
  listening,
  sttSupported,
  onMicToggle,
  onInterrupt,
  interruptActive,
}: {
  onSend: (text: string) => void;
  disabled?: boolean;
  listening: boolean;
  sttSupported: boolean;
  onMicToggle: () => void;
  onInterrupt: () => void;
  interruptActive: boolean;
}) {
  const [text, setText] = useState("");

  function submit() {
    const trimmed = text.trim();
    if (!trimmed) return;
    onSend(trimmed);
    setText("");
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center gap-2">
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              submit();
            }
          }}
          placeholder={listening ? "Listening…" : "Type a command or question…"}
          disabled={disabled}
          className="min-w-0 flex-1 rounded-md border px-3 py-2.5 text-[13px] outline-none transition-colors focus:border-[var(--accent)]"
          style={{ background: "rgba(0,0,0,0.25)", borderColor: "var(--border)", color: "var(--text)" }}
        />
        <button
          onClick={submit}
          disabled={disabled}
          className="flex h-[42px] w-[42px] shrink-0 items-center justify-center rounded-md border text-[var(--accent)] transition-opacity hover:opacity-80 disabled:opacity-40"
          style={{ borderColor: "var(--accent-border)", background: "var(--accent-dim)" }}
          title="Send"
        >
          ▶
        </button>
      </div>

      <button
        onClick={onInterrupt}
        disabled={!interruptActive}
        className="flex w-full items-center justify-center gap-2 rounded-md border py-2.5 text-[11px] font-bold uppercase tracking-[1.5px] transition-opacity disabled:opacity-40"
        style={{ borderColor: "rgba(248,113,113,0.4)", background: "var(--red-dim)", color: "var(--red)" }}
      >
        ✋ Interrupt <span className="opacity-60">[ESC]</span>
      </button>

      {sttSupported && (
        <button
          onClick={onMicToggle}
          className="flex w-full items-center justify-center gap-2 rounded-md border py-2.5 text-[11px] font-bold uppercase tracking-[1.5px] transition-colors"
          style={
            listening
              ? { borderColor: "rgba(34,224,138,0.45)", background: "var(--green-dim)", color: "var(--green)" }
              : { borderColor: "var(--border)", background: "transparent", color: "var(--muted)" }
          }
        >
          🎙 {listening ? "Microphone Active" : "Tap to Speak"}
        </button>
      )}
    </div>
  );
}
