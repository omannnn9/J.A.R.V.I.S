// Raw PCM16 <-> base64 helpers for the Gemini Live API, which speaks 16kHz
// mono PCM in (mic) and sends 24kHz mono PCM out (voice).

export function resampleTo16k(f32: Float32Array, srcRate: number): Float32Array {
  if (srcRate === 16000) return f32;
  const ratio = srcRate / 16000;
  const len = Math.max(1, Math.round(f32.length / ratio));
  const out = new Float32Array(len);
  for (let i = 0; i < len; i++) {
    out[i] = f32[Math.min(f32.length - 1, Math.round(i * ratio))];
  }
  return out;
}

export function floatTo16BitPCM(input: Float32Array): Int16Array {
  const out = new Int16Array(input.length);
  for (let i = 0; i < input.length; i++) {
    const s = Math.max(-1, Math.min(1, input[i]));
    out[i] = s < 0 ? s * 0x8000 : s * 0x7fff;
  }
  return out;
}

export function int16ToBase64(int16: Int16Array): string {
  const bytes = new Uint8Array(int16.buffer, int16.byteOffset, int16.byteLength);
  let binary = "";
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return btoa(binary);
}

export function base64ToInt16(base64: string): Int16Array {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return new Int16Array(bytes.buffer);
}

export function int16ToFloat32(int16: Int16Array): Float32Array {
  const out = new Float32Array(int16.length);
  for (let i = 0; i < int16.length; i++) {
    const v = int16[i];
    out[i] = v < 0 ? v / 0x8000 : v / 0x7fff;
  }
  return out;
}
