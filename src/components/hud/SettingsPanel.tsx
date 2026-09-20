"use client";

import { useState } from "react";
import type { Profile } from "@/lib/supabase/types";

export function SettingsPanel({
  profile,
  onSave,
}: {
  profile: Profile;
  onSave: (patch: Partial<Profile>) => Promise<void>;
}) {
  const [assistantName, setAssistantName] = useState(profile.assistant_name);
  const [displayName, setDisplayName] = useState(profile.display_name);
  const [voiceName, setVoiceName] = useState(profile.voice_name);
  const [hue, setHue] = useState(profile.theme_hue);
  const [apiKey, setApiKey] = useState(profile.gemini_api_key ?? "");
  const [showKey, setShowKey] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  async function handleSave() {
    setSaving(true);
    setSaved(false);
    await onSave({
      assistant_name: assistantName.trim() || "JARVIS",
      display_name: displayName.trim() || "Sir",
      voice_name: voiceName.trim(),
      theme_hue: hue,
      gemini_api_key: apiKey.trim() || null,
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
            style={{ accentColor: `hsl(${hue} 82% 66%)` }}
          />
          <span
            className="h-6 w-6 shrink-0 rounded-full border"
            style={{ background: `hsl(${hue} 82% 66%)`, borderColor: "var(--border)" }}
          />
        </div>
      </Field>

      <Field
        label="Voice"
        hint="A Gemini Live native voice name — e.g. Puck, Charon, Kore, Fenrir, Aoede. Takes effect on your next reconnect (reload the page)."
      >
        <TextInput value={voiceName} onChange={setVoiceName} placeholder="Puck" />
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

      <button
        onClick={handleSave}
        disabled={saving}
        className="mt-2 rounded-xl py-3 text-[12px] font-bold tracking-[2px] text-white transition-opacity hover:opacity-90 disabled:opacity-50"
        style={{ background: "var(--accent)" }}
      >
        {saving ? "SAVING…" : saved ? "SAVED ✓" : "SAVE CHANGES"}
      </button>

      <p className="text-[11px] leading-relaxed text-[var(--muted)]">
        Running in a browser, JARVIS can&apos;t launch apps, change OS settings, or access files you
        haven&apos;t explicitly shared — that&apos;s a browser security boundary, not a setting.
      </p>
    </div>
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
