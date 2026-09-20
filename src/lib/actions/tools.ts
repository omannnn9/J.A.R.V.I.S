import { Type, type FunctionDeclaration, type GoogleGenAI } from "@google/genai";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import { TEXT_MODEL } from "@/lib/gemini/client";

export interface ToolContext {
  userId: string;
  genAI: GoogleGenAI;
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
        .select("id, content")
        .eq("user_id", ctx.userId)
        .ilike("content", `%${query}%`)
        .limit(1);
      const match = data?.[0];
      if (!match) return { error: "No matching memory found." };
      await supabase.from("memories").delete().eq("id", match.id);
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
        .select("id, text")
        .eq("user_id", ctx.userId)
        .eq("notified", false)
        .ilike("text", `%${query}%`)
        .limit(1);
      const match = data?.[0];
      if (!match) return { error: "No matching reminder found." };
      await supabase.from("reminders").delete().eq("id", match.id);
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
