"use client";

import { useRef, useState } from "react";
import type { ImageAttachment } from "@/hooks/useChat";

interface ComposerProps {
  onSend: (text: string, images: ImageAttachment[]) => void;
  disabled?: boolean;
  listening: boolean;
  sttSupported: boolean;
  onMicToggle: () => void;
  supportsScreenShare: boolean;
  supportsCamera: boolean;
  onScreenCapture: () => Promise<ImageAttachment | null>;
  onCamCapture: () => Promise<ImageAttachment | null>;
}

function fileToImage(file: File): Promise<ImageAttachment | null> {
  return new Promise((resolve) => {
    if (!file.type.startsWith("image/")) {
      resolve(null);
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      const result = String(reader.result || "");
      const [, base64] = result.split(",");
      resolve({ mimeType: file.type, data: base64, label: file.name });
    };
    reader.onerror = () => resolve(null);
    reader.readAsDataURL(file);
  });
}

export function Composer({
  onSend,
  disabled,
  listening,
  sttSupported,
  onMicToggle,
  supportsScreenShare,
  supportsCamera,
  onScreenCapture,
  onCamCapture,
}: ComposerProps) {
  const [text, setText] = useState("");
  const [images, setImages] = useState<ImageAttachment[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  function submit() {
    const trimmed = text.trim();
    if (!trimmed && images.length === 0) return;
    onSend(trimmed || "(shared an image)", images);
    setText("");
    setImages([]);
  }

  async function handleFiles(files: FileList | null) {
    if (!files) return;
    const converted = await Promise.all(Array.from(files).map(fileToImage));
    setImages((prev) => [...prev, ...converted.filter((i): i is ImageAttachment => !!i)]);
  }

  return (
    <footer className="shrink-0 border-t px-3 py-3 sm:px-5" style={{ borderColor: "var(--border)", background: "rgba(7,9,15,0.95)" }}>
      {images.length > 0 && (
        <div className="mx-auto mb-2 flex max-w-2xl flex-wrap gap-2">
          {images.map((img, i) => (
            <div key={i} className="relative">
              {/* eslint-disable-next-line @next/next/no-img-element -- dynamic base64 data URL, not a static asset */}
              <img
                src={`data:${img.mimeType};base64,${img.data}`}
                alt={img.label ?? "attachment"}
                className="h-14 w-14 rounded-lg border object-cover"
                style={{ borderColor: "var(--border)" }}
              />
              <button
                onClick={() => setImages((prev) => prev.filter((_, j) => j !== i))}
                className="absolute -right-1.5 -top-1.5 flex h-4.5 w-4.5 items-center justify-center rounded-full bg-black/80 text-[10px] text-white"
              >
                ×
              </button>
            </div>
          ))}
        </div>
      )}

      <div className="mx-auto flex max-w-2xl items-center gap-2">
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              submit();
            }
          }}
          placeholder={listening ? "Listening…" : "Send a command to JARVIS…"}
          disabled={disabled}
          className="min-w-0 flex-1 rounded-xl border-[1.5px] px-3.5 py-2.5 text-sm outline-none transition-colors focus:border-[var(--accent)]"
          style={{ background: "var(--surface)", borderColor: "var(--border)", color: "var(--text)" }}
        />

        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          multiple
          className="hidden"
          onChange={(e) => {
            handleFiles(e.target.files);
            e.target.value = "";
          }}
        />
        <IconButton title="Attach image" onClick={() => fileInputRef.current?.click()}>
          📎
        </IconButton>

        {supportsScreenShare && (
          <IconButton
            title="Show JARVIS your screen"
            onClick={async () => {
              const shot = await onScreenCapture();
              if (shot) setImages((prev) => [...prev, shot]);
            }}
          >
            🖥️
          </IconButton>
        )}

        {supportsCamera && (
          <IconButton
            title="Show JARVIS your camera"
            onClick={async () => {
              const shot = await onCamCapture();
              if (shot) setImages((prev) => [...prev, shot]);
            }}
          >
            📷
          </IconButton>
        )}

        {sttSupported && (
          <IconButton title="Voice — tap to speak" onClick={onMicToggle} active={listening} activeColor="#ef4444">
            {listening ? "⏹" : "🎤"}
          </IconButton>
        )}

        <button
          onClick={submit}
          disabled={disabled}
          className="shrink-0 rounded-xl px-4 py-2.5 text-[11px] font-bold tracking-[1.5px] text-white transition-opacity hover:opacity-85 active:scale-95 disabled:opacity-50"
          style={{ background: "var(--accent)" }}
        >
          SEND
        </button>
      </div>
    </footer>
  );
}

function IconButton({
  children,
  onClick,
  title,
  active,
  activeColor,
}: {
  children: React.ReactNode;
  onClick: () => void;
  title: string;
  active?: boolean;
  activeColor?: string;
}) {
  return (
    <button
      title={title}
      onClick={onClick}
      className={`flex h-[42px] w-[42px] shrink-0 items-center justify-center rounded-xl border text-base transition-transform active:scale-95 ${
        active ? "animate-[mic-pulse_1s_ease-in-out_infinite]" : ""
      }`}
      style={{
        background: active ? `color-mix(in srgb, ${activeColor ?? "var(--accent)"} 15%, transparent)` : "var(--surface)",
        borderColor: active ? `color-mix(in srgb, ${activeColor ?? "var(--accent)"} 45%, transparent)` : "var(--border)",
        color: active ? activeColor ?? "var(--accent)" : "var(--muted)",
      }}
    >
      {children}
    </button>
  );
}
