"use client";

import { useCallback, useEffect, useState } from "react";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import type { Memory, Reminder } from "@/lib/supabase/types";

export function MemoryPanel({ userId, open, onChanged }: { userId: string; open: boolean; onChanged: () => void }) {
  const [memories, setMemories] = useState<Memory[]>([]);
  const [reminders, setReminders] = useState<Reminder[]>([]);
  const [loading, setLoading] = useState(false);
  const [tab, setTab] = useState<"memory" | "reminders">("memory");

  const load = useCallback(async () => {
    setLoading(true);
    const supabase = getSupabaseBrowserClient();
    const [{ data: mem }, { data: rem }] = await Promise.all([
      supabase.from("memories").select("*").eq("user_id", userId).order("created_at", { ascending: false }),
      supabase
        .from("reminders")
        .select("*")
        .eq("user_id", userId)
        .eq("notified", false)
        .order("remind_at", { ascending: true }),
    ]);
    setMemories(mem ?? []);
    setReminders(rem ?? []);
    setLoading(false);
  }, [userId]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- intentional fetch-on-open
    if (open) load();
  }, [open, load]);

  async function deleteMemory(id: string) {
    const supabase = getSupabaseBrowserClient();
    await supabase.from("memories").delete().eq("id", id);
    setMemories((prev) => prev.filter((m) => m.id !== id));
    onChanged();
  }

  async function cancelReminder(id: string) {
    const supabase = getSupabaseBrowserClient();
    await supabase.from("reminders").delete().eq("id", id);
    setReminders((prev) => prev.filter((r) => r.id !== id));
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex gap-1.5 rounded-lg border p-1" style={{ borderColor: "var(--border)" }}>
        <TabButton active={tab === "memory"} onClick={() => setTab("memory")}>
          Memory ({memories.length})
        </TabButton>
        <TabButton active={tab === "reminders"} onClick={() => setTab("reminders")}>
          Reminders ({reminders.length})
        </TabButton>
      </div>

      {loading && <p className="text-xs text-[var(--muted)]">Loading…</p>}

      {!loading && tab === "memory" && (
        <div className="flex flex-col gap-2">
          {memories.length === 0 && <Empty text="Nothing remembered yet — just talk to JARVIS." />}
          {memories.map((m) => (
            <div
              key={m.id}
              className="flex items-start justify-between gap-2 rounded-lg border px-3 py-2.5 text-[13px]"
              style={{ background: "var(--surface)", borderColor: "var(--border)" }}
            >
              <span className="leading-relaxed text-[var(--text)]">{m.content}</span>
              <button
                onClick={() => deleteMemory(m.id)}
                title="Forget this"
                className="shrink-0 text-[var(--muted)] hover:text-[var(--red)]"
              >
                ×
              </button>
            </div>
          ))}
        </div>
      )}

      {!loading && tab === "reminders" && (
        <div className="flex flex-col gap-2">
          {reminders.length === 0 && <Empty text="No upcoming reminders." />}
          {reminders.map((r) => (
            <div
              key={r.id}
              className="flex items-start justify-between gap-2 rounded-lg border px-3 py-2.5 text-[13px]"
              style={{ background: "var(--surface)", borderColor: "var(--border)" }}
            >
              <div>
                <div className="text-[var(--text)]">{r.text}</div>
                <div className="mt-0.5 text-[10.5px] text-[var(--muted)]">
                  {new Date(r.remind_at).toLocaleString()}
                </div>
              </div>
              <button
                onClick={() => cancelReminder(r.id)}
                title="Cancel"
                className="shrink-0 text-[var(--muted)] hover:text-[var(--red)]"
              >
                ×
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function TabButton({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className="flex-1 rounded-md py-1.5 text-[11px] font-bold tracking-wide transition-colors"
      style={
        active
          ? { background: "var(--accent-dim)", color: "var(--accent)" }
          : { color: "var(--muted)" }
      }
    >
      {children}
    </button>
  );
}

function Empty({ text }: { text: string }) {
  return <p className="py-6 text-center text-xs text-[var(--muted)]">{text}</p>;
}
