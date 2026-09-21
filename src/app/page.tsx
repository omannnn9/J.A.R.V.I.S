"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth/AuthProvider";
import { useChat } from "@/hooks/useChat";
import { useProactive } from "@/hooks/useProactive";
import { useReminderWatcher } from "@/hooks/useReminderWatcher";
import { useTopicWatcher } from "@/hooks/useTopicWatcher";
import { useWakeWord } from "@/hooks/useWakeWord";
import { useToast } from "@/hooks/useToast";
import type { AvatarState } from "@/lib/avatarState";
import { TopBar } from "@/components/hud/TopBar";
import { SysMonitorPanel } from "@/components/hud/SysMonitorPanel";
import { StatusButtons } from "@/components/hud/StatusButtons";
import { CenterStage } from "@/components/hud/CenterStage";
import { CollapsibleSection } from "@/components/hud/CollapsibleSection";
import { ActivityLog } from "@/components/hud/ActivityLog";
import { FileUploadZone } from "@/components/hud/FileUploadZone";
import { CommandInput } from "@/components/hud/CommandInput";
import { Panel } from "@/components/hud/Panel";
import { SettingsPanel } from "@/components/hud/SettingsPanel";
import { MemoryPanel } from "@/components/hud/MemoryPanel";
import { Toast } from "@/components/hud/Toast";
import { UndoToast } from "@/components/hud/UndoToast";
import type { ImageAttachment } from "@/hooks/useChat";

export default function Home() {
  const router = useRouter();
  const { session, user, profile, loading: authLoading, updateProfile, signOut } = useAuth();
  const {
    messages,
    sendText,
    triggerProactive,
    loading: chatLoading,
    speaking,
    muted,
    setMuted,
    micOn,
    micSupported,
    toggleMic,
    interrupt,
    error,
    clearError,
    pendingUndo,
    confirmUndo,
    dismissUndo,
    sleepRequestId,
    historyLoaded,
    reloadMemories,
  } = useChat(profile, user?.id ?? null);
  const { toast, message: toastMessage } = useToast();

  const [settingsOpen, setSettingsOpen] = useState(false);
  const [memoryOpen, setMemoryOpen] = useState(false);
  const [autoPromptedFor, setAutoPromptedFor] = useState<string | null>(null);
  const [pendingImages, setPendingImages] = useState<ImageAttachment[]>([]);
  // Starts asleep, same resting state as the desktop app with wake word on
  // — mic stays closed until "Hey Jarvis" or a manual wake.
  const [asleep, setAsleep] = useState(true);
  // Tracks whether the currently-open mic was started by holding the PTT
  // chord, so releasing it only stops mic sessions PTT itself started —
  // never one the user turned on with the manual mic button.
  const pttActiveRef = useRef(false);
  const lastSleepRequestRef = useRef(0);

  useEffect(() => {
    if (!authLoading && !session) router.replace("/login");
  }, [authLoading, session, router]);

  // Prompt for a Gemini key once per freshly-loaded profile that doesn't have one yet.
  if (profile && !profile.gemini_api_key && autoPromptedFor !== profile.id) {
    setAutoPromptedFor(profile.id);
    setSettingsOpen(true);
  }

  useReminderWatcher(user?.id ?? null, (text) => {
    toast(`Reminder: ${text}`);
  });

  useProactive({
    enabled: historyLoaded && !!profile?.gemini_api_key && !asleep,
    messages,
    busy: chatLoading || speaking || micOn,
    trigger: triggerProactive,
  });

  useTopicWatcher(user?.id ?? null, profile?.gemini_api_key ?? null, (topic, headline) => {
    toast(`Update on "${topic}": ${headline}`);
    if (!asleep) {
      triggerProactive(
        `[Internal — background monitor] The topic you're watching, "${topic}", has a new headline: "${headline}". Mention it to the user briefly and naturally.`
      );
    }
  });

  useWakeWord({
    enabled: asleep && !!profile?.wake_word_enabled,
    assistantName: profile?.assistant_name ?? "JARVIS",
    onWake: () => {
      setAsleep(false);
      toast(`${profile?.assistant_name ?? "JARVIS"} is awake.`);
    },
  });

  // Matches the desktop app's wake-word behavior exactly: 2 minutes of
  // silence puts JARVIS back to sleep so it isn't streaming audio for no
  // reason. Only kicks in when wake word is on — otherwise sleeping would
  // strand a user who has no way back in except the manual wake button.
  useEffect(() => {
    if (!historyLoaded || asleep || !profile?.wake_word_enabled) return;
    if (chatLoading || speaking || micOn) return;
    const assistant = profile?.assistant_name ?? "JARVIS";
    const timer = setTimeout(() => {
      interrupt();
      setAsleep(true);
      toast(`${assistant} is asleep — say "Hey ${assistant}" to wake me.`);
    }, 2 * 60_000);
    return () => clearTimeout(timer);
  }, [historyLoaded, asleep, profile?.wake_word_enabled, profile?.assistant_name, chatLoading, speaking, micOn, interrupt, toast]);

  // The model can now actually act on "go to sleep" / "stop listening"
  // instead of just talking as if it had (a real production bug: a user
  // asked JARVIS to sleep, it agreed conversationally, and the mic stayed
  // open picking up ambient audio for minutes afterward). sleepRequestId
  // is a counter, not a boolean, so a ref comparison is needed to catch
  // every real increment rather than relying on the effect's own dep
  // array, which would also re-fire this on unrelated changes like micOn.
  useEffect(() => {
    if (sleepRequestId === lastSleepRequestRef.current) return;
    lastSleepRequestRef.current = sleepRequestId;
    interrupt();
    if (micOn) void toggleMic();
    setAsleep(true);
    const assistant = profile?.assistant_name ?? "JARVIS";
    toast(`${assistant} is asleep — say "Hey ${assistant}" to wake me.`);
  }, [sleepRequestId, micOn, interrupt, toggleMic, toast, profile?.assistant_name]);

  useEffect(() => {
    if (error) {
      toast(error);
      const t = setTimeout(clearError, 4000);
      return () => clearTimeout(t);
    }
  }, [error, clearError, toast]);

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "F4") {
        e.preventDefault();
        setMuted(!muted);
      } else if (e.key === "F11") {
        e.preventDefault();
        if (document.fullscreenElement) document.exitFullscreen();
        else document.documentElement.requestFullscreen().catch(() => {});
      } else if (e.key === "Escape") {
        interrupt();
      } else if (e.key === " " && e.ctrlKey && !e.repeat) {
        // Push-to-talk (Ctrl+Space, held) — window-scoped, same as the
        // desktop app's fallback on platforms without a true global hotkey.
        e.preventDefault();
        if (!asleep && !micOn) {
          pttActiveRef.current = true;
          void toggleMic();
        }
      }
    }
    function onKeyUp(e: KeyboardEvent) {
      if (e.key === " " && pttActiveRef.current) {
        pttActiveRef.current = false;
        if (micOn) void toggleMic();
      }
    }
    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
    };
  }, [muted, setMuted, interrupt, asleep, micOn, toggleMic]);

  if (authLoading || !session || !profile || !historyLoaded) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[var(--bg)]">
        <div className="text-[13px] tracking-[3px] text-[var(--muted)]">LOADING…</div>
      </div>
    );
  }

  const assistantName = profile.assistant_name;

  const avatarState: AvatarState = asleep
    ? "asleep"
    : chatLoading
      ? "thinking"
      : speaking
        ? "speaking"
        : micOn
          ? "listening"
          : "idle";

  function handleSend(text: string, images: ImageAttachment[]) {
    if (asleep) {
      toast(`${assistantName} is asleep — tap 👂 to wake first.`);
      return;
    }
    void sendText(text, images);
  }

  function handleMicToggle() {
    if (asleep) {
      toast(`${assistantName} is asleep — tap 👂 to wake first.`);
      return;
    }
    void toggleMic();
  }

  function toggleSleep() {
    if (asleep) {
      setAsleep(false);
      toast(`${assistantName} is awake.`);
      return;
    }
    interrupt();
    if (micOn) void toggleMic();
    setAsleep(true);
    toast(`${assistantName} is asleep — tap 👂 to wake.`);
  }

  return (
    <div
      className="flex h-screen flex-col overflow-hidden text-[var(--text)]"
      style={{ ["--accent-hue" as string]: profile.theme_hue }}
    >
      <Toast message={toastMessage} />
      <UndoToast pending={pendingUndo} onUndo={() => void confirmUndo()} onDismiss={dismissUndo} />

      <TopBar
        assistantName={profile.assistant_name}
        onOpenSettings={() => setSettingsOpen(true)}
        onOpenMemory={() => setMemoryOpen(true)}
        asleep={asleep}
        onToggleSleep={toggleSleep}
        muted={muted}
        onToggleMute={() => setMuted(!muted)}
      />

      <div className="flex min-h-0 flex-1 flex-col overflow-y-auto lg:flex-row lg:overflow-hidden">
        <aside
          className="hidden w-[230px] shrink-0 flex-col justify-between overflow-y-auto border-r p-4 lg:flex"
          style={{ borderColor: "var(--border)" }}
        >
          <SysMonitorPanel />
          <div className="mt-4">
            <StatusButtons aiCoreActive={!!profile.gemini_api_key} />
          </div>
        </aside>

        <main className="min-w-0 shrink-0 lg:flex-1 lg:overflow-y-auto">
          <CenterStage state={avatarState} />
        </main>

        <aside
          className="flex min-h-0 w-full shrink-0 flex-1 flex-col border-t lg:w-[360px] lg:flex-none lg:overflow-y-auto lg:border-l lg:border-t-0 xl:w-[400px]"
          style={{ borderColor: "var(--border)" }}
        >
          <div className="min-h-0 flex-1 lg:flex-none">
            <CollapsibleSection title="Activity Log">
              <ActivityLog
                messages={messages}
                loading={chatLoading}
                assistantName={assistantName}
                asleep={asleep}
                wakeWordEnabled={!!profile.wake_word_enabled}
              />
            </CollapsibleSection>

            <CollapsibleSection title="File Upload" defaultOpen={false}>
              <FileUploadZone onFile={(img) => setPendingImages((prev) => [...prev, img])} />
            </CollapsibleSection>
          </div>

          {/* Always visible, never collapsed — this is the primary way to talk
              to JARVIS, so it shouldn't be one accordion tap away. On mobile
              it sticks to the bottom of the scrolling column instead of
              landing wherever the log/upload sections happen to end. */}
          <div
            className="sticky bottom-0 z-10 border-t px-4 py-2.5 lg:static"
            style={{ borderColor: "var(--border)", background: "var(--bg)" }}
          >
            <div className="mb-1.5 text-[11px] font-bold uppercase tracking-[2px] text-[var(--accent)]">
              Command Input
            </div>
            {pendingImages.length > 0 && (
              <div className="mb-2 flex flex-wrap gap-1.5">
                {pendingImages.map((img, i) => (
                  <span
                    key={i}
                    className="rounded border px-2 py-0.5 text-[10px] text-[var(--muted)]"
                    style={{ borderColor: "var(--border)" }}
                  >
                    📎 {img.label ?? "image"}
                  </span>
                ))}
              </div>
            )}
            <CommandInput
              onSend={(text) => {
                handleSend(text, pendingImages);
                setPendingImages([]);
              }}
              disabled={chatLoading || asleep}
              listening={micOn}
              sttSupported={micSupported}
              onMicToggle={handleMicToggle}
              onInterrupt={interrupt}
              interruptActive={chatLoading || speaking || micOn}
            />
          </div>
        </aside>
      </div>

      <footer
        className="flex shrink-0 items-center justify-between border-t px-4 py-1.5 text-[10px] text-[var(--muted)]"
        style={{ borderColor: "var(--border)" }}
      >
        <span className="hidden sm:inline">
          [F4] {muted ? "Unmute" : "Mute"} · [F11] Fullscreen · [ESC] Interrupt
        </span>
        <button onClick={() => signOut().then(() => router.replace("/login"))} className="hover:text-[var(--text)]">
          Sign out
        </button>
      </footer>

      <Panel title="Settings" open={settingsOpen} onClose={() => setSettingsOpen(false)}>
        <SettingsPanel
          profile={profile}
          onSave={async (patch) => {
            await updateProfile(patch);
            toast("Settings saved — reconnect (reload) for a new voice to take effect");
          }}
          onDataCleared={() => {
            setSettingsOpen(false);
            window.location.reload();
          }}
        />
      </Panel>

      <Panel title="Memory & Alerts" open={memoryOpen} onClose={() => setMemoryOpen(false)}>
        <MemoryPanel userId={user!.id} open={memoryOpen} onChanged={reloadMemories} />
      </Panel>
    </div>
  );
}
