import { Router } from "express";
import { z } from "zod";
import { requireAuth } from "../middleware/auth.js";
import { validateBody } from "../middleware/validate.js";
import { soundEffectLocal } from "../services/local-tts.js";

export const soundEffectsRouter = Router();

const schema = z.object({
  prompt: z.string().min(2).max(500),
  durationSeconds: z.number().min(1).max(30).optional(),
  promptInfluence: z.number().min(0).max(1).optional(),
  seed: z.number().int().optional(),
  quality: z.enum(["draft", "standard", "high"]).optional(),
});

soundEffectsRouter.post("/generate", requireAuth, validateBody(schema), async (req, res, next) => {
  try {
    const audio = await soundEffectLocal(req.body as z.infer<typeof schema>);
    res.setHeader("Content-Type", "audio/wav");
    res.send(audio);
  } catch (err) {
    next(err);
  }
});
