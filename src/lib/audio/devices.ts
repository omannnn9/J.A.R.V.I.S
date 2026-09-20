// Shared device-resolution helper: the desktop app's audio_devices.py
// deliberately stores a chosen device by *name*, not index, because indices
// shift on hot-plug — this is the same idea for the Web Audio equivalent
// (deviceId is the unstable part here, label is what survives a restart).
export async function resolveDeviceIdByLabel(
  kind: "audioinput" | "audiooutput",
  label: string | null | undefined
): Promise<string | undefined> {
  if (!label || typeof navigator === "undefined" || !navigator.mediaDevices?.enumerateDevices) return undefined;
  const devices = await navigator.mediaDevices.enumerateDevices();
  return devices.find((d) => d.kind === kind && d.label === label)?.deviceId;
}
