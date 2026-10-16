import { route, parseJson } from "@/lib/api";
import { parseId } from "@/lib/params";
import { getNote, trashNote, updateNote } from "@/lib/services/notes";
import { noteUpdateSchema } from "@/lib/validation";

type P = { id: string };

export const GET = route<P>(async ({ params, supabase, user }) =>
  getNote(supabase, user.id, parseId(params.id)),
);

export const PATCH = route<P>(
  async ({ req, params, supabase, user }) => {
    const id = parseId(params.id);
    return updateNote(supabase, user.id, id, await parseJson(req, noteUpdateSchema));
  },
  { rateLimit: { name: "notes:update", limit: 300, windowMs: 60_000 } },
);

/** Soft delete: moves the note to trash. */
export const DELETE = route<P>(async ({ params, supabase, user }) =>
  trashNote(supabase, user.id, parseId(params.id)),
);
