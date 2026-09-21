import { GoogleGenAI } from "@google/genai";

export const TEXT_MODEL = "gemini-flash-latest";
export const VISION_MODEL = "gemini-flash-latest";
// Matches the desktop app's LIVE_MODEL exactly (main.py) — the Live API's
// preview models come and go quickly, and this is the one the real app is
// actually built and tested against.
export const DEFAULT_LIVE_MODEL = "models/gemini-3.1-flash-live-preview";
// Native Gemini image generation ("Nano Banana 2") via the standard
// generateContent path — same quota/billing as any other Gemini call,
// unlike the separate Imagen generateImages() endpoint this used to call,
// which needs its own access tier most free-tier API keys don't have.
export const IMAGE_MODEL = "gemini-3.1-flash-image-preview";

export function getGenAI(apiKey: string, apiVersion?: "v1alpha" | "v1beta") {
  return new GoogleGenAI(apiVersion ? { apiKey, apiVersion } : { apiKey });
}
