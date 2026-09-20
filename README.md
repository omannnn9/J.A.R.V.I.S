# JARVIS — Web

A free, hostable, browser-based reimagining of the [Mark LIV](https://github.com/) desktop JARVIS
assistant. Same dark holographic HUD, same indigo accent, same voice-driven personal-assistant
feel — rebuilt so it runs for anyone, on any device, at a URL, with no install.

## What this is

- **Next.js 16** (App Router) + Tailwind, deployed on Vercel.
- **Supabase** for auth (email/password, "remember me") and storage (per-user memory, reminders,
  chat history) — free tier, no subscriptions, no paywalls.
- **Gemini API** (`@google/genai`, browser SDK) for chat, vision, and function-calling "actions" —
  each user supplies their own free key from [aistudio.google.com/apikey](https://aistudio.google.com/apikey),
  stored on their own account only, so running this costs the site owner nothing no matter how many
  people sign up.
- Voice via the Web Speech API (STT) + `speechSynthesis` (TTS) — works across Chrome, Edge, and
  Safari; gracefully disables the mic button where a browser doesn't support it (e.g. Firefox).
- "Vision" via `getDisplayMedia` (screen share) and `getUserMedia` (webcam) — user-granted, one
  frame at a time, sent to Gemini alongside the conversation.

## What's different from the desktop app, on purpose

The original is a PyQt6 desktop app with OS-level powers: launching native applications, editing
the Windows registry, toggling Wi-Fi/power, a global system-wide hotkey, auto-start on boot, and
always-on background wake-word listening. No website can do any of that — browsers sandbox exactly
this class of capability for every site, as a security boundary, not a limitation of this build.
Where a browser-safe equivalent exists, it's implemented (screen share instead of raw screen
capture, file upload instead of local filesystem access, tab-focused push-to-talk instead of a
global hotkey). Where none exists, the assistant says so plainly rather than pretending to comply.

## Local development

```bash
npm install
cp .env.local.example .env.local   # fill in your Supabase project's URL + anon key
npm run dev
```

## Environment variables

| Variable | Description |
| --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | Your Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Your Supabase project's anon/publishable key |

Gemini API keys are **not** an environment variable — each signed-in user enters their own in
Settings, stored in their `profiles` row (RLS-restricted to that user only).

## Database

See the `profiles`, `memories`, `reminders`, `messages`, and `watch_topics` tables — all RLS-locked
to `auth.uid()`. A trigger on `auth.users` auto-creates a `profiles` row on signup.
