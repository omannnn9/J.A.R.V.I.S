import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { authStorage } from "./storage";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let browserClient: SupabaseClient<any, any, any> | null = null;

export function getSupabaseBrowserClient() {
  if (browserClient) return browserClient;
  browserClient = createClient(url, anonKey, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      storage: typeof window === "undefined" ? undefined : authStorage,
      storageKey: "jarvis-auth",
    },
  });
  return browserClient;
}
