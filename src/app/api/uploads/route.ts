import { NextResponse } from "next/server";
import { ApiError, route } from "@/lib/api";
import { uploadImage } from "@/lib/services/storage";

/** Upload an image for use inside a note. Returns a same-origin src. */
export const POST = route(
  async ({ req, supabase, user }) => {
    const form = await req.formData().catch(() => null);
    const file = form?.get("file");
    if (!(file instanceof File)) throw new ApiError(400, "missing_file", "No file provided");
    return NextResponse.json(await uploadImage(supabase, user.id, "note-images", file), { status: 201 });
  },
  { rateLimit: { name: "uploads", limit: 30, windowMs: 60_000 } },
);
