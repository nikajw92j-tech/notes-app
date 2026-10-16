import { createClient, type SupabaseClient } from "@supabase/supabase-js";

/**
 * Integration tests run against a real Supabase project (use a dedicated
 * test project, never production) and, for the API suite, a running app.
 *
 *   TEST_SUPABASE_URL, TEST_SUPABASE_ANON_KEY, TEST_SUPABASE_SERVICE_ROLE_KEY
 *   TEST_APP_URL (e.g. http://localhost:3000 — the app must point at the same project)
 */
export const env = {
  url: process.env.TEST_SUPABASE_URL ?? "",
  anon: process.env.TEST_SUPABASE_ANON_KEY ?? "",
  service: process.env.TEST_SUPABASE_SERVICE_ROLE_KEY ?? "",
  app: process.env.TEST_APP_URL?.replace(/\/$/, "") ?? "",
};

export const hasSupabase = !!(env.url && env.anon && env.service);
export const hasApp = hasSupabase && !!env.app;

export interface TestUser {
  id: string;
  email: string;
  password: string;
  token: string;
  db: SupabaseClient;
}

export function admin() {
  return createClient(env.url, env.service, { auth: { persistSession: false, autoRefreshToken: false } });
}

export function anonClient() {
  return createClient(env.url, env.anon, { auth: { persistSession: false, autoRefreshToken: false } });
}

export async function createTestUser(label: string): Promise<TestUser> {
  const email = `it-${label}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@example.com`;
  const password = `Pw-${Math.random().toString(36).slice(2)}-${Date.now()}`;
  const { data, error } = await admin().auth.admin.createUser({ email, password, email_confirm: true });
  if (error || !data.user) throw error ?? new Error("createUser failed");

  const db = anonClient();
  const { data: session, error: signInError } = await db.auth.signInWithPassword({ email, password });
  if (signInError || !session.session) throw signInError ?? new Error("sign-in failed");
  return { id: data.user.id, email, password, token: session.session.access_token, db };
}

export async function deleteTestUser(user?: TestUser) {
  if (!user) return;
  const a = admin();
  for (const bucket of ["note-images", "avatars"]) {
    const { data } = await a.storage.from(bucket).list(user.id);
    if (data?.length) await a.storage.from(bucket).remove(data.map((f) => `${user.id}/${f.name}`));
  }
  await a.auth.admin.deleteUser(user.id);
}

/** Call the app's REST API as a user (Bearer auth). */
export async function call(user: TestUser | null, method: string, path: string, body?: unknown) {
  const res = await fetch(env.app + path, {
    method,
    headers: {
      ...(user ? { Authorization: `Bearer ${user.token}` } : {}),
      ...(body !== undefined && !(body instanceof FormData) ? { "Content-Type": "application/json" } : {}),
    },
    body: body === undefined ? undefined : body instanceof FormData ? body : JSON.stringify(body),
    redirect: "manual",
  });
  const text = await res.text();
  let json: unknown = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    json = text;
  }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return { status: res.status, body: json as any, headers: res.headers };
}

/** 1×1 transparent PNG */
export const PNG_BYTES = Uint8Array.from(
  atob("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII="),
  (c) => c.charCodeAt(0),
);
