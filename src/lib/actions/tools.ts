import { Type, type FunctionDeclaration, type GoogleGenAI } from "@google/genai";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import { TEXT_MODEL, IMAGE_MODEL } from "@/lib/gemini/client";

export interface ToolContext {
  userId: string;
  genAI: GoogleGenAI;
  // Image bytes never go back through the model's own context (they'd cost
  // a fortune in tokens for no benefit) — this side channel is how a
  // generated image actually reaches the screen.
  onGeneratedImage?: (dataUrl: string, prompt: string) => void;
  // Undo instead of confirm-before-every-delete, same reasoning as the
  // desktop app's undo stack: forgetting a fact or cancelling a reminder
  // is never irreversible enough to justify asking first, but a wrong
  // match deserves an easy way back.
  onUndoableDelete?: (description: string, restore: () => Promise<void>) => void;
  // "Go to sleep" / "stop listening" is a real UI transition (closes the
  // mic, ends the session's active state), not a database mutation — this
  // is the only way the model can actually act on that request instead of
  // just talking as if it had.
  onSleepRequested?: () => void;
}

export const toolDeclarations: FunctionDeclaration[] = [
  {
    name: "get_weather",
    description:
      "Get the current weather and short forecast for a city. Use whenever the user asks about weather, temperature, rain, or what to wear.",
    parameters: {
      type: Type.OBJECT,
      properties: {
        city: {
          type: Type.STRING,
          description: "City name, e.g. 'London' or 'San Francisco, CA'",
        },
      },
      required: ["city"],
    },
  },
  {
    name: "remember_fact",
    description:
      "Permanently save a fact, preference, or piece of context about the user for future conversations. Use whenever the user tells you something worth remembering long-term (their name, preferences, ongoing projects, important dates, etc).",
    parameters: {
      type: Type.OBJECT,
      properties: {
        fact: { type: Type.STRING, description: "The fact to remember, written in third person." },
      },
      required: ["fact"],
    },
  },
  {
    name: "forget_fact",
    description: "Delete a previously remembered fact that is no longer true or the user wants removed.",
    parameters: {
      type: Type.OBJECT,
      properties: {
        query: { type: Type.STRING, description: "Text to match against stored facts to find which one to delete." },
      },
      required: ["query"],
    },
  },
  {
    name: "list_memories",
    description: "List everything currently remembered about the user.",
    parameters: { type: Type.OBJECT, properties: {} },
  },
  {
    name: "set_reminder",
    description: "Create a reminder that will notify the user at a future time, as long as this site is open in a browser tab.",
    parameters: {
      type: Type.OBJECT,
      properties: {
        text: { type: Type.STRING, description: "What to remind the user about." },
        minutes_from_now: {
          type: Type.NUMBER,
          description: "How many minutes from now to fire the reminder.",
        },
      },
      required: ["text", "minutes_from_now"],
    },
  },
  {
    name: "list_reminders",
    description: "List the user's upcoming reminders.",
    parameters: { type: Type.OBJECT, properties: {} },
  },
  {
    name: "cancel_reminder",
    description: "Cancel a reminder that matches the given text.",
    parameters: {
      type: Type.OBJECT,
      properties: {
        query: { type: Type.STRING, description: "Text to match against reminders to find which one to cancel." },
      },
      required: ["query"],
    },
  },
  {
    name: "open_youtube_search",
    description: "Open a YouTube search in a new browser tab for the given query. Use when the user asks to find, play, or watch a video.",
    parameters: {
      type: Type.OBJECT,
      properties: {
        query: { type: Type.STRING, description: "What to search for on YouTube." },
      },
      required: ["query"],
    },
  },
  {
    name: "web_search",
    description:
      "Search the live web for current information — news, prices, facts, research, comparisons, anything that needs up-to-date or real-world data beyond your training knowledge.",
    parameters: {
      type: Type.OBJECT,
      properties: {
        query: { type: Type.STRING, description: "The search query." },
      },
      required: ["query"],
    },
  },
  {
    name: "code_helper",
    description:
      "Write, explain, review, fix, or optimize a piece of code. Use whenever the user asks you to write a function/script, explain what code does, find bugs, review code quality, or make code faster/cleaner.",
    parameters: {
      type: Type.OBJECT,
      properties: {
        action: {
          type: Type.STRING,
          description: "One of: write, explain, review, fix, optimize.",
          enum: ["write", "explain", "review", "fix", "optimize"],
        },
        prompt: {
          type: Type.STRING,
          description: "For 'write': what to build. For the others: what the user wants done to the code.",
        },
        code: {
          type: Type.STRING,
          description: "The existing code, if any (required for explain/review/fix/optimize).",
        },
        language: {
          type: Type.STRING,
          description: "Programming language, if known (e.g. 'python', 'typescript').",
        },
      },
      required: ["action", "prompt"],
    },
  },
  {
    name: "go_to_sleep",
    description:
      "Stop actively listening and go quiet until woken again. Use this whenever the user asks you to go to sleep, be quiet, stop listening, hush, or leave them alone for now — always call this tool, don't just say you will.",
    parameters: { type: Type.OBJECT, properties: {} },
  },
  {
    name: "generate_image",
    description:
      "Generate an image from a text description and show it to the user. Use whenever the user asks you to create, draw, generate, or make a picture/image/illustration of something.",
    parameters: {
      type: Type.OBJECT,
      properties: {
        prompt: { type: Type.STRING, description: "A detailed description of the image to generate." },
      },
      required: ["prompt"],
    },
  },
  {
    name: "watch_topic",
    description:
      "Start monitoring a topic in the background and alert the user only when there's genuinely new news about it. Use when the user says things like 'keep an eye on X' or 'let me know if anything happens with Y'.",
    parameters: {
      type: Type.OBJECT,
      properties: {
        topic: { type: Type.STRING, description: "The topic to watch, e.g. 'SpaceX launches' or 'the local election'." },
      },
      required: ["topic"],
    },
  },
  {
    name: "list_watched_topics",
    description: "List everything currently being monitored in the background.",
    parameters: { type: Type.OBJECT, properties: {} },
  },
  {
    name: "unwatch_topic",
    description: "Stop monitoring a topic.",
    parameters: {
      type: Type.OBJECT,
      properties: {
        query: { type: Type.STRING, description: "Text to match against watched topics to find which one to stop." },
      },
      required: ["query"],
    },
  },
  {
    name: "open_link",
    description: "Open a URL in a new browser tab. Use when the user asks you to open, navigate to, or visit a website.",
    parameters: {
      type: Type.OBJECT,
      properties: {
        url: { type: Type.STRING, description: "The full URL to open." },
      },
      required: ["url"],
    },
  },
];

async function geocodeCity(city: string) {
  const res = await fetch(
    `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(city)}&count=1`
  );
  const data = await res.json();
  const hit = data?.results?.[0];
  if (!hit) return null;
  return { lat: hit.latitude, lon: hit.longitude, label: `${hit.name}${hit.admin1 ? ", " + hit.admin1 : ""}, ${hit.country}` };
}

const WEATHER_CODES: Record<number, string> = {
  0: "clear sky",
  1: "mostly clear",
  2: "partly cloudy",
  3: "overcast",
  45: "fog",
  48: "depositing rime fog",
  51: "light drizzle",
  53: "moderate drizzle",
  55: "dense drizzle",
  61: "slight rain",
  63: "moderate rain",
  65: "heavy rain",
  71: "slight snow",
  73: "moderate snow",
  75: "heavy snow",
  80: "rain showers",
  81: "heavy rain showers",
  82: "violent rain showers",
  95: "thunderstorm",
  96: "thunderstorm with hail",
};

// Matches actions/background_monitor.py's guardrail: no unattended
// crypto/financial monitoring (a case for avoiding automated trading-signal
// use, not a general news restriction).
const WATCH_BLOCKLIST = [
  "bitcoin",
  "crypto",
  "cryptocurrency",
  "ethereum",
  "altcoin",
  "stock price",
  "stock market",
  "forex",
  "trading signal",
  "price prediction",
  "nft price",
  "token price",
];

export function isBlockedWatchTopic(topic: string): boolean {
  const t = topic.toLowerCase();
  return WATCH_BLOCKLIST.some((kw) => t.includes(kw));
}

export async function executeTool(
  name: string,
  args: Record<string, unknown>,
  ctx: ToolContext
): Promise<unknown> {
  const supabase = getSupabaseBrowserClient();

  switch (name) {
    case "get_weather": {
      const city = String(args.city ?? "");
      const geo = await geocodeCity(city);
      if (!geo) return { error: `Couldn't find a location named "${city}".` };
      const res = await fetch(
        `https://api.open-meteo.com/v1/forecast?latitude=${geo.lat}&longitude=${geo.lon}&current=temperature_2m,relative_humidity_2m,weather_code,wind_speed_10m&temperature_unit=celsius`
      );
      const data = await res.json();
      const c = data.current;
      return {
        location: geo.label,
        temperature_c: c.temperature_2m,
        temperature_f: Math.round((c.temperature_2m * 9) / 5 + 32),
        condition: WEATHER_CODES[c.weather_code] ?? "unknown",
        humidity_pct: c.relative_humidity_2m,
        wind_kmh: c.wind_speed_10m,
      };
    }

    case "remember_fact": {
      const fact = String(args.fact ?? "").trim();
      if (!fact) return { error: "No fact provided." };
      const { error } = await supabase.from("memories").insert({ user_id: ctx.userId, content: fact });
      if (error) return { error: error.message };
      return { ok: true, saved: fact };
    }

    case "forget_fact": {
      const query = String(args.query ?? "").trim();
      const { data } = await supabase
        .from("memories")
        .select("id, content, created_at")
        .eq("user_id", ctx.userId)
        .ilike("content", `%${query}%`)
        .limit(1);
      const match = data?.[0];
      if (!match) return { error: "No matching memory found." };
      await supabase.from("memories").delete().eq("id", match.id);
      ctx.onUndoableDelete?.(`Forgot "${match.content}"`, async () => {
        await supabase
          .from("memories")
          .insert({ id: match.id, user_id: ctx.userId, content: match.content, created_at: match.created_at });
      });
      return { ok: true, deleted: match.content };
    }

    case "list_memories": {
      const { data } = await supabase
        .from("memories")
        .select("content, created_at")
        .eq("user_id", ctx.userId)
        .order("created_at", { ascending: false })
        .limit(50);
      return { memories: data?.map((m) => m.content) ?? [] };
    }

    case "set_reminder": {
      const text = String(args.text ?? "").trim();
      const minutes = Number(args.minutes_from_now ?? 0);
      if (!text || !minutes || minutes <= 0) return { error: "Need reminder text and a positive number of minutes." };
      const remindAt = new Date(Date.now() + minutes * 60_000).toISOString();
      const { error } = await supabase.from("reminders").insert({ user_id: ctx.userId, text, remind_at: remindAt });
      if (error) return { error: error.message };
      return { ok: true, text, remind_at: remindAt };
    }

    case "list_reminders": {
      const { data } = await supabase
        .from("reminders")
        .select("text, remind_at")
        .eq("user_id", ctx.userId)
        .eq("notified", false)
        .order("remind_at", { ascending: true });
      return { reminders: data ?? [] };
    }

    case "cancel_reminder": {
      const query = String(args.query ?? "").trim();
      const { data } = await supabase
        .from("reminders")
        .select("id, text, remind_at")
        .eq("user_id", ctx.userId)
        .eq("notified", false)
        .ilike("text", `%${query}%`)
        .limit(1);
      const match = data?.[0];
      if (!match) return { error: "No matching reminder found." };
      await supabase.from("reminders").delete().eq("id", match.id);
      ctx.onUndoableDelete?.(`Cancelled "${match.text}"`, async () => {
        await supabase.from("reminders").insert({
          id: match.id,
          user_id: ctx.userId,
          text: match.text,
          remind_at: match.remind_at,
          notified: false,
        });
      });
      return { ok: true, cancelled: match.text };
    }

    case "web_search": {
      const query = String(args.query ?? "");
      try {
        const res = await ctx.genAI.models.generateContent({
          model: TEXT_MODEL,
          contents: [{ role: "user", parts: [{ text: query }] }],
          config: { tools: [{ googleSearch: {} }] },
        });
        return { result: res.text ?? "No results." };
      } catch (e) {
        return { error: e instanceof Error ? e.message : "Search failed." };
      }
    }

    case "code_helper": {
      const action = String(args.action ?? "write");
      const prompt = String(args.prompt ?? "").trim();
      const code = String(args.code ?? "").trim();
      const language = String(args.language ?? "").trim();
      if (!prompt) return { error: "No instructions given." };
      if (action !== "write" && !code) return { error: `Need the existing code to ${action}.` };

      const instructionByAction: Record<string, string> = {
        write: `Write code for this request: ${prompt}`,
        explain: `Explain what this code does, plainly and concisely:\n\n${code}\n\nSpecifically: ${prompt}`,
        review: `Review this code for bugs, style, and design issues:\n\n${code}\n\nFocus especially on: ${prompt}`,
        fix: `Fix this code:\n\n${code}\n\nThe problem: ${prompt}`,
        optimize: `Optimize this code for performance/readability without changing its behavior:\n\n${code}\n\nGoal: ${prompt}`,
      };
      const langHint = language ? ` (language: ${language})` : "";
      const text = `${instructionByAction[action] ?? instructionByAction.write}${langHint}\n\nReply with the code plus a short explanation of what changed or why, suitable for reading aloud.`;

      try {
        const res = await ctx.genAI.models.generateContent({
          model: TEXT_MODEL,
          contents: [{ role: "user", parts: [{ text }] }],
        });
        return { result: res.text ?? "No response." };
      } catch (e) {
        return { error: e instanceof Error ? e.message : "Code helper failed." };
      }
    }

    case "go_to_sleep": {
      ctx.onSleepRequested?.();
      return { ok: true, note: "Now going quiet until woken." };
    }

    case "generate_image": {
      const prompt = String(args.prompt ?? "").trim();
      if (!prompt) return { error: "No description given." };
      try {
        const res = await ctx.genAI.models.generateContent({
          model: IMAGE_MODEL,
          contents: [{ role: "user", parts: [{ text: prompt }] }],
          config: { responseModalities: ["IMAGE"] },
        });
        const imgPart = res.candidates?.[0]?.content?.parts?.find((p) => p.inlineData?.data);
        if (!imgPart?.inlineData?.data) {
          const blockReason = res.promptFeedback?.blockReason;
          return { error: blockReason ? `Blocked: ${blockReason}` : "No image came back." };
        }
        const dataUrl = `data:${imgPart.inlineData.mimeType ?? "image/png"};base64,${imgPart.inlineData.data}`;
        ctx.onGeneratedImage?.(dataUrl, prompt);
        return { ok: true, shown_to_user: true };
      } catch (e) {
        return { error: e instanceof Error ? e.message : "Image generation failed." };
      }
    }

    case "watch_topic": {
      const topic = String(args.topic ?? "").trim();
      if (!topic) return { error: "No topic given." };
      if (isBlockedWatchTopic(topic)) {
        return { error: "Can't set up background monitoring for crypto/financial topics." };
      }
      const { error } = await supabase.from("watch_topics").insert({ user_id: ctx.userId, topic });
      if (error) return { error: error.message };
      return { ok: true, watching: topic };
    }

    case "list_watched_topics": {
      const { data } = await supabase
        .from("watch_topics")
        .select("topic, created_at")
        .eq("user_id", ctx.userId)
        .order("created_at", { ascending: false });
      return { topics: data?.map((t) => t.topic) ?? [] };
    }

    case "unwatch_topic": {
      const query = String(args.query ?? "").trim();
      const { data } = await supabase
        .from("watch_topics")
        .select("id, topic")
        .eq("user_id", ctx.userId)
        .ilike("topic", `%${query}%`)
        .limit(1);
      const match = data?.[0];
      if (!match) return { error: "No matching watched topic found." };
      await supabase.from("watch_topics").delete().eq("id", match.id);
      return { ok: true, stopped: match.topic };
    }

    case "open_youtube_search": {
      const query = String(args.query ?? "");
      const url = `https://www.youtube.com/results?search_query=${encodeURIComponent(query)}`;
      if (typeof window !== "undefined") window.open(url, "_blank", "noopener,noreferrer");
      return { ok: true, opened: url };
    }

    case "open_link": {
      let url = String(args.url ?? "");
      if (!/^https?:\/\//i.test(url)) url = `https://${url}`;
      if (typeof window !== "undefined") window.open(url, "_blank", "noopener,noreferrer");
      return { ok: true, opened: url };
    }

    default:
      return { error: `Unknown tool "${name}".` };
  }
}
