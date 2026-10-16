"use client";

import { createClient as createSupabaseClient, type SupabaseClient } from "@supabase/supabase-js";
import { publicEnv } from "@/lib/env";

let client: SupabaseClient | undefined;

/**
 * Browser client used only for Realtime. It holds no session of its own —
 * auth cookies are HttpOnly — and is authorised with a short-lived access
 * token fetched from the server (see useRealtimeNotes).
 */
export function createClient() {
  client ??= createSupabaseClient(publicEnv.supabaseUrl, publicEnv.supabaseAnonKey, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
  return client;
}
