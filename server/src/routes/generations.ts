import { Router } from "express";
import { z } from "zod";
import { requireAuth } from "../middleware/auth.js";
import { env } from "../config/env.js";
import {
  deleteGenerationLocal,
  getGenerationAudioLocal,
  listGenerationsLocal,
  updateGenerationLocal,
} from "../services/local-tts.js";
import { HttpError } from "../middleware/error-handler.js";

export const generationsRouter = Router();

generationsRouter.get("/", requireAuth, async (_req, res, next) => {
  try {
    res.json(env.TTS_PROVIDER === "local" ? await listGenerationsLocal() : []);
  } catch (err) {
    next(err);
  }
});

generationsRouter.get("/:generationId/audio", requireAuth, async (req, res, next) => {
  try {
    if (env.TTS_PROVIDER !== "local") {
      throw new HttpError(400, "Generation history is only supported for the local TTS provider");
    }
    const audio = await getGenerationAudioLocal(req.params.generationId);
    res.setHeader("Content-Type", "audio/wav");
    res.send(Buffer.from(audio));
  } catch (err) {
    next(err);
  }
});

const updateSchema = z.object({
  favorite: z.boolean().optional(),
  status: z.enum(["ready", "archived"]).optional(),
});

generationsRouter.patch("/:generationId", requireAuth, async (req, res, next) => {
  try {
    if (env.TTS_PROVIDER !== "local") {
      throw new HttpError(400, "Generation history is only supported for the local TTS provider");
    }
    const fields = updateSchema.parse(req.body);
    res.json(await updateGenerationLocal(req.params.generationId, fields));
  } catch (err) {
    next(err);
  }
});

generationsRouter.delete("/:generationId", requireAuth, async (req, res, next) => {
  try {
    if (env.TTS_PROVIDER !== "local") {
      throw new HttpError(400, "Generation history is only supported for the local TTS provider");
    }
    res.json(await deleteGenerationLocal(req.params.generationId));
  } catch (err) {
    next(err);
  }
});
