"use client";

import { useRef, useState } from "react";
import type { ImageAttachment } from "@/hooks/useChat";
import { useMedia } from "@/hooks/useMedia";

export function FileUploadZone({ onFile }: { onFile: (file: ImageAttachment) => void }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const [lastFile, setLastFile] = useState<string | null>(null);
  const media = useMedia();

  function handleFiles(files: FileList | null) {
    const file = files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      setLastFile(`${file.name} — only images can be sent to JARVIS right now`);
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      const result = String(reader.result || "");
      const [, base64] = result.split(",");
      onFile({ mimeType: file.type, data: base64, label: file.name });
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
              onClick={async () => {
                const shot = await media.captureScreen();
                if (shot) {
                  onFile({ ...shot, label: "screen share" });
                  setLastFile("screen share");
                }
              }}
              className="flex-1 rounded-md border py-1.5 text-[10.5px] text-[var(--muted)] transition-colors hover:text-[var(--accent)]"
              style={{ borderColor: "var(--border)" }}
            >
              🖥️ Show Screen
            </button>
          )}
          {media.supportsCamera && (
            <button
              onClick={async () => {
                const shot = await media.captureCamera();
                if (shot) {
                  onFile({ ...shot, label: "webcam" });
                  setLastFile("webcam");
                }
              }}
              className="flex-1 rounded-md border py-1.5 text-[10.5px] text-[var(--muted)] transition-colors hover:text-[var(--accent)]"
              style={{ borderColor: "var(--border)" }}
            >
              📷 Show Camera
            </button>
          )}
        </div>
      )}
    </div>
  );
}
