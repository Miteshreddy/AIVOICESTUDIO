import express from "express";
import cors from "cors";
import helmet from "helmet";
import compression from "compression";
import morgan from "morgan";
import { env } from "./config/env.js";
import { apiRateLimiter } from "./middleware/rate-limit.js";
import { errorHandler, notFoundHandler } from "./middleware/error-handler.js";
import { healthRouter } from "./routes/health.js";
import { textRouter } from "./routes/text.js";
import { ttsRouter } from "./routes/tts.js";
import { voicesRouter } from "./routes/voices.js";
import { transcribeRouter } from "./routes/transcribe.js";
import { aiFeaturesRouter } from "./routes/ai-features.js";
import { settingsRouter } from "./routes/settings.js";
import { audioRouter } from "./routes/audio.js";
import { generationsRouter } from "./routes/generations.js";

const app = express();

app.use(helmet());
app.use(
  cors({
    origin: env.CORS_ORIGIN,
    credentials: true,
  }),
);
app.use(compression());
app.use(express.json({ limit: "2mb" }));
app.use(morgan(env.NODE_ENV === "development" ? "dev" : "combined"));
app.use("/api", apiRateLimiter);

app.use("/health", healthRouter);
app.use("/api/text", textRouter);
app.use("/api/tts", ttsRouter);
app.use("/api/voices", voicesRouter);
app.use("/api/transcribe", transcribeRouter);
app.use("/api/ai", aiFeaturesRouter);
app.use("/api/settings", settingsRouter);
app.use("/api/audio", audioRouter);
app.use("/api/generations", generationsRouter);

app.use(notFoundHandler);
app.use(errorHandler);

app.listen(env.PORT, () => {
  console.log(`Voice Studio AI API listening on http://localhost:${env.PORT}`);
});
