"use server";

import { headers } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { clientIp, rateLimit } from "@/lib/rate-limit";

export type GuestResult = { ok: true } | { ok: false; error: "rate_limited" | "generic" };

/**
 * Sign the visitor in without registration.
 *
 * Prefers Supabase anonymous sign-in. If that provider is disabled on the
 * project, falls back to a server-created guest account with a random,
 * never-shown password. Either way the visitor gets a real, private user id,
 * so RLS isolates their notes exactly like a registered user's.
 *
 * Runs as a Server Action invoked from the /start page's JavaScript, so
 * crawlers that merely follow links don't create accounts.
 */
export async function startGuestSession(): Promise<GuestResult> {
  const ip = clientIp(await headers());
  if (!rateLimit(`guest:${ip}`, 10, 60 * 60_000).ok) return { ok: false, error: "rate_limited" };

  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (user) return { ok: true };

  const anon = await supabase.auth.signInAnonymously();
  if (!anon.error) return { ok: true };

  try {
    const admin = createAdminClient();
    const email = `guest-${crypto.randomUUID()}@guest.invalid`;
    const password = `${crypto.randomUUID()}${crypto.randomUUID()}`;
    const created = await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { guest: true },
    });
    if (created.error) throw created.error;

    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw error;
    return { ok: true };
  } catch (err) {
    console.error("[guest session]", err);
    return { ok: false, error: "generic" };
  }
}
