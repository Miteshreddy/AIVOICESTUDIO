import { Router } from "express";
import { z } from "zod";
import { requireAuth } from "../middleware/auth.js";
import { validateBody } from "../middleware/validate.js";
import { transformText } from "../services/openai.js";

export const textRouter = Router();

const transformSchema = z.object({
  text: z.string().min(1).max(20_000),
  action: z.enum(["rewrite", "summarize", "expand", "translate", "grammar", "emotion"]),
  targetLanguage: z.string().optional(),
  emotion: z.string().optional(),
});

textRouter.post("/transform", requireAuth, validateBody(transformSchema), async (req, res, next) => {
  try {
    const { text, action, targetLanguage, emotion } = req.body as z.infer<typeof transformSchema>;
    const result = await transformText(text, action, { targetLanguage, emotion });
    res.json({ result });
  } catch (err) {
    next(err);
  }
});
