import { NextResponse } from "next/server";
import { route } from "@/lib/api";
import { parseId } from "@/lib/params";
import { duplicateNote } from "@/lib/services/notes";

export const POST = route<{ id: string }>(
  async ({ params, supabase, user }) =>
    NextResponse.json(await duplicateNote(supabase, user.id, parseId(params.id)), { status: 201 }),
  { rateLimit: { name: "notes:create", limit: 60, windowMs: 60_000 } },
);
