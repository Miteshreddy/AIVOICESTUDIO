import { env } from "../config/env.js";
import { HttpError } from "../middleware/error-handler.js";

const BASE_URL = "https://api.deepgram.com/v1";

function requireKey() {
  if (!env.DEEPGRAM_API_KEY) {
    throw new HttpError(503, "Deepgram is not configured — set DEEPGRAM_API_KEY on the server.");
  }
  return env.DEEPGRAM_API_KEY;
}

export interface TranscriptionResult {
  transcript: string;
  confidence: number;
  detectedLanguage?: string;
}

export async function transcribeAudio(buffer: Buffer, mimeType: string): Promise<TranscriptionResult> {
  const apiKey = requireKey();

  const response = await fetch(
    `${BASE_URL}/listen?smart_format=true&detect_language=true&punctuate=true`,
    {
      method: "POST",
      headers: {
        Authorization: `Token ${apiKey}`,
        "Content-Type": mimeType,
      },
      body: buffer,
    },
  );

  if (!response.ok) {
    throw new HttpError(response.status, "Deepgram transcription failed", await response.text());
  }

  const data = (await response.json()) as {
    results: {
      channels: {
        detected_language?: string;
        alternatives: { transcript: string; confidence: number }[];
      }[];
    };
  };

  const channel = data.results.channels[0];
  const alternative = channel?.alternatives[0];

  return {
    transcript: alternative?.transcript ?? "",
    confidence: alternative?.confidence ?? 0,
    detectedLanguage: channel?.detected_language,
  };
}
