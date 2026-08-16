import { Router } from "express";
import { z } from "zod";
import { requireAuth } from "../middleware/auth.js";
import { validateBody } from "../middleware/validate.js";
import { annotatePronunciation, recommendVoiceAttributes, suggestPacing } from "../services/openai.js";

export const aiFeaturesRouter = Router();

const textSchema = z.object({ text: z.string().min(1).max(20_000) });

aiFeaturesRouter.post("/pronunciation", requireAuth, validateBody(textSchema), async (req, res, next) => {
  try {
    const result = await annotatePronunciation(req.body.text);
    res.json({ result });
  } catch (err) {
    next(err);
  }
});

aiFeaturesRouter.post("/pacing", requireAuth, validateBody(textSchema), async (req, res, next) => {
  try {
    const result = await suggestPacing(req.body.text);
    res.json({ result });
  } catch (err) {
    next(err);
  }
});

aiFeaturesRouter.post("/recommend-voice", requireAuth, validateBody(textSchema), async (req, res, next) => {
  try {
    const result = await recommendVoiceAttributes(req.body.text);
    res.json({ result });
  } catch (err) {
    next(err);
  }
});
