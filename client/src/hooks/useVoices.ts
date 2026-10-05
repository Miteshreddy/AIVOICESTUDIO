import { useEffect, useMemo } from "react";
import { useRealVoicesStore } from "@/store/real-voices-store";

const RETRY_MS = 2500;

/**
 * Voice library, fetched once and re-fetched automatically while the engine is
 * unreachable — the web app usually boots before the voice engine does, and a
 * failed first fetch must never leave the app looking like it has no voices.
 */
export function useVoices() {
  const { voices, loaded, failed, refresh } = useRealVoicesStore();

  useEffect(() => {
    if (!loaded) void refresh();
  }, [loaded, refresh]);

  useEffect(() => {
    if (!failed) return;
    const timer = setInterval(() => void refresh(), RETRY_MS);
    return () => clearInterval(timer);
  }, [failed, refresh]);

  return useMemo(() => {
    // Pro (fine-tuned) voices first.
    const featured = voices
      .filter((v) => v.source === "library")
      .sort((a, b) => Number(!!b.fineTuned) - Number(!!a.fineTuned));
    const mine = voices.filter((v) => v.source === "user");
    // "connecting" until the engine has answered at least once.
    return { all: voices, featured, mine, loaded: loaded && !failed, connecting: failed };
  }, [voices, loaded, failed]);
}
