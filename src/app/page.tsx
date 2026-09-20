"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth/AuthProvider";
import { useChat } from "@/hooks/useChat";
import { useReminderWatcher } from "@/hooks/useReminderWatcher";
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
import type { ImageAttachment } from "@/hooks/useChat";

export default function Home() {
  const router = useRouter();
  const { session, user, profile, loading: authLoading, updateProfile, signOut } = useAuth();
  const {
    messages,
    sendText,
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
    historyLoaded,
    reloadMemories,
  } = useChat(profile, user?.id ?? null);
  const { toast, message: toastMessage } = useToast();

  const [settingsOpen, setSettingsOpen] = useState(false);
  const [memoryOpen, setMemoryOpen] = useState(false);
  const [autoPromptedFor, setAutoPromptedFor] = useState<string | null>(null);
  const [pendingImages, setPendingImages] = useState<ImageAttachment[]>([]);

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
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [muted, setMuted, interrupt]);

  if (authLoading || !session || !profile || !historyLoaded) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[var(--bg)]">
        <div className="text-[13px] tracking-[3px] text-[var(--muted)]">LOADING…</div>
      </div>
    );
  }

  const avatarState: AvatarState = chatLoading ? "thinking" : speaking ? "speaking" : micOn ? "listening" : "idle";

  function handleSend(text: string, images: ImageAttachment[]) {
    void sendText(text, images);
  }

  return (
    <div
      className="flex h-screen flex-col overflow-hidden text-[var(--text)]"
      style={{ ["--accent-hue" as string]: profile.theme_hue }}
    >
      <Toast message={toastMessage} />

      <TopBar
        assistantName={profile.assistant_name}
        onOpenSettings={() => setSettingsOpen(true)}
        onOpenMemory={() => setMemoryOpen(true)}
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
          className="flex w-full shrink-0 flex-col border-t lg:w-[360px] lg:overflow-y-auto lg:border-l lg:border-t-0 xl:w-[400px]"
          style={{ borderColor: "var(--border)" }}
        >
          <CollapsibleSection title="Activity Log">
            <ActivityLog messages={messages} loading={chatLoading} />
          </CollapsibleSection>

          <CollapsibleSection title="File Upload" defaultOpen={false}>
            <FileUploadZone onFile={(img) => setPendingImages((prev) => [...prev, img])} />
          </CollapsibleSection>

          <CollapsibleSection title="Command Input">
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
              disabled={chatLoading}
              listening={micOn}
              sttSupported={micSupported}
              onMicToggle={() => void toggleMic()}
              onInterrupt={interrupt}
              interruptActive={chatLoading || speaking || micOn}
            />
          </CollapsibleSection>
        </aside>
      </div>

      <footer
        className="flex shrink-0 items-center justify-between border-t px-4 py-1.5 text-[10px] text-[var(--muted)]"
        style={{ borderColor: "var(--border)" }}
      >
        <span>[F4] {muted ? "Unmute" : "Mute"} · [F11] Fullscreen · [ESC] Interrupt</span>
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
        />
      </Panel>

      <Panel title="Memory" open={memoryOpen} onClose={() => setMemoryOpen(false)}>
        <MemoryPanel userId={user!.id} open={memoryOpen} onChanged={reloadMemories} />
      </Panel>
    </div>
  );
}
