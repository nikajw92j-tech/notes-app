import { route } from "@/lib/api";
import { parseId } from "@/lib/params";
import { markOpened } from "@/lib/services/notes";

/** Records that the note was opened (powers "Recently opened"). */
export const POST = route<{ id: string }>(async ({ params, supabase, user }) => {
  await markOpened(supabase, user.id, parseId(params.id));
});
