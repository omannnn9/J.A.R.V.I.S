// Supabase session persistence that respects a "remember me" choice made at
// login time. When remembered, the session lives in localStorage (survives
// browser restarts, refreshed automatically). When not, it lives in
// sessionStorage (gone the moment the tab/browser closes).
const REMEMBER_FLAG = "jarvis-remember-me";

export function setRememberMe(remember: boolean) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(REMEMBER_FLAG, remember ? "1" : "0");
}

function rememberMe(): boolean {
  if (typeof window === "undefined") return true;
  return window.localStorage.getItem(REMEMBER_FLAG) !== "0";
}

function activeStorage(): Storage | null {
  if (typeof window === "undefined") return null;
  return rememberMe() ? window.localStorage : window.sessionStorage;
}

export const authStorage = {
  getItem: (key: string) => {
    const primary = activeStorage();
    const value = primary?.getItem(key);
    if (value) return value;
    // fall back to the other storage in case the flag changed mid-session
    if (typeof window === "undefined") return null;
    const other = primary === window.localStorage ? window.sessionStorage : window.localStorage;
    return other.getItem(key);
  },
  setItem: (key: string, value: string) => {
    activeStorage()?.setItem(key, value);
  },
  removeItem: (key: string) => {
    if (typeof window === "undefined") return;
    window.localStorage.removeItem(key);
    window.sessionStorage.removeItem(key);
  },
};
