import { GoogleGenAI } from "@google/genai";

export const TEXT_MODEL = "gemini-flash-latest";
export const VISION_MODEL = "gemini-flash-latest";
// Matches the desktop app's LIVE_MODEL exactly (main.py) — the Live API's
// preview models come and go quickly, and this is the one the real app is
// actually built and tested against.
export const DEFAULT_LIVE_MODEL = "models/gemini-3.1-flash-live-preview";

export function getGenAI(apiKey: string, apiVersion?: "v1alpha" | "v1beta") {
  return new GoogleGenAI(apiVersion ? { apiKey, apiVersion } : { apiKey });
}
