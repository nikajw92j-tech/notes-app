"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import type { AuthError } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import { publicEnv } from "@/lib/env";
import { clientIp, rateLimit } from "@/lib/rate-limit";
import { emailSchema, passwordSchema, safeNextPath } from "@/lib/validation";

export interface AuthState {
  error?: string;
  fieldErrors?: Partial<Record<"email" | "password" | "confirm", string>>;
  done?: boolean;
  email?: string;
}

async function origin() {
  if (publicEnv.siteUrl) return publicEnv.siteUrl;
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host");
  const proto = h.get("x-forwarded-proto") ?? (host?.startsWith("localhost") ? "http" : "https");
  return `${proto}://${host}`;
}

async function limited(name: string, limit: number, windowMs: number) {
  const ip = clientIp(await headers());
  return !rateLimit(`auth:${name}:${ip}`, limit, windowMs).ok;
}

function authErrorCode(error: AuthError): string {
  const code = error.code ?? "";
  if (code === "invalid_credentials") return "invalid_credentials";
  if (code === "email_not_confirmed") return "email_not_confirmed";
  if (code === "weak_password") return "weak_password";
  if (code === "same_password") return "same_password";
  if (code === "over_request_rate_limit" || code === "over_email_send_rate_limit" || error.status === 429) {
    return "rate_limited";
  }
  if (code === "session_not_found" || code === "session_expired") return "session_missing";
  return "generic";
}

function readCredentials(formData: FormData) {
  const email = emailSchema.safeParse(String(formData.get("email") ?? "").trim());
  const password = passwordSchema.safeParse(String(formData.get("password") ?? ""));
  return { email, password };
}

export async function login(_: AuthState, formData: FormData): Promise<AuthState> {
  const { email, password } = readCredentials(formData);
  const rawPassword = String(formData.get("password") ?? "");
  if (!email.success || !rawPassword) {
    return {
      fieldErrors: {
        ...(email.success ? {} : { email: "invalid_email" }),
        ...(rawPassword ? {} : { password: "password_short" }),
      },
    };
  }
  if (await limited("login", 10, 60_000)) return { error: "rate_limited" };

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({
    email: email.data,
    password: password.success ? password.data : rawPassword,
  });
  if (error) return { error: authErrorCode(error) };

  redirect(safeNextPath(String(formData.get("next") ?? "")));
}

export async function signup(_: AuthState, formData: FormData): Promise<AuthState> {
  const { email, password } = readCredentials(formData);
  if (!email.success || !password.success) {
    return {
      fieldErrors: {
        ...(email.success ? {} : { email: "invalid_email" }),
        ...(password.success ? {} : { password: "password_short" }),
      },
    };
  }
  if (await limited("signup", 5, 10 * 60_000)) return { error: "rate_limited" };

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signUp({
    email: email.data,
    password: password.data,
    options: { emailRedirectTo: `${await origin()}/auth/callback?next=/notes` },
  });
  if (error) return { error: authErrorCode(error) };

  // Email confirmation disabled in Supabase → a session is returned immediately.
  if (data.session) redirect("/notes");
  return { done: true, email: email.data };
}

export async function requestPasswordReset(_: AuthState, formData: FormData): Promise<AuthState> {
  const email = emailSchema.safeParse(String(formData.get("email") ?? "").trim());
  if (!email.success) return { fieldErrors: { email: "invalid_email" } };
  if (await limited("reset", 5, 10 * 60_000)) return { error: "rate_limited" };

  const supabase = await createClient();
  const { error } = await supabase.auth.resetPasswordForEmail(email.data, {
    redirectTo: `${await origin()}/auth/callback?next=/reset-password`,
  });
  // Never reveal whether the address exists; only surface throttling.
  if (error && authErrorCode(error) === "rate_limited") return { error: "rate_limited" };
  return { done: true, email: email.data };
}

export async function resetPassword(_: AuthState, formData: FormData): Promise<AuthState> {
  const password = passwordSchema.safeParse(String(formData.get("password") ?? ""));
  const confirm = String(formData.get("confirm") ?? "");
  if (!password.success) return { fieldErrors: { password: "password_short" } };
  if (password.data !== confirm) return { fieldErrors: { confirm: "password_mismatch" } };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "session_missing" };

  const { error } = await supabase.auth.updateUser({ password: password.data });
  if (error) return { error: authErrorCode(error) };
  redirect("/notes");
}

/** Change password from Settings (user is already signed in). */
export async function changePassword(_: AuthState, formData: FormData): Promise<AuthState> {
  const password = passwordSchema.safeParse(String(formData.get("password") ?? ""));
  const confirm = String(formData.get("confirm") ?? "");
  if (!password.success) return { fieldErrors: { password: "password_short" } };
  if (password.data !== confirm) return { fieldErrors: { confirm: "password_mismatch" } };
  if (await limited("change-password", 5, 10 * 60_000)) return { error: "rate_limited" };

  const supabase = await createClient();
  const { error } = await supabase.auth.updateUser({ password: password.data });
  if (error) return { error: authErrorCode(error) };
  return { done: true };
}

export async function signInWithGoogle(formData: FormData) {
  const next = safeNextPath(String(formData.get("next") ?? ""));
  const supabase = await createClient();
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: { redirectTo: `${await origin()}/auth/callback?next=${encodeURIComponent(next)}` },
  });
  if (error || !data.url) redirect("/login?error=oauth");
  redirect(data.url);
}

export async function logout() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}
