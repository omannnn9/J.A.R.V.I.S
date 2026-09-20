"use client";

import { useEffect, useRef, useState } from "react";

// The desktop app's wake word is a local ONNX model (openwakeword) running
// on a background audio thread — genuinely offline. There's no equivalent
// that ships zero-config in a browser sandbox without either a paid
// third-party wake-word service or bundling and serving our own ML model.
// This uses the browser's own built-in continuous speech recognition
// instead: while asleep, it listens for the assistant's name in what it
// hears. It's a real, working wake word, just built on a different
// mechanism — and worth being upfront about the tradeoff: it only exists
// in Chrome/Edge (no Firefox/Safari), and while it's on, audio is sent to
// the browser vendor's speech-recognition service, same as any other use
// of the Web Speech API.

interface MinimalSpeechRecognition extends EventTarget {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  onresult: ((event: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void) | null;
  onerror: ((event: { error: string }) => void) | null;
  onend: (() => void) | null;
  start(): void;
  stop(): void;
}

type SpeechRecognitionCtor = new () => MinimalSpeechRecognition;

function getSpeechRecognitionCtor(): SpeechRecognitionCtor | null {
  if (typeof window === "undefined") return null;
  const w = window as unknown as { SpeechRecognition?: SpeechRecognitionCtor; webkitSpeechRecognition?: SpeechRecognitionCtor };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

export function useWakeWordSupport(): boolean {
  const [supported, setSupported] = useState(false);
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- one-time read of a browser-only API, not derived state
    setSupported(getSpeechRecognitionCtor() !== null);
  }, []);
  return supported;
}

export function useWakeWord({
  enabled,
  assistantName,
  onWake,
}: {
  enabled: boolean;
  assistantName: string;
  onWake: () => void;
}) {
  const onWakeRef = useRef(onWake);
  useEffect(() => {
    onWakeRef.current = onWake;
  }, [onWake]);

  useEffect(() => {
    if (!enabled) return;
    const Ctor = getSpeechRecognitionCtor();
    if (!Ctor) return;

    const phrase = assistantName.trim().toLowerCase();
    if (!phrase) return;

    let stopped = false;
    let restartTimer: ReturnType<typeof setTimeout> | null = null;
    let consecutiveErrors = 0;
    const recognition = new Ctor();
    recognition.continuous = true;
    recognition.interimResults = true;

    recognition.onresult = (event) => {
      for (let i = 0; i < event.results.length; i++) {
        const transcript = event.results[i]?.[0]?.transcript ?? "";
        if (transcript.toLowerCase().includes(phrase)) {
          onWakeRef.current();
          return;
        }
      }
    };

    recognition.onerror = (event) => {
      // "no-speech"/"aborted" are routine on a continuous stream and don't
      // count as failures; anything else (most commonly permission denied)
      // should stop retrying rather than spin forever.
      if (event.error === "no-speech" || event.error === "aborted") return;
      consecutiveErrors += 1;
    };

    recognition.onend = () => {
      if (stopped || consecutiveErrors >= 3) return;
      // Browsers end a continuous session after a period of silence —
      // restart to keep listening.
      restartTimer = setTimeout(() => {
        try {
          recognition.start();
        } catch {
          // Already running or the tab lost mic access — next onend retries.
        }
      }, 300);
    };

    try {
      recognition.start();
    } catch {
      // Ignore — most commonly means it's already running.
    }

    return () => {
      stopped = true;
      if (restartTimer) clearTimeout(restartTimer);
      recognition.onresult = null;
      recognition.onerror = null;
      recognition.onend = null;
      recognition.stop();
    };
  }, [enabled, assistantName]);
}
