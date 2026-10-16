import "server-only";
import { createClient } from "@supabase/supabase-js";
import { publicEnv } from "@/lib/env";

/**
 * Service-role client. Bypasses RLS — only used for account deletion.
 * The key is read from a non-public env var and never reaches the browser.
 */
export function createAdminClient() {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!key) throw new Error("SUPABASE_SERVICE_ROLE_KEY is not configured");
  return createClient(publicEnv.supabaseUrl, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
