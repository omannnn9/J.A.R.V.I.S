import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let browserClient: SupabaseClient<any, any, any> | null = null;

export function getSupabaseBrowserClient() {
  if (browserClient) return browserClient;
  browserClient = createClient(url, anonKey, {
    auth: {
      // localStorage (the default) survives browser restarts, so once signed
      // in, JARVIS stays signed in until the user explicitly signs out.
      persistSession: true,
      autoRefreshToken: true,
      storageKey: "jarvis-auth",
    },
  });
  return browserClient;
}
