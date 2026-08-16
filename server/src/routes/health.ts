import { Router } from "express";
import { env, featureFlags } from "../config/env.js";
import { localTtsHealth } from "../services/local-tts.js";

export const healthRouter = Router();

healthRouter.get("/", async (_req, res) => {
  const localTts = env.TTS_PROVIDER === "local" ? await localTtsHealth() : null;

  res.json({
    status: "ok",
    timestamp: new Date().toISOString(),
    integrations: featureFlags,
    localTts,
  });
});
