import "server-only";
import { createServerClient } from "@supabase/ssr";
import { createClient as createTokenClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";
import { publicEnv } from "@/lib/env";
import { COOKIE_OPTIONS } from "./cookies";

/** Cookie-based client for Server Components, Server Actions and Route Handlers. */
export async function createClient() {
  const cookieStore = await cookies();
  return createServerClient(publicEnv.supabaseUrl, publicEnv.supabaseAnonKey, {
    cookieOptions: COOKIE_OPTIONS,
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(toSet) {
        try {
          toSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options));
        } catch {
          // Called from a Server Component: middleware refreshes the session instead.
        }
      },
    },
  });
}

/** Client acting as the bearer of an access token (API clients, integration tests). */
export function createClientWithToken(accessToken: string) {
  return createTokenClient(publicEnv.supabaseUrl, publicEnv.supabaseAnonKey, {
    global: { headers: { Authorization: `Bearer ${accessToken}` } },
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
}

export type ServerSupabase = Awaited<ReturnType<typeof createClient>>;
