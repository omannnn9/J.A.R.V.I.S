"use client";

import { useEffect, useRef } from "react";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";

export function useReminderWatcher(userId: string | null, onDue: (text: string) => void) {
  const onDueRef = useRef(onDue);
  useEffect(() => {
    onDueRef.current = onDue;
  }, [onDue]);

  useEffect(() => {
    if (!userId) return;
    if (typeof window !== "undefined" && "Notification" in window && Notification.permission === "default") {
      Notification.requestPermission().catch(() => {});
    }

    const supabase = getSupabaseBrowserClient();
    const check = async () => {
      const { data } = await supabase
        .from("reminders")
        .select("id, text, remind_at, recurrence")
        .eq("user_id", userId)
        .eq("notified", false)
        .lte("remind_at", new Date().toISOString());
      if (!data || data.length === 0) return;
      for (const r of data) {
        onDueRef.current(r.text);
        if (typeof window !== "undefined" && "Notification" in window && Notification.permission === "granted") {
          new Notification("JARVIS reminder", { body: r.text });
        }
        if (r.recurrence === "none") {
          await supabase.from("reminders").update({ notified: true }).eq("id", r.id);
        } else {
          // Recurring: roll remind_at forward from its own last fire time
          // (not "now") so a reminder set for 9am daily keeps firing at
          // 9am even if this tab was closed when it was actually due —
          // it catches up to the next occurrence still ahead of now,
          // rather than drifting to whatever time the tab happened to
          // reopen.
          const stepMs = r.recurrence === "daily" ? 24 * 60 * 60_000 : 7 * 24 * 60 * 60_000;
          let next = new Date(r.remind_at).getTime();
          const now = Date.now();
          do {
            next += stepMs;
          } while (next <= now);
          await supabase.from("reminders").update({ remind_at: new Date(next).toISOString() }).eq("id", r.id);
        }
      }
    };

    check();
    const interval = setInterval(check, 20_000);
    return () => clearInterval(interval);
  }, [userId]);
}
