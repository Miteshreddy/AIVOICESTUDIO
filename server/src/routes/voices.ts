import { Router } from "express";
import multer from "multer";
import { z } from "zod";
import { requireAuth } from "../middleware/auth.js";
import { env } from "../config/env.js";
import { cloneVoice } from "../services/elevenlabs.js";
import {
  analyzeAudioLocal,
  cloneVoiceLocal,
  deleteVoiceLocal,
  getVoiceReferenceLocal,
  listVoicesLocal,
  updateVoiceLocal,
} from "../services/local-tts.js";
import { HttpError } from "../middleware/error-handler.js";

export const voicesRouter = Router();

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 25 * 1024 * 1024, files: 10 },
});

const cloneMetaSchema = z.object({
  name: z.string().min(1).max(100),
  description: z.string().max(500).optional().default(""),
});

voicesRouter.post("/clone", requireAuth, upload.array("files", 10), async (req, res, next) => {
  try {
    const files = req.files as Express.Multer.File[] | undefined;
    if (!files || files.length === 0) {
      throw new HttpError(400, "At least one audio sample is required");
    }

    const { name, description } = cloneMetaSchema.parse(req.body);

    if (env.TTS_PROVIDER === "local") {
      // Chatterbox clones zero-shot from a single reference clip — use the longest sample provided.
      const primary = files.reduce((a, b) => (b.size > a.size ? b : a));
      const result = await cloneVoiceLocal(name, description, primary.buffer, primary.originalname);
      return res.status(201).json(result);
    }

    const result = await cloneVoice(
      name,
      description,
      files.map((f) => f.buffer),
      files.map((f) => f.originalname),
    );

    res.status(201).json(result);
  } catch (err) {
    next(err);
  }
});

voicesRouter.post("/analyze", requireAuth, upload.single("file"), async (req, res, next) => {
  try {
    if (!req.file) throw new HttpError(400, "An audio file is required");
    if (env.TTS_PROVIDER !== "local") {
      throw new HttpError(400, "Audio analysis is only available with the local TTS provider");
    }
    res.json(await analyzeAudioLocal(req.file.buffer, req.file.originalname));
  } catch (err) {
    next(err);
  }
});

voicesRouter.get("/", requireAuth, async (_req, res, next) => {
  try {
    res.json(env.TTS_PROVIDER === "local" ? await listVoicesLocal() : []);
  } catch (err) {
    next(err);
  }
});

const updateSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  description: z.string().max(500).optional(),
  tags: z.array(z.string().max(30)).max(20).optional(),
});

voicesRouter.patch("/:voiceId", requireAuth, async (req, res, next) => {
  try {
    if (env.TTS_PROVIDER !== "local") {
      throw new HttpError(400, "Voice updates are only supported for the local TTS provider");
    }
    const fields = updateSchema.parse(req.body);
    res.json(await updateVoiceLocal(req.params.voiceId, fields));
  } catch (err) {
    next(err);
  }
});

voicesRouter.get("/:voiceId/reference", requireAuth, async (req, res, next) => {
  try {
    if (env.TTS_PROVIDER !== "local") {
      throw new HttpError(400, "Reference download is only supported for the local TTS provider");
    }
    const audio = await getVoiceReferenceLocal(req.params.voiceId);
    res.setHeader("Content-Type", "audio/wav");
    res.setHeader("Content-Disposition", `attachment; filename="${req.params.voiceId}-reference.wav"`);
    res.send(Buffer.from(audio));
  } catch (err) {
    next(err);
  }
});

voicesRouter.delete("/:voiceId", requireAuth, async (req, res, next) => {
  try {
    if (env.TTS_PROVIDER !== "local") {
      throw new HttpError(400, "Voice deletion is only supported for the local TTS provider");
    }
    res.json(await deleteVoiceLocal(req.params.voiceId));
  } catch (err) {
    next(err);
  }
});
