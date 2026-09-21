"use client";

import { useRef, useState } from "react";
import type { ImageAttachment } from "@/hooks/useChat";
import { useMedia } from "@/hooks/useMedia";

export function FileUploadZone({ onFile }: { onFile: (file: ImageAttachment) => void }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const [lastFile, setLastFile] = useState<string | null>(null);
  const [capturing, setCapturing] = useState<"screen" | "camera" | null>(null);
  const media = useMedia();

  function isAccepted(file: File): boolean {
    if (file.type.startsWith("image/")) return true;
    if (file.type === "application/pdf" || file.type === "text/plain" || file.type === "text/markdown") return true;
    // Browsers are inconsistent about the MIME type they report for .md files
    // (often empty), so fall back to the extension for the text formats.
    return /\.(txt|md)$/i.test(file.name);
  }

  function handleFiles(files: FileList | null) {
    const file = files?.[0];
    if (!file) return;
    if (!isAccepted(file)) {
      setLastFile(`${file.name} — only images, PDF, or text/markdown files can be sent to JARVIS`);
      return;
    }
    const mimeType = file.type || (file.name.toLowerCase().endsWith(".md") ? "text/markdown" : "text/plain");
    const reader = new FileReader();
    reader.onload = () => {
      const result = String(reader.result || "");
      const [, base64] = result.split(",");
      onFile({ mimeType, data: base64, label: file.name });
      setLastFile(file.name);
    };
    reader.readAsDataURL(file);
  }

  return (
    <div>
      <div
        onClick={() => inputRef.current?.click()}
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragging(false);
          handleFiles(e.dataTransfer.files);
        }}
        className="flex cursor-pointer flex-col items-center justify-center gap-1.5 rounded-md border border-dashed py-6 text-center transition-colors"
        style={{
          borderColor: dragging ? "var(--accent)" : "var(--border)",
          background: dragging ? "var(--accent-dim)" : "transparent",
        }}
      >
        <span className="text-lg text-[var(--accent)]">⬆</span>
        <span className="text-[12px] text-[var(--text)]">
          Drop file here or <span className="text-[var(--accent)]">Click to Browse</span>
        </span>
        <span className="text-[9.5px] uppercase tracking-wide text-[var(--muted)]">Images · PDF · Docs</span>
        <input
          ref={inputRef}
          type="file"
          accept="image/*,.pdf,.txt,.md"
          className="hidden"
          onChange={(e) => {
            handleFiles(e.target.files);
            e.target.value = "";
          }}
        />
      </div>
      <p className="mt-1.5 text-[10.5px] text-[var(--muted)]">
        {lastFile ? `Loaded: ${lastFile}` : "No file loaded — drop or click above to upload"}
      </p>

      {(media.supportsScreenShare || media.supportsCamera) && (
        <div className="mt-2 flex gap-1.5">
          {media.supportsScreenShare && (
            <button
              disabled={capturing !== null}
              onClick={async () => {
                setCapturing("screen");
                const shot = await media.captureScreen();
                setCapturing(null);
                if (shot) setLastFile("screen share");
                if (shot) onFile(shot);
              }}
              className="flex-1 rounded-md border py-1.5 text-[10.5px] text-[var(--muted)] transition-colors hover:text-[var(--accent)] disabled:opacity-50"
              style={{ borderColor: "var(--border)" }}
            >
              {capturing === "screen" ? "Waiting for share…" : "🖥️ Show Screen"}
            </button>
          )}
          {media.supportsCamera && (
            <button
              disabled={capturing !== null}
              onClick={async () => {
                setCapturing("camera");
                const shot = await media.captureCamera();
                setCapturing(null);
                if (shot) setLastFile("webcam");
                if (shot) onFile(shot);
              }}
              className="flex-1 rounded-md border py-1.5 text-[10.5px] text-[var(--muted)] transition-colors hover:text-[var(--accent)] disabled:opacity-50"
              style={{ borderColor: "var(--border)" }}
            >
              {capturing === "camera" ? "Waiting for camera…" : "📷 Show Camera"}
            </button>
          )}
        </div>
      )}

      {media.error && <p className="mt-1.5 text-[10.5px] text-[var(--red)]">{media.error}</p>}
      {!media.supportsScreenShare && !media.supportsCamera && (
        <p className="mt-1.5 text-[10.5px] text-[var(--muted)]">
          Screen share and camera aren&apos;t available in this browser.
        </p>
      )}
    </div>
  );
}
