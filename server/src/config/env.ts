import "dotenv/config";
import { z } from "zod";

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "production", "test"]).default("development"),
  PORT: z.coerce.number().default(8787),

  SUPABASE_URL: z.string().url().optional(),
  SUPABASE_SERVICE_ROLE_KEY: z.string().optional(),
  ENCRYPTION_KEY: z.string().min(16).optional(),

  TTS_PROVIDER: z.enum(["local", "elevenlabs"]).default("local"),
  LOCAL_TTS_URL: z.string().default("http://localhost:8095"),

  ELEVENLABS_API_KEY: z.string().optional(),
  OPENAI_API_KEY: z.string().optional(),
  GROQ_API_KEY: z.string().optional(),
  DEEPGRAM_API_KEY: z.string().optional(),

  RATE_LIMIT_WINDOW_MS: z.coerce.number().default(60_000),
  RATE_LIMIT_MAX_REQUESTS: z.coerce.number().default(60),

  CORS_ORIGIN: z.string().default("http://localhost:5173"),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  console.error("Invalid environment configuration:", parsed.error.flatten().fieldErrors);
  throw new Error("Invalid environment configuration");
}

export const env = parsed.data;

export const featureFlags = {
  supabaseConfigured: Boolean(env.SUPABASE_URL && env.SUPABASE_SERVICE_ROLE_KEY),
  localTtsConfigured: env.TTS_PROVIDER === "local",
  elevenLabsConfigured: Boolean(env.ELEVENLABS_API_KEY),
  openAiConfigured: Boolean(env.OPENAI_API_KEY),
  deepgramConfigured: Boolean(env.DEEPGRAM_API_KEY),
};
