"use client";

import { useCallback, useRef, useState } from "react";

type SpeechRecognitionLike = {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  start: () => void;
  stop: () => void;
  abort: () => void;
  onresult: ((event: unknown) => void) | null;
  onerror: ((event: unknown) => void) | null;
  onend: (() => void) | null;
};

function getRecognitionCtor(): (new () => SpeechRecognitionLike) | null {
  if (typeof window === "undefined") return null;
  const w = window as unknown as Record<string, unknown>;
  return (w.SpeechRecognition || w.webkitSpeechRecognition || null) as
    | (new () => SpeechRecognitionLike)
    | null;
}

export function useSpeech(voiceName?: string) {
  const [listening, setListening] = useState(false);
  const [speaking, setSpeaking] = useState(false);
  const [sttSupported] = useState(() => !!getRecognitionCtor());
  const [ttsSupported] = useState(() => typeof window !== "undefined" && "speechSynthesis" in window);
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);

  const startListening = useCallback((onResult: (text: string) => void, onEnd?: () => void) => {
    const Ctor = getRecognitionCtor();
    if (!Ctor) return false;

    // interrupt any speech so JARVIS doesn't hear itself
    if (typeof window !== "undefined" && "speechSynthesis" in window) {
      window.speechSynthesis.cancel();
    }

    const rec = new Ctor();
    rec.continuous = false;
    rec.interimResults = false;
    rec.lang = typeof navigator !== "undefined" ? navigator.language || "en-US" : "en-US";

    rec.onresult = (event: unknown) => {
      const e = event as { results: { transcript: string }[][] };
      const transcript = Array.from(e.results)
        .map((r) => r[0].transcript)
        .join(" ")
        .trim();
      if (transcript) onResult(transcript);
    };
    rec.onerror = () => {
      setListening(false);
    };
    rec.onend = () => {
      setListening(false);
      onEnd?.();
    };

    recognitionRef.current = rec;
    setListening(true);
    try {
      rec.start();
    } catch {
      setListening(false);
      return false;
    }
    return true;
  }, []);

  const stopListening = useCallback(() => {
    recognitionRef.current?.stop();
    setListening(false);
  }, []);

  const speakAs = useCallback(
    (text: string, voiceOverride?: string, onDone?: () => void) => {
      if (typeof window === "undefined" || !("speechSynthesis" in window) || !text) {
        onDone?.();
        return;
      }
      window.speechSynthesis.cancel();
      const utter = new SpeechSynthesisUtterance(text);
      const voices = window.speechSynthesis.getVoices();
      const wanted = voiceOverride ?? voiceName;
      if (wanted) {
        const match = voices.find((v) => v.name.toLowerCase().includes(wanted.toLowerCase()));
        if (match) utter.voice = match;
      }
      utter.rate = 1.02;
      utter.pitch = 1;
      utter.onstart = () => setSpeaking(true);
      utter.onend = () => {
        setSpeaking(false);
        onDone?.();
      };
      utter.onerror = () => {
        setSpeaking(false);
        onDone?.();
      };
      window.speechSynthesis.speak(utter);
    },
    [voiceName]
  );

  const speak = useCallback((text: string, onDone?: () => void) => speakAs(text, undefined, onDone), [speakAs]);

  const stopSpeaking = useCallback(() => {
    if (typeof window !== "undefined" && "speechSynthesis" in window) {
      window.speechSynthesis.cancel();
    }
    setSpeaking(false);
  }, []);

  return {
    listening,
    speaking,
    sttSupported,
    ttsSupported,
    startListening,
    stopListening,
    speak,
    speakAs,
    stopSpeaking,
  };
}
