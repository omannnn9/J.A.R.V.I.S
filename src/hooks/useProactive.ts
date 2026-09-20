"use client";

import { useEffect, useRef } from "react";
import type { ChatMessage } from "./useChat";

// Matches the desktop app's ProactiveEngine: speak up unprompted only after
// real silence (15 min of no activity), no more often than once every 20
// min, rotating between three "focus" themes so openers don't repeat.
const IDLE_MS = 15 * 60_000;
const COOLDOWN_MS = 20 * 60_000;
const CHECK_INTERVAL_MS = 60_000;

const THEMES = [
  "Focus: check in on something specific you know about the user's projects or goals — only if you actually have something concrete and relevant to say, not a generic nudge.",
  "Focus: a brief, warm check-in appropriate for the time of day (energy, a break, etc.) — keep it light and short.",
  "Focus: share one genuinely interesting, concise thought or observation — relevant to the conversation so far if there's context for one, otherwise skip it rather than reaching for generic trivia.",
];

export function useProactive({
  enabled,
  messages,
  busy,
  trigger,
}: {
  enabled: boolean;
  messages: ChatMessage[];
  busy: boolean;
  trigger: (promptText: string) => void;
}) {
  // Started at 0 (a pure literal) rather than Date.now() directly, since
  // reading the clock is impure and not allowed during render — the real
  // timestamps are set once mounted, in the effect below.
  const lastActivityRef = useRef(0);
  const lastProactiveRef = useRef(0);
  const themeIndexRef = useRef(0);

  useEffect(() => {
    lastActivityRef.current = Date.now();
    lastProactiveRef.current = Date.now();
  }, []);

  useEffect(() => {
    lastActivityRef.current = Date.now();
  }, [messages.length]);

  useEffect(() => {
    if (!enabled) return;
    const id = setInterval(() => {
      if (busy) return;
      const now = Date.now();
      if (now - lastActivityRef.current < IDLE_MS) return;
      if (now - lastProactiveRef.current < COOLDOWN_MS) return;

      const theme = THEMES[themeIndexRef.current % THEMES.length];
      themeIndexRef.current += 1;
      lastProactiveRef.current = now;

      trigger(
        "[Internal — the user hasn't said anything for a while, this isn't something they said.] " +
          "Only if you genuinely have something worth saying, speak up briefly and naturally, unprompted. " +
          `${theme} If nothing is truly worth saying right now, stay silent rather than forcing a check-in — ` +
          "and if you do speak, match whatever language the user's been speaking."
      );
    }, CHECK_INTERVAL_MS);
    return () => clearInterval(id);
  }, [enabled, busy, trigger]);
}
