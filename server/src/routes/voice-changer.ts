import { Router } from "express";
import multer from "multer";
import { z } from "zod";
import { requireAuth } from "../middleware/auth.js";
import { HttpError } from "../middleware/error-handler.js";
import { voiceChangerLocal } from "../services/local-tts.js";

export const voiceChangerRouter = Router();

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 50 * 1024 * 1024 } });

const schema = z.object({
  voiceId: z.string().min(1),
  removeNoise: z
    .union([z.boolean(), z.string()])
    .optional()
    .transform((v) => v === true || v === "true"),
});

voiceChangerRouter.post("/convert", requireAuth, upload.single("file"), async (req, res, next) => {
  try {
    if (!req.file) throw new HttpError(400, "An audio file is required");
    const { voiceId, removeNoise } = schema.parse(req.body);
    const audio = await voiceChangerLocal(voiceId, req.file.buffer, req.file.originalname, removeNoise);
    res.setHeader("Content-Type", "audio/wav");
    res.send(audio);
  } catch (err) {
    next(err);
  }
});
