"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { Content, Part } from "@google/genai";
import { getGenAI, TEXT_MODEL } from "@/lib/gemini/client";
import { executeTool, toolDeclarations } from "@/lib/actions/tools";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import type { Profile } from "@/lib/supabase/types";

export interface ChatMessage {
  id: string;
  role: "user" | "assistant" | "system";
  text: string;
  ts: number;
}

export interface ImageAttachment {
  mimeType: string;
  data: string; // base64, no data: prefix
  label?: string;
}

const MAX_TOOL_HOPS = 5;

function buildSystemInstruction(profile: Profile, memories: string[]): string {
  const lines = [
    `You are ${profile.assistant_name}, an advanced, capable personal AI assistant running inside a website, speaking with ${profile.display_name}.`,
    `You are warm, sharp, a little witty, and extremely competent — inspired by the classic "JARVIS" archetype: calm, proactive, precise.`,
    `You are running in a web browser, not on the user's operating system. You cannot launch native apps, control the OS, change system settings, or access files outside what the user explicitly shares with you (uploads, screen share, webcam, clipboard). If asked to do something like that, say plainly that it's outside what a website is allowed to do in a browser, and offer the closest thing you can actually do instead.`,
    `You have tools for: weather, remembering/recalling/forgetting facts about the user, setting/listing/cancelling reminders, searching the live web, opening YouTube searches, and opening links. Use them proactively whenever relevant — don't ask permission for read-only actions like checking weather or searching.`,
    `Keep spoken/chat replies concise and natural — this may be read aloud by text-to-speech.`,
  ];
  if (memories.length) {
    lines.push(`\nWhat you remember about ${profile.display_name}:`);
    for (const m of memories) lines.push(`- ${m}`);
  }
  return lines.join("\n");
}

export function useChat(profile: Profile | null, userId: string | null) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [historyLoaded, setHistoryLoaded] = useState(false);
  const memoriesRef = useRef<string[]>([]);

  const supabase = getSupabaseBrowserClient();

  const loadMemories = useCallback(async () => {
    if (!userId) return;
    const { data } = await supabase
      .from("memories")
      .select("content")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(40);
    memoriesRef.current = data?.map((m) => m.content) ?? [];
  }, [userId, supabase]);

  useEffect(() => {
    if (!userId) return;
    (async () => {
      await loadMemories();
      const { data } = await supabase
        .from("messages")
        .select("id, role, content, created_at")
        .eq("user_id", userId)
        .order("created_at", { ascending: true })
        .limit(200);
      if (data) {
        setMessages(
          data.map((m) => ({
            id: m.id,
            role: m.role,
            text: m.content,
            ts: new Date(m.created_at).getTime(),
          }))
        );
      }
      setHistoryLoaded(true);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId]);

  const persist = useCallback(
    async (role: ChatMessage["role"], text: string) => {
      if (!userId) return;
      await supabase.from("messages").insert({ user_id: userId, role, content: text });
    },
    [userId, supabase]
  );

  const sendText = useCallback(
    async (text: string, images?: ImageAttachment[]): Promise<string | null> => {
      if (!profile?.gemini_api_key) {
        setError("Add your Gemini API key in Settings to start chatting.");
        return null;
      }
      if (!userId) return null;
      setError(null);
      setLoading(true);

      const userMsg: ChatMessage = { id: crypto.randomUUID(), role: "user", text, ts: Date.now() };
      setMessages((prev) => [...prev, userMsg]);
      void persist("user", text);

      try {
        const genAI = getGenAI(profile.gemini_api_key);

        const history: Content[] = messages.slice(-30).map((m) => ({
          role: m.role === "assistant" ? "model" : "user",
          parts: [{ text: m.text }],
        }));

        const userParts: Part[] = [{ text }];
        for (const img of images ?? []) {
          userParts.push({ inlineData: { mimeType: img.mimeType, data: img.data } });
        }

        const contents: Content[] = [...history, { role: "user", parts: userParts }];
        const systemInstruction = buildSystemInstruction(profile, memoriesRef.current);

        let hops = 0;
        let finalText = "";

        while (hops < MAX_TOOL_HOPS) {
          const response = await genAI.models.generateContent({
            model: TEXT_MODEL,
            contents,
            config: {
              systemInstruction,
              tools: [{ functionDeclarations: toolDeclarations }],
            },
          });

          const calls = response.functionCalls;
          if (calls && calls.length > 0) {
            const modelContent = response.candidates?.[0]?.content;
            if (modelContent) contents.push(modelContent);

            const responseParts: Part[] = [];
            for (const call of calls) {
              const result = await executeTool(call.name ?? "", call.args ?? {}, { userId, genAI });
              responseParts.push({
                functionResponse: { name: call.name, response: { result } },
              });
              if (call.name === "remember_fact" || call.name === "forget_fact") {
                await loadMemories();
              }
            }
            contents.push({ role: "user", parts: responseParts });
            hops++;
            continue;
          }

          finalText = response.text ?? "I'm not sure how to respond to that.";
          break;
        }

        if (!finalText) finalText = "I hit a snag chaining tool calls — could you rephrase that?";

        const assistantMsg: ChatMessage = {
          id: crypto.randomUUID(),
          role: "assistant",
          text: finalText,
          ts: Date.now(),
        };
        setMessages((prev) => [...prev, assistantMsg]);
        void persist("assistant", finalText);
        return finalText;
      } catch (e) {
        const msg = e instanceof Error ? e.message : "Something went wrong talking to Gemini.";
        setError(msg);
        return null;
      } finally {
        setLoading(false);
      }
    },
    [profile, userId, messages, persist, loadMemories]
  );

  const clearError = useCallback(() => setError(null), []);

  return { messages, sendText, loading, error, clearError, historyLoaded, reloadMemories: loadMemories };
}
