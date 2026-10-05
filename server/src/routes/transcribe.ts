import { Router } from "express";
import multer from "multer";
import { requireAuth } from "../middleware/auth.js";
import { transcribeAudio } from "../services/deepgram.js";
import { transcribeLocal } from "../services/local-tts.js";
import { featureFlags } from "../config/env.js";
import { HttpError } from "../middleware/error-handler.js";

export const transcribeRouter = Router();

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 50 * 1024 * 1024 },
});

transcribeRouter.post("/", requireAuth, upload.single("file"), async (req, res, next) => {
  try {
    if (!req.file) throw new HttpError(400, "An audio file is required");
    // Local Whisper by default (free, offline); Deepgram only if a key is configured.
    const result = featureFlags.deepgramConfigured
      ? await transcribeAudio(req.file.buffer, req.file.mimetype)
      : await transcribeLocal(req.file.buffer, req.file.originalname, req.body?.language);
    res.json(result);
  } catch (err) {
    next(err);
  }
});
