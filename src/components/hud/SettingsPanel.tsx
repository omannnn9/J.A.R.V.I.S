"use client";

import { useState } from "react";
import type { Profile } from "@/lib/supabase/types";
import { useAudioDevices } from "@/hooks/useAudioDevices";
import { useWakeWordSupport } from "@/hooks/useWakeWord";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";

export function SettingsPanel({
  profile,
  onSave,
  onDataCleared,
}: {
  profile: Profile;
  onSave: (patch: Partial<Profile>) => Promise<void>;
  onDataCleared?: () => void;
}) {
  const [assistantName, setAssistantName] = useState(profile.assistant_name);
  const [displayName, setDisplayName] = useState(profile.display_name);
  const [hue, setHue] = useState(profile.theme_hue);
  const [apiKey, setApiKey] = useState(profile.gemini_api_key ?? "");
  const [showKey, setShowKey] = useState(false);
  const [micLabel, setMicLabel] = useState(profile.mic_device_label ?? "");
  const [speakerLabel, setSpeakerLabel] = useState(profile.speaker_device_label ?? "");
  const [wakeWordEnabled, setWakeWordEnabled] = useState(profile.wake_word_enabled);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [clearing, setClearing] = useState(false);
  const { inputs, outputs, supportsOutputSelection } = useAudioDevices();
  const wakeWordSupported = useWakeWordSupport();

  async function handleExport() {
    setExporting(true);
    const supabase = getSupabaseBrowserClient();
    const [{ data: memories }, { data: reminders }, { data: messages }, { data: watchTopics }] = await Promise.all([
      supabase.from("memories").select("content, created_at").eq("user_id", profile.id),
      supabase.from("reminders").select("text, remind_at, notified, created_at").eq("user_id", profile.id),
      supabase.from("messages").select("role, content, created_at").eq("user_id", profile.id),
      supabase.from("watch_topics").select("topic, last_headline, created_at").eq("user_id", profile.id),
    ]);
    const bundle = {
      exported_at: new Date().toISOString(),
      profile: {
        display_name: profile.display_name,
        assistant_name: profile.assistant_name,
        created_at: profile.created_at,
      },
      memories: memories ?? [],
      reminders: reminders ?? [],
      messages: messages ?? [],
      watched_topics: watchTopics ?? [],
    };
    const blob = new Blob([JSON.stringify(bundle, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `jarvis-data-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
    setExporting(false);
  }

  async function handleClearData() {
    const ok = window.confirm(
      "This permanently deletes everything JARVIS remembers about you — memories, reminders, conversation history, and watched topics. Your login stays active, but the app starts completely fresh. This can't be undone. Continue?"
    );
    if (!ok) return;
    setClearing(true);
    const supabase = getSupabaseBrowserClient();
    await Promise.all([
      supabase.from("memories").delete().eq("user_id", profile.id),
      supabase.from("reminders").delete().eq("user_id", profile.id),
      supabase.from("messages").delete().eq("user_id", profile.id),
      supabase.from("watch_topics").delete().eq("user_id", profile.id),
    ]);
    setClearing(false);
    onDataCleared?.();
  }

  async function handleSave() {
    setSaving(true);
    setSaved(false);
    await onSave({
      assistant_name: assistantName.trim() || "JARVIS",
      display_name: displayName.trim() || "Sir",
      theme_hue: hue,
      gemini_api_key: apiKey.trim() || null,
      mic_device_label: micLabel || null,
      speaker_device_label: speakerLabel || null,
      wake_word_enabled: wakeWordEnabled,
    });
    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }

  return (
    <div className="flex flex-col gap-6 text-sm">
      <Field label="Assistant name">
        <TextInput value={assistantName} onChange={setAssistantName} placeholder="JARVIS" />
      </Field>

      <Field label="Your name">
        <TextInput value={displayName} onChange={setDisplayName} placeholder="Sir" />
      </Field>

      <Field label="Theme color" hint="Retints the whole HUD, live.">
        <div className="flex items-center gap-3">
          <input
            type="range"
            min={0}
            max={360}
            value={hue}
            onChange={(e) => setHue(Number(e.target.value))}
            className="flex-1"
            style={{ accentColor: `hsl(${hue} 100% 50%)` }}
          />
          <span
            className="h-6 w-6 shrink-0 rounded-full border"
            style={{ background: `hsl(${hue} 100% 50%)`, borderColor: "var(--border)" }}
          />
        </div>
      </Field>

      <Field
        label="Gemini API key"
        hint={
          <>
            Free — get one at{" "}
            <a
              href="https://aistudio.google.com/apikey"
              target="_blank"
              rel="noreferrer"
              className="text-[var(--accent)] hover:opacity-80"
            >
              aistudio.google.com/apikey
            </a>
            . Stored on your account only, never shared.
          </>
        }
      >
        <div className="flex gap-2">
          <input
            type={showKey ? "text" : "password"}
            value={apiKey}
            onChange={(e) => setApiKey(e.target.value)}
            placeholder="AIza…"
            className="min-w-0 flex-1 rounded-lg border px-3 py-2.5 font-mono text-xs outline-none focus:border-[var(--accent)]"
            style={{ background: "var(--surface)", borderColor: "var(--border)", color: "var(--text)" }}
          />
          <button
            onClick={() => setShowKey((s) => !s)}
            className="shrink-0 rounded-lg border px-3 text-xs text-[var(--muted)] hover:text-[var(--text)]"
            style={{ borderColor: "var(--border)" }}
          >
            {showKey ? "Hide" : "Show"}
          </button>
        </div>
      </Field>

      <Field label="Microphone" hint="Which input device JARVIS listens through. Falls back to your system default if this one disappears.">
        <SelectInput
          value={micLabel}
          onChange={setMicLabel}
          options={inputs.map((d) => d.label)}
          defaultLabel="System default"
        />
      </Field>

      {supportsOutputSelection && (
        <Field label="Speaker" hint="Which output device JARVIS's voice plays through.">
          <SelectInput
            value={speakerLabel}
            onChange={setSpeakerLabel}
            options={outputs.map((d) => d.label)}
            defaultLabel="System default"
          />
        </Field>
      )}

      {wakeWordSupported && (
        <Field
          label="Wake word"
          hint={`Say "${assistantName || "JARVIS"}" to wake it up while asleep. Uses your browser's built-in speech recognition (Chrome/Edge only) — audio is sent to your browser vendor's speech service while this is on.`}
        >
          <ToggleButton checked={wakeWordEnabled} onChange={setWakeWordEnabled} />
        </Field>
      )}

      <button
        onClick={handleSave}
        disabled={saving}
        className="mt-2 rounded-xl py-3 text-[12px] font-bold tracking-[2px] text-white transition-opacity hover:opacity-90 disabled:opacity-50"
        style={{ background: "var(--accent)" }}
      >
        {saving ? "SAVING…" : saved ? "SAVED ✓" : "SAVE CHANGES"}
      </button>

      <div className="border-t pt-5" style={{ borderColor: "var(--border)" }}>
        <label className="mb-1.5 block text-[11px] font-semibold tracking-wide text-[var(--muted)]">Your data</label>
        <div className="flex gap-2">
          <button
            onClick={handleExport}
            disabled={exporting}
            className="flex-1 rounded-lg border py-2.5 text-xs font-semibold text-[var(--text)] transition-colors hover:border-[var(--accent)] disabled:opacity-50"
            style={{ borderColor: "var(--border)" }}
          >
            {exporting ? "PREPARING…" : "EXPORT AS JSON"}
          </button>
          <button
            onClick={handleClearData}
            disabled={clearing}
            className="flex-1 rounded-lg border py-2.5 text-xs font-semibold transition-colors disabled:opacity-50"
            style={{ borderColor: "var(--red-dim)", color: "var(--red)" }}
          >
            {clearing ? "CLEARING…" : "CLEAR ALL DATA"}
          </button>
        </div>
        <p className="mt-1.5 text-[10.5px] leading-relaxed text-[var(--muted)]">
          Export downloads everything JARVIS knows about you. Clear permanently deletes it — memories, reminders,
          history, watched topics — but keeps your login; there&apos;s no way to delete the account itself from
          inside the app.
        </p>
      </div>

      <p className="text-[11px] leading-relaxed text-[var(--muted)]">
        Running in a browser, JARVIS can&apos;t launch apps, change OS settings, or access files you
        haven&apos;t explicitly shared — that&apos;s a browser security boundary, not a setting. Voice is fixed to
        Charon.
      </p>
    </div>
  );
}

function ToggleButton({ checked, onChange }: { checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      onClick={() => onChange(!checked)}
      className="rounded-lg border px-3 py-2 text-xs font-semibold tracking-wide transition-colors"
      style={{
        borderColor: checked ? "var(--accent-border)" : "var(--border)",
        color: checked ? "var(--accent)" : "var(--muted)",
        background: checked ? "var(--accent-dim)" : "transparent",
      }}
    >
      {checked ? "ON" : "OFF"}
    </button>
  );
}

function Field({ label, hint, children }: { label: string; hint?: React.ReactNode; children: React.ReactNode }) {
  return (
    <div>
      <label className="mb-1.5 block text-[11px] font-semibold tracking-wide text-[var(--muted)]">{label}</label>
      {children}
      {hint && <p className="mt-1.5 text-[10.5px] leading-relaxed text-[var(--muted)]">{hint}</p>}
    </div>
  );
}

function SelectInput({
  value,
  onChange,
  options,
  defaultLabel,
}: {
  value: string;
  onChange: (v: string) => void;
  options: string[];
  defaultLabel: string;
}) {
  // Keep whatever's saved selectable even if it hasn't shown up in this
  // enumeration yet (e.g. mic permission not granted on this page load) —
  // otherwise the picker would look like it silently reset the choice.
  const allOptions = value && !options.includes(value) ? [value, ...options] : options;
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="w-full rounded-lg border px-3 py-2.5 text-sm outline-none focus:border-[var(--accent)]"
      style={{ background: "var(--surface)", borderColor: "var(--border)", color: "var(--text)" }}
    >
      <option value="">{defaultLabel}</option>
      {allOptions.map((label) => (
        <option key={label} value={label}>
          {label}
        </option>
      ))}
    </select>
  );
}

function TextInput({
  value,
  onChange,
  placeholder,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
}) {
  return (
    <input
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      className="w-full rounded-lg border px-3 py-2.5 text-sm outline-none focus:border-[var(--accent)]"
      style={{ background: "var(--surface)", borderColor: "var(--border)", color: "var(--text)" }}
    />
  );
}
