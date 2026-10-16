import { route } from "@/lib/api";
import { parseId } from "@/lib/params";
import { restoreNote } from "@/lib/services/notes";

export const POST = route<{ id: string }>(async ({ params, supabase, user }) =>
  restoreNote(supabase, user.id, parseId(params.id)),
);
