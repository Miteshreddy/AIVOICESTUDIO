import { apiClient } from "./api-client";

export type TextAiAction =
  | "rewrite"
  | "summarize"
  | "expand"
  | "translate"
  | "grammar"
  | "emotion";

interface TextAiRequest {
  text: string;
  action: TextAiAction;
  targetLanguage?: string;
  emotion?: string;
}

interface TextAiResponse {
  result: string;
}

export function runTextAiAction(request: TextAiRequest) {
  return apiClient.post<TextAiResponse>("/api/text/transform", request);
}
