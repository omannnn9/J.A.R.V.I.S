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
        .select("id, text")
        .eq("user_id", userId)
        .eq("notified", false)
        .lte("remind_at", new Date().toISOString());
      if (!data || data.length === 0) return;
      for (const r of data) {
        onDueRef.current(r.text);
        if (typeof window !== "undefined" && "Notification" in window && Notification.permission === "granted") {
          new Notification("JARVIS reminder", { body: r.text });
        }
        await supabase.from("reminders").update({ notified: true }).eq("id", r.id);
      }
    };

    check();
    const interval = setInterval(check, 20_000);
    return () => clearInterval(interval);
  }, [userId]);
}
