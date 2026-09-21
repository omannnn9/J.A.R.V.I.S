"use client";

import { useRef, useState } from "react";

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
  // Recent commands, most-recent-last. historyIndexRef tracks how far the
  // user has walked back with ArrowUp; null means "not currently browsing
  // history" (a fresh, unsent draft). draftRef holds whatever they'd typed
  // before pressing ArrowUp, restored on ArrowDown past the newest entry.
  const historyRef = useRef<string[]>([]);
  const historyIndexRef = useRef<number | null>(null);
  const draftRef = useRef("");

  function submit() {
    const trimmed = text.trim();
    if (!trimmed) return;
    historyRef.current = [...historyRef.current.filter((h) => h !== trimmed), trimmed].slice(-50);
    historyIndexRef.current = null;
    onSend(trimmed);
    setText("");
  }

  function recallHistory(direction: -1 | 1) {
    const history = historyRef.current;
    if (history.length === 0) return;
    if (historyIndexRef.current === null) {
      if (direction === 1) return; // ArrowDown with no active recall — nothing to do
      draftRef.current = text;
      historyIndexRef.current = history.length - 1;
    } else {
      const next = historyIndexRef.current + direction;
      if (next < 0) return;
      if (next >= history.length) {
        historyIndexRef.current = null;
        setText(draftRef.current);
        return;
      }
      historyIndexRef.current = next;
    }
    setText(history[historyIndexRef.current]);
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
            } else if (e.key === "ArrowUp") {
              e.preventDefault();
              recallHistory(-1);
            } else if (e.key === "ArrowDown") {
              e.preventDefault();
              recallHistory(1);
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
