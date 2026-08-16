import { env } from "../config/env.js";
import { HttpError } from "../middleware/error-handler.js";

const BASE_URL = "https://api.openai.com/v1";

function requireKey() {
  if (!env.OPENAI_API_KEY) {
    throw new HttpError(503, "OpenAI is not configured — set OPENAI_API_KEY on the server.");
  }
  return env.OPENAI_API_KEY;
}

async function chatCompletion(systemPrompt: string, userPrompt: string): Promise<string> {
  const apiKey = requireKey();

  const response = await fetch(`${BASE_URL}/chat/completions`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "gpt-4o-mini",
      temperature: 0.7,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
    }),
  });

  if (!response.ok) {
    throw new HttpError(response.status, "OpenAI request failed", await response.text());
  }

  const data = (await response.json()) as {
    choices: { message: { content: string } }[];
  };

  return data.choices[0]?.message.content?.trim() ?? "";
}

const actionPrompts: Record<string, string> = {
  rewrite: "Rewrite the following text to be clearer and more polished, preserving its original meaning and length. Return only the rewritten text.",
  summarize: "Summarize the following text concisely, preserving the key points. Return only the summary.",
  expand: "Expand the following text with additional detail and richer description, keeping the same tone. Return only the expanded text.",
  grammar: "Fix all grammar, spelling, and punctuation errors in the following text without changing its meaning or style. Return only the corrected text.",
};

export function transformText(text: string, action: string, options: { targetLanguage?: string; emotion?: string }) {
  if (action === "translate") {
    return chatCompletion(
      `Translate the following text into ${options.targetLanguage ?? "Spanish"}. Return only the translated text.`,
      text,
    );
  }
  if (action === "emotion") {
    return chatCompletion(
      `Rewrite the following text so it reads with a ${options.emotion ?? "neutral"} emotional tone, suitable for text-to-speech narration. Return only the rewritten text.`,
      text,
    );
  }
  const prompt = actionPrompts[action];
  if (!prompt) throw new HttpError(400, `Unknown text action: ${action}`);
  return chatCompletion(prompt, text);
}

export function recommendVoiceAttributes(scriptText: string) {
  return chatCompletion(
    "You are a voice direction assistant. Given a script, recommend a voice style (e.g. warm, energetic, calm) and delivery notes in 2-3 sentences.",
    scriptText,
  );
}

export function annotatePronunciation(text: string) {
  return chatCompletion(
    "Identify any numbers, dates, acronyms, or proper nouns in the following text that a text-to-speech engine might mispronounce. Rewrite the text with those items spelled out phonetically or in expanded word form so a TTS engine will pronounce them correctly. Return only the rewritten text.",
    text,
  );
}

export function suggestPacing(text: string) {
  return chatCompletion(
    "Add natural pause markers using '...' at points in the following text where a professional voice actor would pause for emphasis or breath. Return only the annotated text.",
    text,
  );
}
