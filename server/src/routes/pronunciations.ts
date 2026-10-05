import { Router } from "express";
import { z } from "zod";
import { requireAuth } from "../middleware/auth.js";
import { validateBody } from "../middleware/validate.js";
import { getPronunciationsLocal, putPronunciationsLocal } from "../services/local-tts.js";

export const pronunciationsRouter = Router();

const schema = z.record(z.string().min(1).max(60), z.string().min(1).max(120)).refine((r) => Object.keys(r).length <= 500);

pronunciationsRouter.get("/", requireAuth, async (_req, res, next) => {
  try {
    res.json(await getPronunciationsLocal());
  } catch (err) {
    next(err);
  }
});

pronunciationsRouter.put("/", requireAuth, validateBody(schema), async (req, res, next) => {
  try {
    res.json(await putPronunciationsLocal(req.body as Record<string, string>));
  } catch (err) {
    next(err);
  }
});
