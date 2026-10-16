import { route, parseQuery } from "@/lib/api";
import { listNotes } from "@/lib/services/notes";
import { searchQuerySchema } from "@/lib/validation";

/** Full-text search (title weighted above content) with prefix matching. */
export const GET = route(
  async ({ req, supabase, user }) => listNotes(supabase, user.id, parseQuery(req, searchQuerySchema)),
  { rateLimit: { name: "search", limit: 240, windowMs: 60_000 } },
);
