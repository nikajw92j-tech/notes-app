import { NextResponse } from "next/server";
import { route, parseJson, parseQuery } from "@/lib/api";
import { createNote, listNotes } from "@/lib/services/notes";
import { noteCreateSchema, noteListQuerySchema } from "@/lib/validation";

export const GET = route(async ({ req, supabase, user }) =>
  listNotes(supabase, user.id, parseQuery(req, noteListQuerySchema)),
);

export const POST = route(
  async ({ req, supabase, user }) => {
    const input = await parseJson(req, noteCreateSchema);
    return NextResponse.json(await createNote(supabase, user.id, input), { status: 201 });
  },
  { rateLimit: { name: "notes:create", limit: 60, windowMs: 60_000 } },
);
