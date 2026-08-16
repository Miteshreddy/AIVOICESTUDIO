import { Router } from "express";
import { z } from "zod";
import { requireAuth } from "../middleware/auth.js";
import { validateBody } from "../middleware/validate.js";
import { env } from "../config/env.js";
import { generateSpeech, listVoices } from "../services/elevenlabs.js";
import { generateSpeechLocal, listVoicesLocal } from "../services/local-tts.js";

export const ttsRouter = Router();

const generateSchema = z.object({
  voiceId: z.string().optional(),
  text: z.string().min(1).max(5_000),
  // ElevenLabs-style controls (used when TTS_PROVIDER=elevenlabs)
  stability: z.number().min(0).max(1).optional(),
  similarityBoost: z.number().min(0).max(1).optional(),
  style: z.number().min(0).max(1).optional(),
  speed: z.number().min(0.5).max(2).optional(),
  // Local Chatterbox-style controls (used when TTS_PROVIDER=local)
  exaggeration: z.number().min(0).max(1).optional(),
  cfgWeight: z.number().min(0).max(1).optional(),
  temperature: z.number().min(0).max(2).optional(),
});

ttsRouter.post("/generate", requireAuth, validateBody(generateSchema), async (req, res, next) => {
  try {
    const body = req.body as z.infer<typeof generateSchema>;

    const audio =
      env.TTS_PROVIDER === "local"
        ? await generateSpeechLocal(body)
        : await generateSpeech({ ...body, voiceId: body.voiceId! });

    res.setHeader("Content-Type", env.TTS_PROVIDER === "local" ? "audio/wav" : "audio/mpeg");
    res.send(Buffer.from(audio));
  } catch (err) {
    next(err);
  }
});

ttsRouter.get("/voices", requireAuth, async (_req, res, next) => {
  try {
    res.json(env.TTS_PROVIDER === "local" ? await listVoicesLocal() : await listVoices());
  } catch (err) {
    next(err);
  }
});
