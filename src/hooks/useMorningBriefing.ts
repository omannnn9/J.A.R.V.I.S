"use client";

import { useEffect, useRef } from "react";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";

// Fires once per local calendar day, the first time the app is active and
// idle enough to speak unprompted — not a fixed schedule, since there's no
// server-side cron here, only whatever's true the next time the tab is
// actually open. Pulls together what's real (pending reminders, watched
// topics with news) rather than ever inventing content, and lets the model
// turn that into a short spoken greeting via the same internal-nudge
// channel the proactive engine uses.
export function useMorningBriefing({
  enabled,
  userId,
  assistantName,
  displayName,
  trigger,
}: {
  enabled: boolean;
  userId: string | null;
  assistantName: string;
  displayName: string;
  trigger: (promptText: string) => void;
}) {
  const firedRef = useRef(false);

  useEffect(() => {
    if (!enabled || !userId || firedRef.current) return;
    let cancelled = false;

    (async () => {
      const supabase = getSupabaseBrowserClient();
      const { data: profileRow } = await supabase
        .from("profiles")
        .select("last_briefing_at")
        .eq("id", userId)
        .single();
      if (cancelled) return;

      const today = new Date().toDateString();
      const lastBriefing = profileRow?.last_briefing_at ? new Date(profileRow.last_briefing_at).toDateString() : null;
      if (lastBriefing === today) {
        firedRef.current = true;
        return;
      }

      const dayFromNow = new Date(Date.now() + 24 * 60 * 60_000).toISOString();
      const [{ data: reminders }, { data: topics }] = await Promise.all([
        supabase
          .from("reminders")
          .select("text, remind_at")
          .eq("user_id", userId)
          .eq("notified", false)
          .lte("remind_at", dayFromNow)
          .order("remind_at", { ascending: true }),
        supabase
          .from("watch_topics")
          .select("topic, last_headline")
          .eq("user_id", userId)
          .not("last_headline", "is", null),
      ]);
      if (cancelled) return;

      firedRef.current = true;
      await supabase.from("profiles").update({ last_briefing_at: new Date().toISOString() }).eq("id", userId);

      const lines = [
        `[Internal — the app just became active for the first time today, this isn't something ${displayName} said.] ` +
          `Give a brief, warm greeting for the day and a quick rundown of what's ahead — only using what's actually true below, never invent anything.`,
      ];
      if (reminders?.length) {
        lines.push("Reminders coming up in the next day:");
        for (const r of reminders) lines.push(`- ${r.text} (${new Date(r.remind_at).toLocaleString()})`);
      } else {
        lines.push("No reminders due in the next day.");
      }
      if (topics?.length) {
        lines.push("Latest on watched topics:");
        for (const t of topics) lines.push(`- ${t.topic}: ${t.last_headline}`);
      }
      lines.push(
        `Keep it short and natural, like ${assistantName} greeting ${displayName} for the day — if there's genuinely nothing to report, a brief greeting alone is fine rather than padding it out.`
      );
      trigger(lines.join("\n"));
    })();

    return () => {
      cancelled = true;
    };
  }, [enabled, userId, assistantName, displayName, trigger]);
}
