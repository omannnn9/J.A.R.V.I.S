"use client";

import { useCallback, useEffect, useState } from "react";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import { isBlockedWatchTopic } from "@/lib/actions/tools";
import type { Memory, Reminder, WatchTopic } from "@/lib/supabase/types";

export function MemoryPanel({ userId, open, onChanged }: { userId: string; open: boolean; onChanged: () => void }) {
  const [memories, setMemories] = useState<Memory[]>([]);
  const [reminders, setReminders] = useState<Reminder[]>([]);
  const [watchTopics, setWatchTopics] = useState<WatchTopic[]>([]);
  const [loading, setLoading] = useState(false);
  const [tab, setTab] = useState<"memory" | "reminders" | "topics">("memory");

  const load = useCallback(async () => {
    setLoading(true);
    const supabase = getSupabaseBrowserClient();
    const [{ data: mem }, { data: rem }, { data: topics }] = await Promise.all([
      supabase.from("memories").select("*").eq("user_id", userId).order("created_at", { ascending: false }),
      supabase
        .from("reminders")
        .select("*")
        .eq("user_id", userId)
        .eq("notified", false)
        .order("remind_at", { ascending: true }),
      supabase.from("watch_topics").select("*").eq("user_id", userId).order("created_at", { ascending: false }),
    ]);
    setMemories(mem ?? []);
    setReminders(rem ?? []);
    setWatchTopics(topics ?? []);
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

  async function addReminder(text: string, remindAt: string, recurrence: Reminder["recurrence"]) {
    const supabase = getSupabaseBrowserClient();
    const { data, error } = await supabase
      .from("reminders")
      .insert({ user_id: userId, text, remind_at: remindAt, recurrence })
      .select()
      .single();
    if (error || !data) return error?.message ?? "Couldn't save that reminder.";
    setReminders((prev) => [...prev, data].sort((a, b) => a.remind_at.localeCompare(b.remind_at)));
    return null;
  }

  async function cancelReminder(id: string) {
    const supabase = getSupabaseBrowserClient();
    await supabase.from("reminders").delete().eq("id", id);
    setReminders((prev) => prev.filter((r) => r.id !== id));
  }

  async function addWatchTopic(topic: string) {
    const supabase = getSupabaseBrowserClient();
    const { data, error } = await supabase
      .from("watch_topics")
      .insert({ user_id: userId, topic })
      .select()
      .single();
    if (error || !data) return error?.message ?? "Couldn't watch that topic.";
    setWatchTopics((prev) => [data, ...prev]);
    return null;
  }

  async function unwatchTopic(id: string) {
    const supabase = getSupabaseBrowserClient();
    await supabase.from("watch_topics").delete().eq("id", id);
    setWatchTopics((prev) => prev.filter((t) => t.id !== id));
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
        <TabButton active={tab === "topics"} onClick={() => setTab("topics")}>
          Topics ({watchTopics.length})
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
        <div className="flex flex-col gap-3">
          <AddReminderForm onAdd={addReminder} />
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
                    {r.recurrence !== "none" && (
                      <span className="ml-1.5 text-[var(--accent)]">· repeats {r.recurrence}</span>
                    )}
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
        </div>
      )}

      {!loading && tab === "topics" && (
        <div className="flex flex-col gap-3">
          <AddTopicForm onAdd={addWatchTopic} />
          <div className="flex flex-col gap-2">
            {watchTopics.length === 0 && (
              <Empty text="Not watching anything — JARVIS checks watched topics roughly once a day and lets you know when the headline changes." />
            )}
            {watchTopics.map((w) => (
              <div
                key={w.id}
                className="flex items-start justify-between gap-2 rounded-lg border px-3 py-2.5 text-[13px]"
                style={{ background: "var(--surface)", borderColor: "var(--border)" }}
              >
                <div className="min-w-0">
                  <div className="text-[var(--text)]">{w.topic}</div>
                  {w.last_headline && (
                    <div className="mt-0.5 truncate text-[10.5px] text-[var(--muted)]">{w.last_headline}</div>
                  )}
                </div>
                <button
                  onClick={() => unwatchTopic(w.id)}
                  title="Stop watching"
                  className="shrink-0 text-[var(--muted)] hover:text-[var(--red)]"
                >
                  ×
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function AddReminderForm({
  onAdd,
}: {
  onAdd: (text: string, remindAt: string, recurrence: Reminder["recurrence"]) => Promise<string | null>;
}) {
  const [text, setText] = useState("");
  const [when, setWhen] = useState("");
  const [recurrence, setRecurrence] = useState<Reminder["recurrence"]>("none");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function submit() {
    const trimmed = text.trim();
    if (!trimmed || !when) {
      setError("Enter what to remind you about and when.");
      return;
    }
    const remindAt = new Date(when);
    if (Number.isNaN(remindAt.getTime()) || remindAt.getTime() <= Date.now()) {
      setError("Pick a time in the future.");
      return;
    }
    setSaving(true);
    setError(null);
    const err = await onAdd(trimmed, remindAt.toISOString(), recurrence);
    setSaving(false);
    if (err) {
      setError(err);
      return;
    }
    setText("");
    setWhen("");
    setRecurrence("none");
  }

  return (
    <div className="flex flex-col gap-1.5 rounded-lg border px-3 py-2.5" style={{ borderColor: "var(--border)" }}>
      <input
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder="Remind me to…"
        className="w-full rounded-md border px-2.5 py-2 text-[13px] outline-none focus:border-[var(--accent)]"
        style={{ background: "var(--bg-elevated)", borderColor: "var(--border)", color: "var(--text)" }}
      />
      <div className="flex gap-1.5">
        <input
          type="datetime-local"
          value={when}
          onChange={(e) => setWhen(e.target.value)}
          className="min-w-0 flex-1 rounded-md border px-2.5 py-2 text-[12px] outline-none focus:border-[var(--accent)]"
          style={{ background: "var(--bg-elevated)", borderColor: "var(--border)", color: "var(--text)" }}
        />
        <select
          value={recurrence}
          onChange={(e) => setRecurrence(e.target.value as Reminder["recurrence"])}
          className="shrink-0 rounded-md border px-2 text-[11px] outline-none focus:border-[var(--accent)]"
          style={{ background: "var(--bg-elevated)", borderColor: "var(--border)", color: "var(--text)" }}
        >
          <option value="none">Once</option>
          <option value="daily">Daily</option>
          <option value="weekly">Weekly</option>
        </select>
        <button
          onClick={submit}
          disabled={saving}
          className="shrink-0 rounded-md px-3 text-[11px] font-bold tracking-wide text-white transition-opacity hover:opacity-90 disabled:opacity-50"
          style={{ background: "var(--accent)" }}
        >
          {saving ? "…" : "ADD"}
        </button>
      </div>
      {error && <p className="text-[10.5px] text-[var(--red)]">{error}</p>}
    </div>
  );
}

function AddTopicForm({ onAdd }: { onAdd: (topic: string) => Promise<string | null> }) {
  const [topic, setTopic] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function submit() {
    const trimmed = topic.trim();
    if (!trimmed) {
      setError("Enter a topic to watch.");
      return;
    }
    if (isBlockedWatchTopic(trimmed)) {
      setError("Can't set up background monitoring for crypto/financial topics.");
      return;
    }
    setSaving(true);
    setError(null);
    const err = await onAdd(trimmed);
    setSaving(false);
    if (err) {
      setError(err);
      return;
    }
    setTopic("");
  }

  return (
    <div className="flex flex-col gap-1.5 rounded-lg border px-3 py-2.5" style={{ borderColor: "var(--border)" }}>
      <div className="flex gap-1.5">
        <input
          value={topic}
          onChange={(e) => setTopic(e.target.value)}
          placeholder="Watch a topic (e.g. a team, a project, a person)"
          onKeyDown={(e) => e.key === "Enter" && submit()}
          className="min-w-0 flex-1 rounded-md border px-2.5 py-2 text-[13px] outline-none focus:border-[var(--accent)]"
          style={{ background: "var(--bg-elevated)", borderColor: "var(--border)", color: "var(--text)" }}
        />
        <button
          onClick={submit}
          disabled={saving}
          className="shrink-0 rounded-md px-3 text-[11px] font-bold tracking-wide text-white transition-opacity hover:opacity-90 disabled:opacity-50"
          style={{ background: "var(--accent)" }}
        >
          {saving ? "…" : "ADD"}
        </button>
      </div>
      {error && <p className="text-[10.5px] text-[var(--red)]">{error}</p>}
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
