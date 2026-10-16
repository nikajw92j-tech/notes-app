import { route } from "@/lib/api";
import { emptyTrash } from "@/lib/services/notes";

/** Permanently delete every note in the caller's trash. */
export const DELETE = route(async ({ supabase, user }) => emptyTrash(supabase, user.id), {
  rateLimit: { name: "notes:purge", limit: 20, windowMs: 60_000 },
});
