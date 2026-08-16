function countSyllables(word: string): number {
  const normalized = word.toLowerCase().replace(/[^a-z]/g, "");
  if (!normalized) return 0;
  const matches = normalized.match(/[aeiouy]+/g);
  let count = matches ? matches.length : 1;
  if (normalized.endsWith("e") && count > 1) count -= 1;
  return Math.max(count, 1);
}

export interface ReadabilityResult {
  score: number;
  label: "Very Easy" | "Easy" | "Moderate" | "Difficult" | "Very Difficult";
}

export function calculateReadability(text: string): ReadabilityResult {
  const trimmed = text.trim();
  if (!trimmed) return { score: 100, label: "Very Easy" };

  const words = trimmed.split(/\s+/).filter(Boolean);
  const sentences = trimmed.split(/[.!?]+/).filter((s) => s.trim().length > 0);
  const syllables = words.reduce((sum, w) => sum + countSyllables(w), 0);

  const wordCount = Math.max(words.length, 1);
  const sentenceCount = Math.max(sentences.length, 1);

  const rawScore =
    206.835 - 1.015 * (wordCount / sentenceCount) - 84.6 * (syllables / wordCount);
  const score = Math.max(0, Math.min(100, Math.round(rawScore)));

  let label: ReadabilityResult["label"] = "Moderate";
  if (score >= 90) label = "Very Easy";
  else if (score >= 70) label = "Easy";
  else if (score >= 50) label = "Moderate";
  else if (score >= 30) label = "Difficult";
  else label = "Very Difficult";

  return { score, label };
}
