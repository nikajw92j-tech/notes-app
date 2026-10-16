import { route, parseJson } from "@/lib/api";
import { getSettings, updateSettings } from "@/lib/services/account";
import { settingsUpdateSchema } from "@/lib/validation";

export const GET = route(async ({ supabase, user }) => getSettings(supabase, user.id));

export const PATCH = route(async ({ req, supabase, user }) =>
  updateSettings(supabase, user.id, await parseJson(req, settingsUpdateSchema)),
);
