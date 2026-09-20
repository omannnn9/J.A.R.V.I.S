"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth/AuthProvider";
import { useChat } from "@/hooks/useChat";
import { useSpeech } from "@/hooks/useSpeech";
import { useMedia } from "@/hooks/useMedia";
import { useReminderWatcher } from "@/hooks/useReminderWatcher";
import { useToast } from "@/hooks/useToast";
import { Avatar, type AvatarState } from "@/components/hud/Avatar";
import { Header } from "@/components/hud/Header";
import { MessageFeed } from "@/components/hud/MessageFeed";
import { Composer } from "@/components/hud/Composer";
import { Panel } from "@/components/hud/Panel";
import { SettingsPanel } from "@/components/hud/SettingsPanel";
import { MemoryPanel } from "@/components/hud/MemoryPanel";
import { Toast } from "@/components/hud/Toast";
import type { ImageAttachment } from "@/hooks/useChat";

export default function Home() {
  const router = useRouter();
  const { session, user, profile, loading: authLoading, updateProfile, signOut } = useAuth();
  const { messages, sendText, loading: chatLoading, error, clearError, historyLoaded, reloadMemories } = useChat(
    profile,
    user?.id ?? null
  );
  const speech = useSpeech(profile?.voice_name);
  const media = useMedia();
  const { toast, message: toastMessage } = useToast();

  const [settingsOpen, setSettingsOpen] = useState(false);
  const [memoryOpen, setMemoryOpen] = useState(false);
  const [pendingVoiceReply, setPendingVoiceReply] = useState(false);
  const [autoPromptedFor, setAutoPromptedFor] = useState<string | null>(null);

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
    speech.speak(`Reminder: ${text}`);
  });

  useEffect(() => {
    if (error) {
      toast(error);
      const t = setTimeout(clearError, 4000);
      return () => clearTimeout(t);
    }
  }, [error, clearError, toast]);

  if (authLoading || !session || !profile || !historyLoaded) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[var(--bg)]">
        <div className="text-[13px] tracking-[3px] text-[var(--muted)]">LOADING…</div>
      </div>
    );
  }

  const avatarState: AvatarState = chatLoading ? "thinking" : speech.speaking ? "speaking" : speech.listening ? "listening" : "idle";

  async function handleSend(text: string, images: ImageAttachment[], viaVoice = false) {
    if (viaVoice) setPendingVoiceReply(true);
    const reply = await sendText(text, images);
    if (viaVoice && reply) speech.speak(reply);
    setPendingVoiceReply(false);
  }

  function handleMicToggle() {
    if (speech.listening) {
      speech.stopListening();
      return;
    }
    speech.startListening((transcript) => {
      handleSend(transcript, [], true);
    });
  }

  return (
    <div
      className="flex h-screen flex-col overflow-hidden"
      style={{ ["--accent-hue" as string]: profile.theme_hue }}
    >
      <Toast message={toastMessage} />

      <Header
        assistantName={profile.assistant_name}
        state={avatarState}
        onOpenMemory={() => setMemoryOpen(true)}
        onOpenSettings={() => setSettingsOpen(true)}
        onSignOut={async () => {
          await signOut();
          router.replace("/login");
        }}
      />

      <div className="flex shrink-0 items-center justify-center border-b py-4" style={{ borderColor: "var(--border)" }}>
        <Avatar state={avatarState} size={140} />
      </div>

      <MessageFeed messages={messages} loading={chatLoading && !pendingVoiceReply} assistantName={profile.assistant_name} />

      <Composer
        onSend={(text, images) => handleSend(text, images, false)}
        disabled={chatLoading}
        listening={speech.listening}
        sttSupported={speech.sttSupported}
        onMicToggle={handleMicToggle}
        supportsScreenShare={media.supportsScreenShare}
        supportsCamera={media.supportsCamera}
        onScreenCapture={media.captureScreen}
        onCamCapture={media.captureCamera}
      />

      <Panel title="Settings" open={settingsOpen} onClose={() => setSettingsOpen(false)}>
        <SettingsPanel
          profile={profile}
          onSave={async (patch) => {
            await updateProfile(patch);
            toast("Settings saved");
          }}
          onTestVoice={(voiceName) => speech.speakAs(`Hello, I'm ${profile.assistant_name}.`, voiceName)}
        />
      </Panel>

      <Panel title="Memory" open={memoryOpen} onClose={() => setMemoryOpen(false)}>
        <MemoryPanel userId={user!.id} open={memoryOpen} onChanged={reloadMemories} />
      </Panel>
    </div>
  );
}
