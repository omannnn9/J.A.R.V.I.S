"use client";

import { useCallback, useEffect, useState } from "react";

export interface DeviceOption {
  deviceId: string;
  label: string;
}

export function useAudioDevices() {
  const [inputs, setInputs] = useState<DeviceOption[]>([]);
  const [outputs, setOutputs] = useState<DeviceOption[]>([]);
  // Output-device selection (AudioContext.setSinkId) is a recent, Chrome-only
  // API. Starts false on both server and client (avoiding a hydration
  // mismatch, same pattern as useClock/useSystemStats), resolved for real
  // once mounted.
  const [supportsOutputSelection, setSupportsOutputSelection] = useState(false);

  const refresh = useCallback(async () => {
    if (typeof navigator === "undefined" || !navigator.mediaDevices?.enumerateDevices) return;
    let devices = await navigator.mediaDevices.enumerateDevices();
    // Device labels are blank until mic permission has been granted at
    // least once. Request briefly and stop immediately, purely to unlock
    // labels — mirrors the desktop app's "actually probe, don't guess"
    // approach to knowing what's really available.
    if (devices.some((d) => d.kind === "audioinput" && !d.label)) {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        stream.getTracks().forEach((t) => t.stop());
        devices = await navigator.mediaDevices.enumerateDevices();
      } catch {
        // Permission denied — picker still works, just unlabeled.
      }
    }
    setInputs(
      devices
        .filter((d) => d.kind === "audioinput")
        .map((d, i) => ({ deviceId: d.deviceId, label: d.label || `Microphone ${i + 1}` }))
    );
    setOutputs(
      devices
        .filter((d) => d.kind === "audiooutput")
        .map((d, i) => ({ deviceId: d.deviceId, label: d.label || `Speaker ${i + 1}` }))
    );
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- one-time read of a browser-only API, not derived state
    setSupportsOutputSelection(typeof AudioContext !== "undefined" && "setSinkId" in AudioContext.prototype);
    void refresh();
    if (!navigator.mediaDevices) return;
    navigator.mediaDevices.addEventListener("devicechange", refresh);
    return () => navigator.mediaDevices.removeEventListener("devicechange", refresh);
  }, [refresh]);

  return { inputs, outputs, supportsOutputSelection, refresh };
}
