"use client";

// This app has no backend (everything talks to Supabase/Gemini/Google
// directly from the browser), so there's nowhere safe to hold a Google
// OAuth client *secret* or a long-lived refresh token — either would have
// to ship to the browser, defeating the point of keeping them secret. So
// this uses Google Identity Services' token flow instead: a public client
// ID only (no secret), returning a short-lived (~1hr) access token
// straight to the browser via a popup. The tradeoff, on purpose: unlike
// the Gemini key, "connecting" Google doesn't persist forever — it's
// cached for this tab's session only (sessionStorage) and needs
// reconnecting once it expires or a new session starts.
const CLIENT_ID = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID ?? "";
const SCOPES = [
  "https://www.googleapis.com/auth/calendar.readonly",
  "https://www.googleapis.com/auth/calendar.events",
  "https://www.googleapis.com/auth/gmail.readonly",
].join(" ");

const TOKEN_KEY = "jarvis-google-token";
const EXPIRES_KEY = "jarvis-google-token-expires";

interface GoogleTokenResponse {
  access_token?: string;
  expires_in?: number;
  error?: string;
}

interface GoogleTokenClient {
  requestAccessToken: (overrideConfig?: { prompt?: string }) => void;
}

interface GoogleAccountsOAuth2 {
  initTokenClient: (config: {
    client_id: string;
    scope: string;
    callback: (response: GoogleTokenResponse) => void;
  }) => GoogleTokenClient;
  revoke: (token: string, callback?: () => void) => void;
}

declare global {
  interface Window {
    google?: { accounts: { oauth2: GoogleAccountsOAuth2 } };
  }
}

let scriptLoadPromise: Promise<void> | null = null;

function loadGisScript(): Promise<void> {
  if (scriptLoadPromise) return scriptLoadPromise;
  scriptLoadPromise = new Promise((resolve, reject) => {
    if (typeof document === "undefined") {
      reject(new Error("Not in a browser."));
      return;
    }
    if (document.getElementById("google-gis-script")) {
      resolve();
      return;
    }
    const script = document.createElement("script");
    script.id = "google-gis-script";
    script.src = "https://accounts.google.com/gsi/client";
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error("Couldn't load Google's sign-in script."));
    document.head.appendChild(script);
  });
  return scriptLoadPromise;
}

function readCachedToken(): string | null {
  if (typeof window === "undefined") return null;
  const token = sessionStorage.getItem(TOKEN_KEY);
  const expiresAt = Number(sessionStorage.getItem(EXPIRES_KEY) ?? 0);
  if (!token || !expiresAt || Date.now() >= expiresAt) return null;
  return token;
}

function cacheToken(token: string, expiresInSeconds: number) {
  // Renew a little before actual expiry so an in-flight tool call never
  // gets handed a token that dies mid-request.
  const expiresAt = Date.now() + (expiresInSeconds - 60) * 1000;
  sessionStorage.setItem(TOKEN_KEY, token);
  sessionStorage.setItem(EXPIRES_KEY, String(expiresAt));
}

export function isGoogleConfigured(): boolean {
  return !!CLIENT_ID;
}

export function isGoogleConnected(): boolean {
  return readCachedToken() !== null;
}

export function getCachedGoogleAccessToken(): string | null {
  return readCachedToken();
}

export async function connectGoogle(): Promise<void> {
  if (!CLIENT_ID) throw new Error("Google isn't configured for this deployment yet.");
  await loadGisScript();
  const google = window.google;
  if (!google) throw new Error("Google's sign-in script didn't load.");

  await new Promise<void>((resolve, reject) => {
    const client = google.accounts.oauth2.initTokenClient({
      client_id: CLIENT_ID,
      scope: SCOPES,
      callback: (response) => {
        if (response.error || !response.access_token) {
          reject(new Error(response.error ?? "Google sign-in was cancelled or failed."));
          return;
        }
        cacheToken(response.access_token, response.expires_in ?? 3600);
        resolve();
      },
    });
    // Only ever called from a real click (the Settings "Connect" button),
    // never a background tool call — Google's own popup would be blocked
    // otherwise, same reasoning as every other popup in this app.
    client.requestAccessToken({ prompt: "consent" });
  });
}

export function disconnectGoogle(): void {
  const token = readCachedToken();
  sessionStorage.removeItem(TOKEN_KEY);
  sessionStorage.removeItem(EXPIRES_KEY);
  if (token && window.google) {
    window.google.accounts.oauth2.revoke(token);
  }
}
