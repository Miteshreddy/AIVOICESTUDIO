import { useRef } from "react";
import { toast } from "sonner";
import { downloadVoiceReference } from "@/services/tts-service";
import { ApiError } from "@/services/api-client";
import { useAudioPlayerStore } from "@/store/audio-player-store";

// Voice ids and generation ids share the same global player, so namespace
// them to avoid an accidental collision between a voice preview and a
// generation result that happen to reuse the same id.
const NAMESPACE = "voice:";

export function useVoicePreview() {
  const { playingId, loadingId, isPaused, toggle: togglePlayback } = useAudioPlayerStore();
  const cache = useRef<Map<string, string>>(new Map());

  async function toggle(voiceId: string) {
    const key = NAMESPACE + voiceId;
    try {
      let url = cache.current.get(voiceId);
      if (!url) {
        url = await downloadVoiceReference(voiceId);
        cache.current.set(voiceId, url);
      }
      await togglePlayback(key, url);
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Couldn't reach the local TTS engine.");
    }
  }

  const activeVoiceId = playingId?.startsWith(NAMESPACE) ? playingId.slice(NAMESPACE.length) : null;
  const activeLoadingId = loadingId?.startsWith(NAMESPACE) ? loadingId.slice(NAMESPACE.length) : null;

  return {
    toggle,
    loadingId: activeLoadingId,
    playingId: isPaused ? null : activeVoiceId,
  };
}
