"use client";

import { useEffect, useRef } from "react";
import type { ChatMessage } from "@/hooks/useChat";

export function ActivityLog({ messages, loading }: { messages: ChatMessage[]; loading: boolean }) {
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ block: "end" });
  }, [messages.length, loading]);

  return (
    <div
      className="h-[34vh] min-h-[180px] overflow-y-auto rounded-md border p-2.5 font-mono text-[11.5px] leading-relaxed"
      style={{ borderColor: "var(--border)", background: "rgba(0,0,0,0.25)" }}
    >
      {messages.length === 0 && !loading && (
        <div className="text-[var(--muted)]">SYS: JARVIS online. Say hello, or type a command below.</div>
      )}
      {messages.map((m) => (
        <div key={m.id} className="mb-1.5 break-words">
          {m.role === "system" ? (
            <span className="text-[var(--muted)]">SYS: {m.text}</span>
          ) : m.role === "user" ? (
            <span>
              <span className="text-[var(--muted)]">YOU: </span>
              <span className="text-[var(--text)]">{m.text}</span>
            </span>
          ) : (
            <span>
              <span className="text-[var(--accent)]">JARVIS: </span>
              <span className="text-[var(--text)]">{m.text}</span>
            </span>
          )}
        </div>
      ))}
      {loading && <div className="text-[var(--accent)] opacity-70">JARVIS: …</div>}
      <div ref={endRef} />
    </div>
  );
}
