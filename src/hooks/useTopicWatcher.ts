"use client";

import { useEffect, useRef } from "react";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import { getGenAI, TEXT_MODEL } from "@/lib/gemini/client";

// Matches actions/background_monitor.py: once a day per topic, check for a
// changed top headline and alert only on an actual change — not on every
// check. There's no server-side cron here, so "once a day" only actually
// happens while a tab stays open across that span; each check is cheap and
// re-checking a topic that's still within its 24h window is a no-op.
const POLL_INTERVAL_MS = 30 * 60_000;
const RECHECK_AFTER_MS = 24 * 60 * 60_000;

export function useTopicWatcher(
  userId: string | null,
  apiKey: string | null,
  onAlert: (topic: string, headline: string) => void
) {
  const onAlertRef = useRef(onAlert);
  useEffect(() => {
    onAlertRef.current = onAlert;
  }, [onAlert]);

  useEffect(() => {
    if (!userId || !apiKey) return;
    const supabase = getSupabaseBrowserClient();
    const genAI = getGenAI(apiKey);

    const check = async () => {
      const cutoff = new Date(Date.now() - RECHECK_AFTER_MS).toISOString();
      const { data } = await supabase
        .from("watch_topics")
        .select("id, topic, last_headline")
        .eq("user_id", userId)
        .or(`last_checked_at.is.null,last_checked_at.lte.${cutoff}`);
      if (!data || data.length === 0) return;

      for (const w of data) {
        try {
          const res = await genAI.models.generateContent({
            model: TEXT_MODEL,
            contents: [
              {
                role: "user",
                parts: [
                  {
                    text: `What is the single most notable recent headline about "${w.topic}"? Reply with just the headline itself, one line, no preamble or commentary.`,
                  },
                ],
              },
            ],
            config: { tools: [{ googleSearch: {} }] },
          });
          const headline = (res.text ?? "").trim().split("\n")[0]?.slice(0, 300) ?? "";
          // Only alert once there's a previous headline to compare against —
          // the first-ever check just establishes a baseline, silently.
          if (headline && w.last_headline && headline !== w.last_headline) {
            onAlertRef.current(w.topic, headline);
          }
          await supabase
            .from("watch_topics")
            .update({ last_headline: headline || w.last_headline, last_checked_at: new Date().toISOString() })
            .eq("id", w.id);
        } catch {
          // Leave last_checked_at untouched so a failed check is retried
          // on the next pass rather than silently marked done.
        }
      }
    };

    void check();
    const interval = setInterval(check, POLL_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [userId, apiKey]);
}
