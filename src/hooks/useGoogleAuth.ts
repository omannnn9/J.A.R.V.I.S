"use client";

import { useCallback, useEffect, useState } from "react";
import { connectGoogle, disconnectGoogle, isGoogleConfigured, isGoogleConnected } from "@/lib/google/client";

export function useGoogleAuth() {
  const [configured, setConfigured] = useState(false);
  const [connected, setConnected] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- one-time read of env/sessionStorage, not derived state
    setConfigured(isGoogleConfigured());
    setConnected(isGoogleConnected());
  }, []);

  const connect = useCallback(async () => {
    setBusy(true);
    setError(null);
    try {
      await connectGoogle();
      setConnected(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't connect to Google.");
    } finally {
      setBusy(false);
    }
  }, []);

  const disconnect = useCallback(() => {
    disconnectGoogle();
    setConnected(false);
  }, []);

  return { configured, connected, busy, error, connect, disconnect };
}
