"use client";

import { useCallback, useRef, useState } from "react";
import type { ImageAttachment } from "./useChat";

async function grabFrame(stream: MediaStream): Promise<ImageAttachment> {
  const video = document.createElement("video");
  video.srcObject = stream;
  video.muted = true;
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

export function useMedia() {
  const [screenSharing, setScreenSharing] = useState(false);
  const [camOn, setCamOn] = useState(false);
  const screenStreamRef = useRef<MediaStream | null>(null);
  const camStreamRef = useRef<MediaStream | null>(null);

  const supportsScreenShare =
    typeof navigator !== "undefined" && !!navigator.mediaDevices?.getDisplayMedia;
  const supportsCamera = typeof navigator !== "undefined" && !!navigator.mediaDevices?.getUserMedia;

  const startScreenShare = useCallback(async () => {
    if (!supportsScreenShare) return false;
    try {
      const stream = await navigator.mediaDevices.getDisplayMedia({ video: true });
      screenStreamRef.current = stream;
      stream.getVideoTracks()[0]?.addEventListener("ended", () => {
        screenStreamRef.current = null;
        setScreenSharing(false);
      });
      setScreenSharing(true);
      return true;
    } catch {
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
      return { ...shot, label: "screen share" };
    } catch {
      return null;
    }
  }, [startScreenShare]);

  const startCamera = useCallback(async () => {
    if (!supportsCamera) return false;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true });
      camStreamRef.current = stream;
      setCamOn(true);
      return true;
    } catch {
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
      return { ...shot, label: "webcam" };
    } catch {
      return null;
    }
  }, [startCamera]);

  return {
    supportsScreenShare,
    supportsCamera,
    screenSharing,
    camOn,
    startScreenShare,
    stopScreenShare,
    captureScreen,
    startCamera,
    stopCamera,
    captureCamera,
  };
}
