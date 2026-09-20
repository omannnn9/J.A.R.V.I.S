"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { ImageAttachment } from "./useChat";

async function grabFrame(stream: MediaStream): Promise<ImageAttachment> {
  const video = document.createElement("video");
  video.srcObject = stream;
  video.muted = true;
  video.playsInline = true;
  await video.play();
  await new Promise((r) => setTimeout(r, 150)); // let a real frame land

  const canvas = document.createElement("canvas");
  canvas.width = video.videoWidth || 1280;
  canvas.height = video.videoHeight || 720;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas unsupported");
  ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

  const dataUrl = canvas.toDataURL("image/jpeg", 0.85);
  const [, base64] = dataUrl.split(",");
  return { mimeType: "image/jpeg", data: base64 };
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
  const [screenSharing, setScreenSharing] = useState(false);
  const [camOn, setCamOn] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const screenStreamRef = useRef<MediaStream | null>(null);
  const camStreamRef = useRef<MediaStream | null>(null);

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

  const startScreenShare = useCallback(async () => {
    if (!supportsScreenShare) {
      setError("Screen sharing isn't supported in this browser.");
      return false;
    }
    try {
      setError(null);
      const stream = await navigator.mediaDevices.getDisplayMedia({ video: true });
      screenStreamRef.current = stream;
      stream.getVideoTracks()[0]?.addEventListener("ended", () => {
        screenStreamRef.current = null;
        setScreenSharing(false);
      });
      setScreenSharing(true);
      return true;
    } catch (e) {
      setError(describeMediaError(e));
      return false;
    }
  }, [supportsScreenShare]);

  const stopScreenShare = useCallback(() => {
    screenStreamRef.current?.getTracks().forEach((t) => t.stop());
    screenStreamRef.current = null;
    setScreenSharing(false);
  }, []);

  const captureScreen = useCallback(async (): Promise<ImageAttachment | null> => {
    if (!screenStreamRef.current) {
      const ok = await startScreenShare();
      if (!ok || !screenStreamRef.current) return null;
    }
    try {
      const shot = await grabFrame(screenStreamRef.current);
      setError(null);
      return { ...shot, label: "screen share" };
    } catch (e) {
      setError(describeMediaError(e));
      return null;
    }
  }, [startScreenShare]);

  const startCamera = useCallback(async () => {
    if (!supportsCamera) {
      setError("Camera access isn't supported in this browser.");
      return false;
    }
    try {
      setError(null);
      const stream = await navigator.mediaDevices.getUserMedia({ video: true });
      camStreamRef.current = stream;
      setCamOn(true);
      return true;
    } catch (e) {
      setError(describeMediaError(e));
      return false;
    }
  }, [supportsCamera]);

  const stopCamera = useCallback(() => {
    camStreamRef.current?.getTracks().forEach((t) => t.stop());
    camStreamRef.current = null;
    setCamOn(false);
  }, []);

  const captureCamera = useCallback(async (): Promise<ImageAttachment | null> => {
    if (!camStreamRef.current) {
      const ok = await startCamera();
      if (!ok || !camStreamRef.current) return null;
    }
    try {
      const shot = await grabFrame(camStreamRef.current);
      setError(null);
      return { ...shot, label: "webcam" };
    } catch (e) {
      setError(describeMediaError(e));
      return null;
    }
  }, [startCamera]);

  return {
    supportsScreenShare,
    supportsCamera,
    screenSharing,
    camOn,
    error,
    startScreenShare,
    stopScreenShare,
    captureScreen,
    startCamera,
    stopCamera,
    captureCamera,
  };
}
