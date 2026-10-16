import { NextResponse } from "next/server";
import { route, parseJson } from "@/lib/api";
import { createFolder, listFolders } from "@/lib/services/folders";
import { folderCreateSchema } from "@/lib/validation";

export const GET = route(async ({ supabase, user }) => listFolders(supabase, user.id));

export const POST = route(
  async ({ req, supabase, user }) => {
    const input = await parseJson(req, folderCreateSchema);
    return NextResponse.json(await createFolder(supabase, user.id, input), { status: 201 });
  },
  { rateLimit: { name: "folders:write", limit: 60, windowMs: 60_000 } },
);
