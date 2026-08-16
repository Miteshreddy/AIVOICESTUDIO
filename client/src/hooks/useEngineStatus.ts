import { useQuery } from "@tanstack/react-query";
import { apiClient } from "@/services/api-client";

interface HealthResponse {
  status: string;
  integrations: { localTtsConfigured: boolean };
  localTts: { status: string; modelLoaded: boolean; model?: { status: string } } | null;
}

export function useEngineStatus() {
  const { data } = useQuery({
    queryKey: ["engine-health"],
    queryFn: () => apiClient.get<HealthResponse>("/health"),
    refetchInterval: (query) => (query.state.data?.localTts?.modelLoaded ? false : 3000),
    retry: false,
  });

  const reachable = data?.localTts !== null && data?.localTts !== undefined;
  const modelStatus = data?.localTts?.model?.status ?? "idle";
  const ready = data?.localTts?.modelLoaded ?? false;

  return { reachable, ready, modelStatus, checked: data !== undefined };
}
