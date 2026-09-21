"use client";

import { useEffect, useRef, useState } from "react";
import type { ChatMessage } from "@/hooks/useChat";

// The desktop app's log doesn't just append lines — they type themselves out
// character by character (6ms/char). Historical messages already loaded on
// mount skip the animation and render instantly; only freshly-appended ones
// type out.
function TypewriterText({ text, skip, onDone }: { text: string; skip: boolean; onDone: () => void }) {
  const [shown, setShown] = useState(skip ? text.length : 0);

  useEffect(() => {
    if (skip) return;
    if (shown >= text.length) {
      onDone();
      return;
    }
    const t = setTimeout(() => setShown((n) => n + 1), 6);
    return () => clearTimeout(t);
  }, [shown, skip, text, onDone]);

  return <>{text.slice(0, shown)}</>;
}

// A plain <a download> is only honored by browsers for same-origin URLs — a
// cross-origin Supabase Storage URL just navigates instead of saving. Fetch
// it as a blob and trigger the save from that instead; if the fetch fails
// (offline, CORS), fall back to opening it so the user can still save it
// manually from there.
async function downloadImage(url: string, filename: string) {
  try {
    const res = await fetch(url);
    const blob = await res.blob();
    const blobUrl = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = blobUrl;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(blobUrl);
  } catch {
    window.open(url, "_blank", "noopener,noreferrer");
  }
}

export function ActivityLog({
  messages,
  loading,
  assistantName,
  asleep,
  wakeWordEnabled,
}: {
  messages: ChatMessage[];
  loading: boolean;
  assistantName: string;
  asleep: boolean;
  wakeWordEnabled: boolean;
}) {
  const endRef = useRef<HTMLDivElement>(null);
  const [revealedIds, setRevealedIds] = useState<Set<string>>(() => new Set(messages.map((m) => m.id)));

  useEffect(() => {
    endRef.current?.scrollIntoView({ block: "end" });
  }, [messages.length, loading]);

  function markRevealed(id: string) {
    setRevealedIds((prev) => (prev.has(id) ? prev : new Set(prev).add(id)));
  }

  const emptyStateText =
    asleep && wakeWordEnabled
      ? `SYS: ${assistantName} online — sleeping. Say "Hey ${assistantName}" to wake me.`
      : asleep
        ? `SYS: ${assistantName} online — sleeping. Tap 👂 above to wake me.`
        : `SYS: ${assistantName} online. Say hello, or type a command below.`;

  return (
    <div
      className="h-[34vh] min-h-[180px] overflow-y-auto rounded-md border p-2.5 font-mono text-[11.5px] leading-relaxed"
      style={{ borderColor: "var(--border)", background: "rgba(0,0,0,0.25)" }}
    >
      {messages.length === 0 && !loading && <div className="text-[var(--muted)]">{emptyStateText}</div>}
      {messages.map((m) => {
        const skip = revealedIds.has(m.id);
        const onDone = () => markRevealed(m.id);
        return (
          <div key={m.id} className="mb-1.5 break-words">
            {m.role === "system" ? (
              <span className="text-[var(--muted)]">
                SYS: <TypewriterText text={m.text} skip={skip} onDone={onDone} />
              </span>
            ) : m.role === "user" ? (
              <span>
                <span className="text-[var(--muted)]">YOU: </span>
                <span className="text-[var(--text)]">
                  <TypewriterText text={m.text} skip={skip} onDone={onDone} />
                </span>
              </span>
            ) : (
              <span>
                <span className="text-[var(--accent)]">JARVIS: </span>
                <span className="text-[var(--text)]">
                  <TypewriterText text={m.text} skip={skip} onDone={onDone} />
                </span>
              </span>
            )}
            {m.imageDataUrl && (
              <div className="mt-1.5">
                {/* eslint-disable-next-line @next/next/no-img-element -- ephemeral data: URL, not a static asset */}
                <img
                  src={m.imageDataUrl}
                  alt={m.text}
                  className="max-w-full rounded-md border"
                  style={{ borderColor: "var(--border)" }}
                />
                <div className="mt-1 flex gap-3">
                  <a
                    href={m.imageDataUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="text-[10.5px] font-semibold text-[var(--accent)] hover:opacity-80"
                  >
                    OPEN IN NEW TAB
                  </a>
                  <button
                    onClick={() => downloadImage(m.imageDataUrl!, `jarvis-${m.id}.png`)}
                    className="text-[10.5px] font-semibold text-[var(--accent)] hover:opacity-80"
                  >
                    DOWNLOAD
                  </button>
                </div>
              </div>
            )}
          </div>
        );
      })}
      {loading && <div className="text-[var(--accent)] opacity-70">JARVIS: …</div>}
      <div ref={endRef} />
    </div>
  );
}
