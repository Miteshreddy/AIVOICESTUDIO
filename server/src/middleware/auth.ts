import type { NextFunction, Request, Response } from "express";
import { supabaseAdmin } from "../lib/supabase-admin.js";
import { env } from "../config/env.js";

export interface AuthedRequest extends Request {
  userId?: string;
  userEmail?: string;
}

const LOCAL_USER_ID = "local-user";
let warnedAboutLocalMode = false;

export async function requireAuth(req: AuthedRequest, res: Response, next: NextFunction) {
  // No Supabase project configured — run as a single local user rather than forcing a cloud
  // account just to exercise local-only features (voice cloning/generation need no accounts).
  if (!supabaseAdmin) {
    if (env.NODE_ENV !== "development") {
      return res.status(503).json({
        error: "Auth is not configured — set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY on the server.",
      });
    }
    if (!warnedAboutLocalMode) {
      console.warn(
        "[auth] Supabase is not configured — running in local single-user mode (dev only). " +
          "Set SUPABASE_URL/SUPABASE_SERVICE_ROLE_KEY to enable real accounts.",
      );
      warnedAboutLocalMode = true;
    }
    req.userId = LOCAL_USER_ID;
    return next();
  }

  const authHeader = req.headers.authorization;
  const token = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : undefined;

  if (!token) {
    return res.status(401).json({ error: "Missing bearer token" });
  }

  const { data, error } = await supabaseAdmin.auth.getUser(token);
  if (error || !data.user) {
    return res.status(401).json({ error: "Invalid or expired session" });
  }

  req.userId = data.user.id;
  req.userEmail = data.user.email ?? undefined;
  next();
}
