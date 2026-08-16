import { createClient } from "@supabase/supabase-js";
import { env, featureFlags } from "../config/env.js";

export const supabaseAdmin = featureFlags.supabaseConfigured
  ? createClient(env.SUPABASE_URL!, env.SUPABASE_SERVICE_ROLE_KEY!, {
      auth: { autoRefreshToken: false, persistSession: false },
    })
  : null;
