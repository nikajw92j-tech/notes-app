import { route } from "@/lib/api";
import { parseId } from "@/lib/params";
import { deleteNotePermanently } from "@/lib/services/notes";

export const DELETE = route<{ id: string }>(
  async ({ params, supabase, user }) => {
    await deleteNotePermanently(supabase, user.id, parseId(params.id));
  },
  { rateLimit: { name: "notes:purge", limit: 60, windowMs: 60_000 } },
);
