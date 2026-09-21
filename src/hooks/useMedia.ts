"use client";

import { useCallback, useEffect, useState } from "react";
import type { ImageAttachment } from "./useChat";

async function grabFrame(stream: MediaStream): Promise<ImageAttachment> {
  const video = document.createElement("video");
  video.srcObject = stream;
  video.muted = true;
  video.playsInline = true;
  // Some browsers won't reliably decode/expose frames from a getUserMedia/
  // getDisplayMedia track on a <video> that's never attached to the DOM —
  // keep it in the document but fully invisible rather than detached.
  video.style.position = "fixed";
  video.style.width = "1px";
  video.style.height = "1px";
  video.style.opacity = "0";
  video.style.pointerEvents = "none";
  document.body.appendChild(video);

  try {
    await video.play();
    // Wait for an actual decoded frame instead of guessing a fixed delay —
    // readyState >= 2 (HAVE_CURRENT_DATA) means at least one frame exists.
    if (video.readyState < 2) {
      await new Promise<void>((resolve) => {
        video.addEventListener("loadeddata", () => resolve(), { once: true });
        setTimeout(resolve, 2000); // never hang forever if the event doesn't fire
      });
    }

    const canvas = document.createElement("canvas");
    canvas.width = video.videoWidth || 1280;
    canvas.height = video.videoHeight || 720;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Canvas unsupported");
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

    const dataUrl = canvas.toDataURL("image/jpeg", 0.85);
    const [, base64] = dataUrl.split(",");
    return { mimeType: "image/jpeg", data: base64 };
  } finally {
    video.remove();
  }
}

// Never fail silently — a permission denial, a browser that doesn't support
// getDisplayMedia (Safari on iOS, most notably), or a mid-capture error
// should tell the user why, not just leave the button looking broken.
function describeMediaError(e: unknown): string {
  if (e instanceof DOMException) {
    switch (e.name) {
      case "NotAllowedError":
        return "Permission denied — allow it in your browser's site settings and try again.";
      case "NotFoundError":
        return "No camera found on this device.";
      case "NotReadableError":
        return "Couldn't access it — another app may already be using it.";
      case "AbortError":
        return "Cancelled.";
      default:
        return e.message || `${e.name}.`;
    }
  }
  return e instanceof Error ? e.message : "Something went wrong.";
}

export function useMedia() {
  const [error, setError] = useState<string | null>(null);

  // Starts false on both server and client (avoiding a hydration mismatch,
  // same pattern as useClock/useAudioDevices), resolved for real once
  // mounted.
  const [supportsScreenShare, setSupportsScreenShare] = useState(false);
  const [supportsCamera, setSupportsCamera] = useState(false);
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- one-time read of a browser-only API, not derived state
    setSupportsScreenShare(!!navigator.mediaDevices?.getDisplayMedia);
    setSupportsCamera(!!navigator.mediaDevices?.getUserMedia);
  }, []);

  // Each capture is a single still frame — open the stream, grab a frame,
  // release it immediately. Not a live feed: nothing should be left running
  // (and no camera/screen-share indicator left on) after one snapshot.
  const captureScreen = useCallback(async (): Promise<ImageAttachment | null> => {
    if (!supportsScreenShare) {
      setError("Screen sharing isn't supported in this browser.");
      return null;
    }
    let stream: MediaStream | null = null;
    try {
      setError(null);
      stream = await navigator.mediaDevices.getDisplayMedia({ video: true });
      const shot = await grabFrame(stream);
      return { ...shot, label: "screen share" };
    } catch (e) {
      setError(describeMediaError(e));
      return null;
    } finally {
      stream?.getTracks().forEach((t) => t.stop());
    }
  }, [supportsScreenShare]);

  const captureCamera = useCallback(async (): Promise<ImageAttachment | null> => {
    if (!supportsCamera) {
      setError("Camera access isn't supported in this browser.");
      return null;
    }
    let stream: MediaStream | null = null;
    try {
      setError(null);
      stream = await navigator.mediaDevices.getUserMedia({ video: true });
      const shot = await grabFrame(stream);
      return { ...shot, label: "webcam" };
    } catch (e) {
      setError(describeMediaError(e));
      return null;
    } finally {
      stream?.getTracks().forEach((t) => t.stop());
    }
  }, [supportsCamera]);

  return {
    supportsScreenShare,
    supportsCamera,
    error,
    captureScreen,
    captureCamera,
  };
}
