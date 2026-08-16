import { Router } from "express";
import multer from "multer";
import { requireAuth } from "../middleware/auth.js";
import { env } from "../config/env.js";
import { processAudioLocal } from "../services/local-tts.js";
import { HttpError } from "../middleware/error-handler.js";

export const audioRouter = Router();

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 50 * 1024 * 1024 },
});

audioRouter.post("/process", requireAuth, upload.single("file"), async (req, res, next) => {
  try {
    if (!req.file) throw new HttpError(400, "An audio file is required");
    if (env.TTS_PROVIDER !== "local") {
      throw new HttpError(400, "Audio processing is only available with the local TTS provider");
    }
    const operations = req.body.operations;
    if (!operations) throw new HttpError(400, "operations payload is required");

    const processed = await processAudioLocal(req.file.buffer, req.file.originalname, JSON.parse(operations));
    res.setHeader("Content-Type", "audio/wav");
    res.send(Buffer.from(processed));
  } catch (err) {
    next(err);
  }
});
