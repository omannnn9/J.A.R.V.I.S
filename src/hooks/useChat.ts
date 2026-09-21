"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  Modality,
  type Content,
  type LiveConnectConfig,
  type LiveServerMessage,
  type Part,
  type Session,
} from "@google/genai";
import { getGenAI, DEFAULT_LIVE_MODEL } from "@/lib/gemini/client";
import { executeTool, toolDeclarations } from "@/lib/actions/tools";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import { floatTo16BitPCM, int16ToBase64, base64ToInt16, int16ToFloat32, resampleTo16k } from "@/lib/gemini/pcm";
import { resetLipSync, scheduleTextSpan, stopLipSync } from "@/lib/head/lipSyncBus";
import { resolveDeviceIdByLabel } from "@/lib/audio/devices";
import type { Profile } from "@/lib/supabase/types";

export interface ChatMessage {
  id: string;
  role: "user" | "assistant" | "system";
  text: string;
  ts: number;
  // Session-only — a generated image is never persisted (a data URL is far
  // too large for a text column), so this is unset again after a reload;
  // the text caption alone is what survives in history.
  imageDataUrl?: string;
}

export interface ImageAttachment {
  mimeType: string;
  data: string; // base64, no data: prefix
  label?: string;
}

const OUTPUT_SAMPLE_RATE = 24000;

function buildSystemInstruction(profile: Profile, memories: string[]): string {
  const lines = [
    `You are ${profile.assistant_name}, an advanced, capable personal AI assistant running inside a website, speaking with ${profile.display_name}.`,
    `You are warm, sharp, a little witty, and extremely competent — inspired by the classic "JARVIS" archetype: calm, proactive, precise.`,
    `You are running in a web browser, not on the user's operating system. You cannot launch native apps, control the OS, change system settings, or access files outside what the user explicitly shares with you (uploads, screen share, webcam, clipboard). If asked to do something like that, say plainly that it's outside what a website is allowed to do in a browser, and offer the closest thing you can actually do instead.`,
    `You have tools for: weather, remembering/recalling/forgetting facts about the user, setting/listing/cancelling reminders, searching the live web, opening YouTube searches, and opening links. Use them proactively whenever relevant — don't ask permission for read-only actions like checking weather or searching.`,
    `Keep replies concise and natural — you're speaking them aloud, not writing an essay.`,
  ];
  if (memories.length) {
    lines.push(`\nWhat you remember about ${profile.display_name}:`);
    for (const m of memories) lines.push(`- ${m}`);
  }
  return lines.join("\n");
}

export function useChat(profile: Profile | null, userId: string | null) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [loading, setLoading] = useState(false);
  const [speaking, setSpeaking] = useState(false);
  const [muted, setMutedState] = useState(false);
  const mutedRef = useRef(false);
  const [micOn, setMicOn] = useState(false);
  const [micSupported] = useState(
    () => typeof navigator !== "undefined" && !!navigator.mediaDevices?.getUserMedia
  );
  const [error, setError] = useState<string | null>(null);
  const [pendingUndo, setPendingUndo] = useState<{ message: string; restore: () => Promise<void> } | null>(null);
  const undoTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [historyLoaded, setHistoryLoaded] = useState(false);
  const memoriesRef = useRef<string[]>([]);

  const sessionRef = useRef<Session | null>(null);
  const connectingRef = useRef<Promise<Session> | null>(null);
  // Created once per connection, reused for tool calls (e.g. web_search's
  // own inner generateContent call).
  const genAIClientRef = useRef<ReturnType<typeof getGenAI> | null>(null);
  const profileRef = useRef(profile);
  const userIdRef = useRef(userId);
  useEffect(() => {
    profileRef.current = profile;
    userIdRef.current = userId;
  }, [profile, userId]);

  // Playback (Gemini's own voice, 24kHz PCM streamed in)
  const playbackCtxRef = useRef<AudioContext | null>(null);
  const nextStartTimeRef = useRef(0);
  const activeSourcesRef = useRef<Set<AudioBufferSourceNode>>(new Set());
  const ignoreAudioRef = useRef(false);
  const lipCursorMsRef = useRef(0);
  const turnActiveRef = useRef(false);
  // Preview-only fields (proactive audio, v1alpha) get dropped after the
  // first handshake refusal — see attemptConnect/connect below.
  const liveDegradedRef = useRef(false);
  // Session-resumption handle from the server's last sessionResumptionUpdate,
  // handed back on the next connect so a reconnect can pick the conversation
  // back up instead of starting cold.
  const resumeHandleRef = useRef<string | undefined>(undefined);

  // Mic capture (this session's audio, 16kHz PCM streamed out)
  const micStreamRef = useRef<MediaStream | null>(null);
  const micCtxRef = useRef<AudioContext | null>(null);
  const micNodeRef = useRef<ScriptProcessorNode | null>(null);

  // Per-turn transcript accumulators
  const inputTranscriptRef = useRef("");
  const outputTranscriptRef = useRef("");

  const supabase = getSupabaseBrowserClient();

  const loadMemories = useCallback(async () => {
    if (!userId) return;
    const { data } = await supabase
      .from("memories")
      .select("content")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(40);
    memoriesRef.current = data?.map((m) => m.content) ?? [];
  }, [userId, supabase]);

  useEffect(() => {
    if (!userId) return;
    (async () => {
      await loadMemories();
      const { data } = await supabase
        .from("messages")
        .select("id, role, content, created_at")
        .eq("user_id", userId)
        .order("created_at", { ascending: true })
        .limit(200);
      if (data) {
        setMessages(
          data.map((m) => ({
            id: m.id,
            role: m.role,
            text: m.content,
            ts: new Date(m.created_at).getTime(),
          }))
        );
      }
      setHistoryLoaded(true);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId]);

  const persist = useCallback(
    async (role: ChatMessage["role"], text: string) => {
      if (!userIdRef.current) return;
      await supabase.from("messages").insert({ user_id: userIdRef.current, role, content: text });
    },
    [supabase]
  );

  const appendMessage = useCallback(
    (role: ChatMessage["role"], text: string, imageDataUrl?: string) => {
      const msg: ChatMessage = { id: crypto.randomUUID(), role, text, ts: Date.now(), imageDataUrl };
      setMessages((prev) => [...prev, msg]);
      void persist(role, text);
    },
    [persist]
  );

  const stopAllPlayback = useCallback(() => {
    for (const src of activeSourcesRef.current) {
      try {
        src.stop();
      } catch {
        // already stopped
      }
    }
    activeSourcesRef.current.clear();
    if (playbackCtxRef.current) nextStartTimeRef.current = playbackCtxRef.current.currentTime;
    setSpeaking(false);
    stopLipSync();
    turnActiveRef.current = false;
  }, []);

  const playChunk = useCallback((base64Pcm: string) => {
    if (ignoreAudioRef.current || mutedRef.current) return;
    if (!playbackCtxRef.current) {
      const ctx = new AudioContext({ sampleRate: OUTPUT_SAMPLE_RATE });
      playbackCtxRef.current = ctx;
      nextStartTimeRef.current = ctx.currentTime;

      const speakerLabel = profileRef.current?.speaker_device_label;
      if (speakerLabel && "setSinkId" in ctx) {
        void resolveDeviceIdByLabel("audiooutput", speakerLabel).then((deviceId) => {
          if (!deviceId || playbackCtxRef.current !== ctx) return;
          (ctx as AudioContext & { setSinkId(id: string): Promise<void> }).setSinkId(deviceId).catch(() => {
            // Saved output device no longer exists — stay on the default.
          });
        });
      }
    }
    const ctx = playbackCtxRef.current;
    if (ctx.state === "suspended") void ctx.resume();

    const f32 = int16ToFloat32(base64ToInt16(base64Pcm));
    const buffer = ctx.createBuffer(1, f32.length, OUTPUT_SAMPLE_RATE);
    buffer.copyToChannel(f32 as Float32Array<ArrayBuffer>, 0);
    const src = ctx.createBufferSource();
    src.buffer = buffer;
    src.connect(ctx.destination);

    const startAt = Math.max(ctx.currentTime, nextStartTimeRef.current);
    src.start(startAt);
    nextStartTimeRef.current = startAt + buffer.duration;

    activeSourcesRef.current.add(src);
    setSpeaking(true);
    src.onended = () => {
      activeSourcesRef.current.delete(src);
      if (activeSourcesRef.current.size === 0) setSpeaking(false);
    };

    if (!turnActiveRef.current) {
      turnActiveRef.current = true;
      resetLipSync();
      lipCursorMsRef.current = performance.now();
    }
  }, []);

  const feedLipSyncText = useCallback((delta: string) => {
    const text = delta.trim();
    if (!text) return;
    const cps = 13;
    const durMs = Math.max(120, (text.length / cps) * 1000);
    const startMs = Math.max(lipCursorMsRef.current, performance.now());
    scheduleTextSpan(text, startMs, durMs);
    lipCursorMsRef.current = startMs + durMs;
  }, []);

  const showUndo = useCallback((message: string, restore: () => Promise<void>) => {
    if (undoTimerRef.current) clearTimeout(undoTimerRef.current);
    setPendingUndo({ message, restore });
    undoTimerRef.current = setTimeout(() => setPendingUndo(null), 8000);
  }, []);

  const confirmUndo = useCallback(async () => {
    if (!pendingUndo) return;
    if (undoTimerRef.current) clearTimeout(undoTimerRef.current);
    await pendingUndo.restore();
    setPendingUndo(null);
    void loadMemories();
  }, [pendingUndo, loadMemories]);

  const dismissUndo = useCallback(() => {
    if (undoTimerRef.current) clearTimeout(undoTimerRef.current);
    setPendingUndo(null);
  }, []);

  const handleToolCalls = useCallback(
    async (calls: { id?: string; name?: string; args?: Record<string, unknown> }[]) => {
      const session = sessionRef.current;
      const genAI = genAIClientRef.current;
      if (!session || !genAI || !userIdRef.current) return;
      const responses = await Promise.all(
        calls.map(async (call) => {
          const result = await executeTool(call.name ?? "", call.args ?? {}, {
            userId: userIdRef.current!,
            genAI,
            onGeneratedImage: (dataUrl, prompt) => appendMessage("assistant", `Generated image: ${prompt}`, dataUrl),
            onUndoableDelete: showUndo,
          });
          if (call.name === "remember_fact" || call.name === "forget_fact") void loadMemories();
          return { id: call.id, name: call.name, response: { result } };
        })
      );
      session.sendToolResponse({ functionResponses: responses });
    },
    [loadMemories, appendMessage, showUndo]
  );

  const finalizeTurn = useCallback(() => {
    const inputText = inputTranscriptRef.current.trim();
    const outputText = outputTranscriptRef.current.trim();
    inputTranscriptRef.current = "";
    outputTranscriptRef.current = "";
    if (inputText) appendMessage("user", inputText);
    if (outputText) appendMessage("assistant", outputText);
    stopLipSync();
    turnActiveRef.current = false;
    setLoading(false);
  }, [appendMessage]);

  const handleServerMessage = useCallback(
    (message: LiveServerMessage) => {
      if (message.toolCall?.functionCalls?.length) {
        void handleToolCalls(message.toolCall.functionCalls);
      }

      if (message.sessionResumptionUpdate?.resumable && message.sessionResumptionUpdate.newHandle) {
        resumeHandleRef.current = message.sessionResumptionUpdate.newHandle;
      }

      const sc = message.serverContent;
      if (!sc) return;

      if (sc.interrupted) {
        stopAllPlayback();
        ignoreAudioRef.current = false;
      }

      if (sc.inputTranscription?.text) {
        inputTranscriptRef.current += sc.inputTranscription.text;
      }
      if (sc.outputTranscription?.text) {
        outputTranscriptRef.current += sc.outputTranscription.text;
        if (!mutedRef.current) feedLipSyncText(sc.outputTranscription.text);
      }

      const parts = sc.modelTurn?.parts ?? [];
      for (const part of parts) {
        if (part.inlineData?.data) playChunk(part.inlineData.data);
      }

      if (sc.turnComplete) finalizeTurn();
    },
    [handleToolCalls, stopAllPlayback, feedLipSyncText, playChunk, finalizeTurn]
  );

  // ai.live.connect()'s own promise only ever resolves — a dead socket is
  // reported solely through onerror/onclose, asynchronously, after sendText
  // or toggleMic have already moved on. Without this, a failed connection
  // left `loading` stuck true forever (nothing was left to flip it back)
  // and a live mic stream stuck "on" over a socket that can no longer take
  // audio.
  const abortInFlight = useCallback(() => {
    if (turnActiveRef.current) {
      stopAllPlayback();
      stopLipSync();
      turnActiveRef.current = false;
    }
    setLoading(false);
    if (micNodeRef.current) {
      micNodeRef.current.disconnect();
      micNodeRef.current = null;
      micStreamRef.current?.getTracks().forEach((t) => t.stop());
      micStreamRef.current = null;
      if (micCtxRef.current) void micCtxRef.current.close();
      micCtxRef.current = null;
      setMicOn(false);
    }
  }, [stopAllPlayback]);

  // ai.live.connect()'s own promise internally awaits the WebSocket's open
  // event before ever resolving — if the handshake is refused (wrong model,
  // wrong api version, no access), that promise hangs forever rather than
  // rejecting. We build our own promise around it instead: settle it the
  // moment onopen/onerror/onclose tell us the true outcome, and let the
  // SDK's own promise resolve whenever it likes (it always does so *after*
  // onopen, so by then our promise has already settled the same way).
  const attemptConnect = useCallback(
    (apiVersion: "v1alpha" | "v1beta"): Promise<Session> => {
      const p = profileRef.current;
      if (!p?.gemini_api_key) {
        return Promise.reject(new Error("Add your Gemini API key in Settings to start talking."));
      }

      const genAI = getGenAI(p.gemini_api_key, apiVersion);
      genAIClientRef.current = getGenAI(p.gemini_api_key);
      const systemInstruction = buildSystemInstruction(p, memoriesRef.current);

      const config: LiveConnectConfig = {
        responseModalities: [Modality.AUDIO],
        // Voice is locked to Charon — not user-configurable.
        speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: "Charon" } } },
        systemInstruction,
        tools: [{ functionDeclarations: toolDeclarations }],
        inputAudioTranscription: {},
        outputAudioTranscription: {},
        sessionResumption: { handle: resumeHandleRef.current },
        contextWindowCompression: { slidingWindow: {} },
      };
      // Proactive audio (JARVIS stays silent when speech isn't addressed to
      // it) is a v1alpha-only preview field — only offered on the first,
      // un-degraded attempt.
      if (apiVersion === "v1alpha") {
        config.proactivity = { proactiveAudio: true };
      }

      return new Promise<Session>((resolve, reject) => {
        let settled = false;
        genAI.live
          .connect({
            model: DEFAULT_LIVE_MODEL,
            config,
            callbacks: {
              onmessage: handleServerMessage,
              onerror: () => {
                sessionRef.current = null;
                if (!settled) {
                  settled = true;
                  reject(new Error("Live voice connection failed."));
                  return;
                }
                setError("Live voice connection failed — check your Gemini API key and network.");
                abortInFlight();
              },
              onclose: () => {
                sessionRef.current = null;
                if (!settled) {
                  settled = true;
                  reject(new Error("Live voice connection closed before it opened."));
                  return;
                }
                abortInFlight();
              },
            },
          })
          .then((session) => {
            settled = true;
            sessionRef.current = session;
            resolve(session);
          })
          .catch((e) => {
            if (!settled) {
              settled = true;
              reject(e);
            }
          });
      });
    },
    [handleServerMessage, abortInFlight]
  );

  // The first attempt asks for the preview-only fields (proactive audio,
  // v1alpha); if the handshake itself is refused — a preview field this key
  // or region doesn't have — we drop them and retry once on the stable
  // v1beta config, mirroring the desktop app's own enhanced-live fallback.
  const connect = useCallback((): Promise<Session> => {
    if (sessionRef.current) return Promise.resolve(sessionRef.current);
    if (connectingRef.current) return connectingRef.current;

    const promise = (async () => {
      try {
        try {
          return await attemptConnect(liveDegradedRef.current ? "v1beta" : "v1alpha");
        } catch {
          if (liveDegradedRef.current) {
            setError("Live voice connection failed — check your Gemini API key and network.");
            throw new Error("Live voice connection failed.");
          }
          liveDegradedRef.current = true;
          try {
            return await attemptConnect("v1beta");
          } catch {
            setError("Live voice connection failed — check your Gemini API key and network.");
            throw new Error("Live voice connection failed.");
          }
        }
      } finally {
        // Runs before this promise settles, so by the time a caller's catch
        // block (or a fresh connect() call) sees the outcome, the ref is
        // already clear — a retry never returns this dead promise.
        connectingRef.current = null;
      }
    })();

    connectingRef.current = promise;
    return promise;
  }, [attemptConnect]);

  const sendText = useCallback(
    async (text: string, images?: ImageAttachment[]): Promise<string | null> => {
      if (!userIdRef.current) return null;
      setError(null);

      appendMessage("user", text);
      setLoading(true);

      try {
        const session = await connect();
        const parts: Part[] = [{ text }];
        for (const img of images ?? []) parts.push({ inlineData: { mimeType: img.mimeType, data: img.data } });
        const turn: Content = { role: "user", parts };
        session.sendClientContent({ turns: [turn], turnComplete: true });
        return null; // reply arrives asynchronously via handleServerMessage/finalizeTurn
      } catch (e) {
        const msg = e instanceof Error ? e.message : "Something went wrong talking to Gemini.";
        setError(msg);
        setLoading(false);
        return null;
      }
    },
    [connect, appendMessage]
  );

  // An internal nudge, not something the user said — used by the proactive
  // idle check-in. Never logged as a user message (nothing to show), never
  // persisted; only the model's resulting reply (if any) becomes a real
  // message, through the normal handleServerMessage/finalizeTurn path.
  const triggerProactive = useCallback(
    async (promptText: string) => {
      if (!userIdRef.current) return;
      try {
        const session = await connect();
        const turn: Content = { role: "user", parts: [{ text: promptText }] };
        session.sendClientContent({ turns: [turn], turnComplete: true });
      } catch {
        // A background nudge failing silently is correct — this was never
        // something the user asked for, so it shouldn't surface an error.
      }
    },
    [connect]
  );

  const toggleMic = useCallback(async () => {
    if (micOn) {
      micNodeRef.current?.disconnect();
      micNodeRef.current = null;
      micStreamRef.current?.getTracks().forEach((t) => t.stop());
      micStreamRef.current = null;
      if (micCtxRef.current) void micCtxRef.current.close();
      micCtxRef.current = null;
      sessionRef.current?.sendRealtimeInput({ audioStreamEnd: true });
      setMicOn(false);
      return;
    }

    try {
      setError(null);
      const session = await connect();
      const micDeviceId = await resolveDeviceIdByLabel("audioinput", profileRef.current?.mic_device_label);
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          channelCount: 1,
          echoCancellation: true,
          noiseSuppression: true,
          ...(micDeviceId ? { deviceId: { exact: micDeviceId } } : {}),
        },
      });
      const ctx = new AudioContext();
      if (ctx.state === "suspended") await ctx.resume();
      const source = ctx.createMediaStreamSource(stream);
      const processor = ctx.createScriptProcessor(4096, 1, 1);
      processor.onaudioprocess = (e) => {
        const input = e.inputBuffer.getChannelData(0);
        const resampled = resampleTo16k(input, ctx.sampleRate);
        const pcm16 = floatTo16BitPCM(resampled);
        session.sendRealtimeInput({ audio: { data: int16ToBase64(pcm16), mimeType: "audio/pcm;rate=16000" } });
      };
      source.connect(processor);
      processor.connect(ctx.destination);

      micStreamRef.current = stream;
      micCtxRef.current = ctx;
      micNodeRef.current = processor;
      setMicOn(true);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Couldn't access the microphone.";
      setError(msg);
    }
  }, [micOn, connect]);

  const interrupt = useCallback(() => {
    ignoreAudioRef.current = true;
    stopAllPlayback();
    setTimeout(() => {
      ignoreAudioRef.current = false;
    }, 400);
  }, [stopAllPlayback]);

  const setMuted = useCallback(
    (next: boolean) => {
      mutedRef.current = next;
      setMutedState(next);
      if (next) stopAllPlayback();
    },
    [stopAllPlayback]
  );

  useEffect(() => {
    return () => {
      sessionRef.current?.close();
      micNodeRef.current?.disconnect();
      micStreamRef.current?.getTracks().forEach((t) => t.stop());
      if (micCtxRef.current) void micCtxRef.current.close();
      if (playbackCtxRef.current) void playbackCtxRef.current.close();
      if (undoTimerRef.current) clearTimeout(undoTimerRef.current);
    };
  }, []);

  const clearError = useCallback(() => setError(null), []);

  return {
    messages,
    sendText,
    triggerProactive,
    loading,
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
    historyLoaded,
    reloadMemories: loadMemories,
  };
}
