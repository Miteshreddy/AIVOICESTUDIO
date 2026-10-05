import { Router } from "express";
import { z } from "zod";
import { requireAuth } from "../middleware/auth.js";
import { validateBody } from "../middleware/validate.js";
import { env } from "../config/env.js";
import { generateSpeech, listVoices } from "../services/elevenlabs.js";
import { generateSpeechLocal, listVoicesLocal } from "../services/local-tts.js";

export const ttsRouter = Router();

const generateSchema = z.object({
  voiceId: z.string().min(1),
  text: z.string().min(1).max(20_000),
  // 0 = more varied & expressive, 1 = steadier
  stability: z.number().min(0).max(1).optional(),
  speed: z.number().min(0.5).max(2).optional(),
  seed: z.number().int().optional(),
  takes: z.number().int().min(1).max(3).optional(),
  pitchSemitones: z.number().min(-4).max(4).optional(),
  brightness: z.number().min(-1).max(1).optional(),
  warmth: z.number().min(-1).max(1).optional(),
});

ttsRouter.post("/generate", requireAuth, validateBody(generateSchema), async (req, res, next) => {
  try {
    const body = req.body as z.infer<typeof generateSchema>;

    const audio =
      env.TTS_PROVIDER === "local"
        ? await generateSpeechLocal(body)
        : await generateSpeech(body);

    res.setHeader("Content-Type", env.TTS_PROVIDER === "local" ? "audio/wav" : "audio/mpeg");
    res.send(Buffer.isBuffer(audio) ? audio : Buffer.from(new Uint8Array(audio)));
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
