import { ApiError, route } from "@/lib/api";
import { getProfile, updateProfile } from "@/lib/services/account";
import { removeFile, uploadImage } from "@/lib/services/storage";

export const POST = route(
  async ({ req, supabase, user }) => {
    const form = await req.formData().catch(() => null);
    const file = form?.get("file");
    if (!(file instanceof File)) throw new ApiError(400, "missing_file", "No file provided");

    const previous = (await getProfile(supabase, user)).avatar_url;
    const { path } = await uploadImage(supabase, user.id, "avatars", file);
    const profile = await updateProfile(supabase, user, { avatar_url: path });
    if (previous) await removeFile(supabase, "avatars", previous).catch(() => undefined);
    return profile;
  },
  { rateLimit: { name: "uploads", limit: 30, windowMs: 60_000 } },
);

export const DELETE = route(async ({ supabase, user }) => {
  const previous = (await getProfile(supabase, user)).avatar_url;
  const profile = await updateProfile(supabase, user, { avatar_url: null });
  if (previous) await removeFile(supabase, "avatars", previous).catch(() => undefined);
  return profile;
});
