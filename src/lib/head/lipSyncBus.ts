// Drives the head's mouth from what's actually being said, the same two-part
// idea as the desktop app's viseme.py + avatar.py: the text supplies *which*
// shape (closures on m/b/p, spread on i/e, round on u/o); timing comes from
// the real Gemini Live output transcript, laid across each audio chunk's
// actual playback duration as useChat schedules it.
//
// This is a small module-level bus rather than a hook: there is exactly one
// voice and one face on screen, useChat feeds it from the live session's
// message stream, and HeadModel reads it once per rendered frame.
import { textToVisemes, VISEMES } from "./viseme";

interface Segment {
  viseme: string;
  start: number;
  end: number;
}

export const lipSyncState = { mouth: 0, wide: 0 };

let queue: Segment[] = [];
let speaking = false;

// Chars/sec at utterance rate 1.0 — a reasonable average speaking pace, used
// only to size a word's on-screen duration when we don't otherwise know it.
const BASE_CPS = 13;

export function resetLipSync() {
  queue = [];
  speaking = true;
}

export function stopLipSync() {
  speaking = false;
  queue = [];
}

export function scheduleWord(word: string, startMs: number, rate: number) {
  const trimmed = word.trim();
  if (!trimmed) return;
  const visemes = textToVisemes(trimmed);
  if (visemes.length === 0) return;

  const totalWeight = visemes.reduce((sum, [, w]) => sum + w, 0) || 1;
  const wordDurMs = Math.max(140, (trimmed.length / (BASE_CPS * Math.max(0.5, rate))) * 1000);

  // Drop anything already scheduled that this word's real start supersedes —
  // keeps a late-firing estimate from double-scheduling on top of it.
  queue = queue.filter((seg) => seg.end <= startMs);

  let t = startMs;
  for (const [v, w] of visemes) {
    const dur = (w / totalWeight) * wordDurMs;
    queue.push({ viseme: v, start: t, end: t + dur });
    t += dur;
  }
}

/** Live voice: lay a chunk of transcript across a caller-supplied duration
 * (the actual playback time of the audio it was transcribed from), rather
 * than estimating one — the caller already knows exactly how long its audio
 * chunk runs. Words are spread proportionally to their length within it. */
export function scheduleTextSpan(text: string, startMs: number, durationMs: number) {
  const words = text.split(/\s+/).filter(Boolean);
  if (words.length === 0 || durationMs <= 0) return;
  const totalChars = words.reduce((s, w) => s + w.length, 0) || 1;
  let t = startMs;
  for (const w of words) {
    const share = w.length / totalChars;
    scheduleWord(w, t, 1.0);
    t += durationMs * share;
  }
}

function currentViseme(nowMs: number): string {
  while (queue.length && queue[0].end < nowMs - 250) queue.shift();
  for (const seg of queue) {
    if (nowMs >= seg.start && nowMs < seg.end) return seg.viseme;
  }
  return "REST";
}

function approach(dt: number, tau: number): number {
  return 1 - Math.exp(-dt / tau);
}

const TAU_OPEN = 0.022;
const TAU_SHUT = 0.012;
const TAU_REST = 0.055;
const TAU_WIDE = 0.03;

export function tickLipSync(nowMs: number, dt: number) {
  const viseme = speaking ? currentViseme(nowMs) : "REST";
  const [openness, width, closure] = VISEMES[viseme] ?? VISEMES.REST;
  const targetMouth = openness * (1 - closure);
  const targetWide = speaking ? width : 0;

  const mouthTau = !speaking ? TAU_REST : targetMouth > lipSyncState.mouth ? TAU_OPEN : TAU_SHUT;
  lipSyncState.mouth += (targetMouth - lipSyncState.mouth) * approach(dt, mouthTau);
  lipSyncState.wide += (targetWide - lipSyncState.wide) * approach(dt, TAU_WIDE);
  if (lipSyncState.mouth < 0.002) lipSyncState.mouth = 0;
}
