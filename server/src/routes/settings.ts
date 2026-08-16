import { Router } from "express";
import { z } from "zod";
import { requireAuth, type AuthedRequest } from "../middleware/auth.js";
import { validateBody } from "../middleware/validate.js";
import { supabaseAdmin } from "../lib/supabase-admin.js";
import { encryptSecret } from "../lib/crypto.js";
import { HttpError } from "../middleware/error-handler.js";

export const settingsRouter = Router();

const apiKeysSchema = z.object({
  elevenLabsApiKey: z.string().optional(),
  openAiApiKey: z.string().optional(),
  deepgramApiKey: z.string().optional(),
});

settingsRouter.post(
  "/api-keys",
  requireAuth,
  validateBody(apiKeysSchema),
  async (req: AuthedRequest, res, next) => {
    try {
      if (!supabaseAdmin) {
        throw new HttpError(503, "Supabase is not configured on the server.");
      }

      const entries = Object.entries(req.body as z.infer<typeof apiKeysSchema>).filter(
        ([, value]) => value,
      );

      const rows = entries.map(([provider, value]) => ({
        user_id: req.userId,
        provider,
        encrypted_key: encryptSecret(value as string),
      }));

      if (rows.length > 0) {
        const { error } = await supabaseAdmin
          .from("user_api_keys")
          .upsert(rows, { onConflict: "user_id,provider" });
        if (error) throw new HttpError(500, "Failed to save API keys", error.message);
      }

      res.json({ saved: rows.map((r) => r.provider) });
    } catch (err) {
      next(err);
    }
  },
);
