import { GoogleGenAI } from "@google/genai";

export const TEXT_MODEL = "gemini-flash-latest";
export const VISION_MODEL = "gemini-flash-latest";
export const DEFAULT_LIVE_MODEL = "gemini-live-2.5-flash-preview";

export function getGenAI(apiKey: string) {
  return new GoogleGenAI({ apiKey });
}
