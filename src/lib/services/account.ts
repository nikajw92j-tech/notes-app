import "server-only";
import type { SupabaseClient, User } from "@supabase/supabase-js";
import { dbError } from "@/lib/api";
import type { Preferences, Profile, UserSettings } from "@/lib/types";
import { fileSrc } from "@/lib/services/storage";

export async function getProfile(db: SupabaseClient, user: User): Promise<Profile> {
  const { data, error } = await db
    .from("profiles")
    .select("id,email,username,avatar_url,created_at")
    .eq("id", user.id)
    .maybeSingle();
  if (error) throw dbError(error);
  const row = data ?? {
    id: user.id,
    email: user.email ?? "",
    username: null,
    avatar_url: null,
    created_at: user.created_at,
  };
  const isGuest = user.is_anonymous === true || user.user_metadata?.guest === true;
  return {
    ...row,
    email: isGuest ? "" : row.email,
    avatar_src: row.avatar_url ? fileSrc("avatars", row.avatar_url) : null,
    providers: isGuest ? [] : ((user.app_metadata?.providers as string[] | undefined) ?? []),
    is_guest: isGuest,
  };
}

export async function updateProfile(
  db: SupabaseClient,
  user: User,
  input: { username?: string | null; avatar_url?: string | null },
): Promise<Profile> {
  const { error } = await db.from("profiles").update(input).eq("id", user.id);
  if (error) throw dbError(error);
  return getProfile(db, user);
}

const DEFAULT_SETTINGS: UserSettings = { theme: "system", language: "en", preferences: {} };

export async function getSettings(db: SupabaseClient, userId: string): Promise<UserSettings> {
  const { data, error } = await db
    .from("user_settings")
    .select("theme,language,preferences")
    .eq("user_id", userId)
    .maybeSingle();
  if (error) throw dbError(error);
  return (data as UserSettings | null) ?? DEFAULT_SETTINGS;
}

export async function updateSettings(
  db: SupabaseClient,
  userId: string,
  input: Partial<Omit<UserSettings, "preferences">> & { preferences?: Preferences },
): Promise<UserSettings> {
  const current = await getSettings(db, userId);
  const next: UserSettings = {
    theme: input.theme ?? current.theme,
    language: input.language ?? current.language,
    preferences: { ...current.preferences, ...input.preferences },
  };
  const { data, error } = await db
    .from("user_settings")
    .upsert({ user_id: userId, ...next }, { onConflict: "user_id" })
    .select("theme,language,preferences")
    .single();
  if (error) throw dbError(error);
  return data as UserSettings;
}
