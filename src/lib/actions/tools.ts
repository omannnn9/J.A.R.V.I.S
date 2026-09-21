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
  // A running countdown, distinct from a reminder: shown live in the HUD
  // rather than persisted, since it only ever matters for the current tab
  // session (matches the desktop app's timer, which is likewise ephemeral).
  onTimerStarted?: (label: string, durationMs: number) => void;
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
        recurrence: {
          type: Type.STRING,
          description:
            "How often this reminder repeats after it first fires. 'none' (default) for a one-off reminder, 'daily' or 'weekly' for a recurring one at the same time of day.",
          enum: ["none", "daily", "weekly"],
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
  {
    name: "calculate",
    description: "Evaluate a math expression and return the exact result. Use for arithmetic the user asks you to compute — sums, percentages, splits, etc. — rather than doing it in your head.",
    parameters: {
      type: Type.OBJECT,
      properties: {
        expression: {
          type: Type.STRING,
          description: "A math expression using +, -, *, /, %, ^, and parentheses, e.g. '(120 + 35) * 1.08'.",
        },
      },
      required: ["expression"],
    },
  },
  {
    name: "convert_units",
    description: "Convert a value between units of length, mass, volume, or temperature. Use for questions like 'how many km is 5 miles' or 'convert 350°F to Celsius'.",
    parameters: {
      type: Type.OBJECT,
      properties: {
        value: { type: Type.NUMBER, description: "The numeric value to convert." },
        from_unit: { type: Type.STRING, description: "Unit to convert from, e.g. 'miles', 'kg', 'fahrenheit'." },
        to_unit: { type: Type.STRING, description: "Unit to convert to, e.g. 'km', 'lb', 'celsius'." },
      },
      required: ["value", "from_unit", "to_unit"],
    },
  },
  {
    name: "convert_currency",
    description: "Convert an amount from one currency to another using live exchange rates. Use for questions like 'how much is 100 dollars in euros'.",
    parameters: {
      type: Type.OBJECT,
      properties: {
        amount: { type: Type.NUMBER, description: "The amount to convert." },
        from_currency: { type: Type.STRING, description: "3-letter currency code to convert from, e.g. 'USD'." },
        to_currency: { type: Type.STRING, description: "3-letter currency code to convert to, e.g. 'EUR'." },
      },
      required: ["amount", "from_currency", "to_currency"],
    },
  },
  {
    name: "start_timer",
    description: "Start a live countdown timer for a set duration and alert the user when it's up. Use for things like 'set a timer for 10 minutes' — a visible, running countdown, distinct from set_reminder which is for a specific future time and doesn't need the tab open the whole time.",
    parameters: {
      type: Type.OBJECT,
      properties: {
        label: { type: Type.STRING, description: "What the timer is for, e.g. 'pasta' or 'break'." },
        minutes: { type: Type.NUMBER, description: "How many minutes the timer should run for." },
      },
      required: ["minutes"],
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

// Generated images are uploaded to a public Storage bucket keyed by the
// user's own folder (matches the storage.objects RLS policy) so they
// survive a reload instead of living only as an in-memory data: URL for the
// current session. A failed upload isn't fatal — the caller falls back to
// the raw data: URL, same as before this existed, just not persisted.
async function uploadGeneratedImage(userId: string, base64: string, mimeType: string): Promise<string | null> {
  try {
    const supabase = getSupabaseBrowserClient();
    const ext = mimeType === "image/jpeg" ? "jpg" : "png";
    const path = `${userId}/${crypto.randomUUID()}.${ext}`;
    const bytes = Uint8Array.from(atob(base64), (c) => c.charCodeAt(0));
    const { error } = await supabase.storage.from("generated-images").upload(path, bytes, { contentType: mimeType });
    if (error) return null;
    return supabase.storage.from("generated-images").getPublicUrl(path).data.publicUrl;
  } catch {
    return null;
  }
}

export function isBlockedWatchTopic(topic: string): boolean {
  const t = topic.toLowerCase();
  return WATCH_BLOCKLIST.some((kw) => t.includes(kw));
}

// A small recursive-descent parser rather than eval()/Function() — this
// runs on whatever expression the model decides to pass through, and
// eval'ing arbitrary strings is a real code-injection surface even when
// the "user" driving it is a trusted first party.
function evaluateExpression(expr: string): number {
  const tokens = expr.match(/\d+\.?\d*|\.\d+|[+\-*/%^()]/g);
  if (!tokens || !tokens.length) throw new Error("Not a valid math expression.");
  let pos = 0;
  const peek = () => tokens[pos];
  const consume = () => tokens[pos++];

  function parseExpr(): number {
    let value = parseTerm();
    while (peek() === "+" || peek() === "-") value = consume() === "+" ? value + parseTerm() : value - parseTerm();
    return value;
  }
  function parseTerm(): number {
    let value = parseUnary();
    while (peek() === "*" || peek() === "/" || peek() === "%") {
      const op = consume();
      const rhs = parseUnary();
      value = op === "*" ? value * rhs : op === "/" ? value / rhs : value % rhs;
    }
    return value;
  }
  function parseUnary(): number {
    if (peek() === "-") {
      consume();
      return -parsePower();
    }
    if (peek() === "+") consume();
    return parsePower();
  }
  function parsePower(): number {
    const base = parseAtom();
    if (peek() === "^") {
      consume();
      return Math.pow(base, parseUnary());
    }
    return base;
  }
  function parseAtom(): number {
    if (peek() === "(") {
      consume();
      const value = parseExpr();
      if (peek() !== ")") throw new Error("Mismatched parentheses.");
      consume();
      return value;
    }
    const tok = consume();
    const num = tok === undefined ? NaN : Number(tok);
    if (Number.isNaN(num)) throw new Error("Invalid expression.");
    return num;
  }

  const result = parseExpr();
  if (pos !== tokens.length) throw new Error("Invalid expression.");
  return result;
}

const UNIT_GROUPS: Record<string, Record<string, number>> = {
  length: {
    m: 1,
    meter: 1,
    meters: 1,
    km: 1000,
    kilometer: 1000,
    kilometers: 1000,
    cm: 0.01,
    centimeter: 0.01,
    centimeters: 0.01,
    mm: 0.001,
    millimeter: 0.001,
    millimeters: 0.001,
    mi: 1609.344,
    mile: 1609.344,
    miles: 1609.344,
    yd: 0.9144,
    yard: 0.9144,
    yards: 0.9144,
    ft: 0.3048,
    foot: 0.3048,
    feet: 0.3048,
    in: 0.0254,
    inch: 0.0254,
    inches: 0.0254,
  },
  mass: {
    kg: 1,
    kilogram: 1,
    kilograms: 1,
    g: 0.001,
    gram: 0.001,
    grams: 0.001,
    lb: 0.45359237,
    lbs: 0.45359237,
    pound: 0.45359237,
    pounds: 0.45359237,
    oz: 0.028349523125,
    ounce: 0.028349523125,
    ounces: 0.028349523125,
  },
  volume: {
    l: 1,
    liter: 1,
    liters: 1,
    litre: 1,
    litres: 1,
    ml: 0.001,
    milliliter: 0.001,
    milliliters: 0.001,
    gal: 3.785411784,
    gallon: 3.785411784,
    gallons: 3.785411784,
    cup: 0.2365882365,
    cups: 0.2365882365,
    floz: 0.0295735295625,
  },
};

const TEMPERATURE_ALIASES: Record<string, "celsius" | "fahrenheit" | "kelvin"> = {
  c: "celsius",
  celsius: "celsius",
  f: "fahrenheit",
  fahrenheit: "fahrenheit",
  k: "kelvin",
  kelvin: "kelvin",
};

function convertTemperature(value: number, from: string, to: string): number | null {
  const f = TEMPERATURE_ALIASES[from];
  const t = TEMPERATURE_ALIASES[to];
  if (!f || !t) return null;
  const celsius = f === "celsius" ? value : f === "fahrenheit" ? ((value - 32) * 5) / 9 : value - 273.15;
  if (t === "celsius") return celsius;
  if (t === "fahrenheit") return (celsius * 9) / 5 + 32;
  return celsius + 273.15;
}

function convertUnits(value: number, fromUnit: string, toUnit: string): number {
  const from = fromUnit.trim().toLowerCase().replace(/[°.]/g, "");
  const to = toUnit.trim().toLowerCase().replace(/[°.]/g, "");
  const tempResult = convertTemperature(value, from, to);
  if (tempResult !== null) return tempResult;
  for (const group of Object.values(UNIT_GROUPS)) {
    if (from in group && to in group) return (value * group[from]) / group[to];
  }
  throw new Error(`Don't know how to convert between "${fromUnit}" and "${toUnit}".`);
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
      const recurrenceArg = String(args.recurrence ?? "none");
      const recurrence = recurrenceArg === "daily" || recurrenceArg === "weekly" ? recurrenceArg : "none";
      const remindAt = new Date(Date.now() + minutes * 60_000).toISOString();
      const { error } = await supabase
        .from("reminders")
        .insert({ user_id: ctx.userId, text, remind_at: remindAt, recurrence });
      if (error) return { error: error.message };
      return { ok: true, text, remind_at: remindAt, recurrence };
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
        const mimeType = imgPart.inlineData.mimeType ?? "image/png";
        const base64 = imgPart.inlineData.data;
        const dataUrl = `data:${mimeType};base64,${base64}`;
        const persistedUrl = await uploadGeneratedImage(ctx.userId, base64, mimeType);
        ctx.onGeneratedImage?.(persistedUrl ?? dataUrl, prompt);
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

    case "calculate": {
      const expression = String(args.expression ?? "");
      try {
        const result = evaluateExpression(expression);
        if (!Number.isFinite(result)) return { error: "That expression doesn't evaluate to a finite number." };
        return { result };
      } catch (e) {
        return { error: e instanceof Error ? e.message : "Couldn't evaluate that expression." };
      }
    }

    case "convert_units": {
      const value = Number(args.value ?? NaN);
      const fromUnit = String(args.from_unit ?? "");
      const toUnit = String(args.to_unit ?? "");
      if (!Number.isFinite(value) || !fromUnit || !toUnit) {
        return { error: "Need a value, a from_unit, and a to_unit." };
      }
      try {
        const result = convertUnits(value, fromUnit, toUnit);
        return { result, from: `${value} ${fromUnit}`, to: `${result} ${toUnit}` };
      } catch (e) {
        return { error: e instanceof Error ? e.message : "Couldn't convert that." };
      }
    }

    case "convert_currency": {
      const amount = Number(args.amount ?? NaN);
      const from = String(args.from_currency ?? "").trim().toUpperCase();
      const to = String(args.to_currency ?? "").trim().toUpperCase();
      if (!Number.isFinite(amount) || !from || !to) {
        return { error: "Need an amount, a from_currency, and a to_currency." };
      }
      try {
        const res = await fetch(`https://api.frankfurter.app/latest?amount=${amount}&from=${from}&to=${to}`);
        if (!res.ok) return { error: "Currency conversion service unavailable." };
        const data = await res.json();
        const converted = data.rates?.[to];
        if (converted === undefined) return { error: `Don't recognize "${to}" as a currency code.` };
        return { result: converted, from: `${amount} ${from}`, to: `${converted} ${to}`, date: data.date };
      } catch {
        return { error: "Couldn't reach the currency conversion service." };
      }
    }

    case "start_timer": {
      const minutes = Number(args.minutes ?? 0);
      if (!minutes || minutes <= 0) return { error: "Need a positive number of minutes." };
      const label = String(args.label ?? "Timer").trim() || "Timer";
      ctx.onTimerStarted?.(label, minutes * 60_000);
      return { ok: true, label, minutes };
    }

    default:
      return { error: `Unknown tool "${name}".` };
  }
}
