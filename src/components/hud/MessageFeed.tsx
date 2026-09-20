"use client";

import { useEffect, useRef } from "react";
import type { ChatMessage } from "@/hooks/useChat";

export function MessageFeed({
  messages,
  loading,
  assistantName,
}: {
  messages: ChatMessage[];
  loading: boolean;
  assistantName: string;
}) {
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages.length, loading]);

  return (
    <main className="flex-1 overflow-y-auto px-4 pb-2 pt-4 sm:px-6">
      <div className="mx-auto flex max-w-2xl flex-col gap-2.5">
        {messages.length === 0 && !loading && (
          <div className="mt-10 text-center text-[12px] text-[var(--muted)]">
            Say hello, or ask {assistantName} anything.
          </div>
        )}
        {messages.map((m) => (
          <Bubble key={m.id} message={m} />
        ))}
        {loading && (
          <div
            className="animate-pop self-start rounded-2xl rounded-bl-sm border px-3.5 py-2.5 text-sm"
            style={{ background: "var(--accent-dim)", borderColor: "var(--accent-border)" }}
          >
            <span className="inline-flex gap-1">
              <Dot delay="0s" />
              <Dot delay="0.15s" />
              <Dot delay="0.3s" />
            </span>
          </div>
        )}
        <div ref={endRef} />
      </div>
    </main>
  );
}

function Dot({ delay }: { delay: string }) {
  return (
    <span
      className="inline-block h-1.5 w-1.5 rounded-full"
      style={{
        background: "var(--accent)",
        animation: "blink-dot 1s infinite",
        animationDelay: delay,
      }}
    />
  );
}

function Bubble({ message }: { message: ChatMessage }) {
  if (message.role === "system") {
    return (
      <div className="animate-pop self-center py-0.5 text-[11px] tracking-wide text-[var(--muted)]">
        {message.text}
      </div>
    );
  }

  const isUser = message.role === "user";
  return (
    <div
      className={`animate-pop max-w-[85%] rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed sm:max-w-[75%] ${
        isUser ? "self-end rounded-br-sm" : "self-start rounded-bl-sm"
      }`}
      style={
        isUser
          ? { background: "var(--surface)", border: "1px solid var(--border)" }
          : { background: "var(--accent-dim)", border: "1px solid var(--accent-border)" }
      }
    >
      <div
        className="mb-1 text-[9px] font-bold uppercase tracking-[2px] opacity-45"
        style={{ color: isUser ? "var(--muted)" : "var(--accent)", textAlign: isUser ? "right" : "left" }}
      >
        {isUser ? "You" : "JARVIS"}
      </div>
      <div className="whitespace-pre-wrap break-words">{message.text}</div>
    </div>
  );
}
