import { Router } from "express";
import multer from "multer";
import { requireAuth } from "../middleware/auth.js";
import { transcribeAudio } from "../services/deepgram.js";
import { HttpError } from "../middleware/error-handler.js";

export const transcribeRouter = Router();

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 50 * 1024 * 1024 },
});

transcribeRouter.post("/", requireAuth, upload.single("file"), async (req, res, next) => {
  try {
    if (!req.file) throw new HttpError(400, "An audio file is required");
    const result = await transcribeAudio(req.file.buffer, req.file.mimetype);
    res.json(result);
  } catch (err) {
    next(err);
  }
});
