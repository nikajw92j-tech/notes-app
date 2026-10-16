import { route, parseJson } from "@/lib/api";
import { getProfile, updateProfile } from "@/lib/services/account";
import { profileUpdateSchema } from "@/lib/validation";

export const GET = route(async ({ supabase, user }) => getProfile(supabase, user));

export const PATCH = route(async ({ req, supabase, user }) =>
  updateProfile(supabase, user, await parseJson(req, profileUpdateSchema)),
);
