import { NextResponse } from "next/server";
import { ApiError, route } from "@/lib/api";
import { assertOwnPath, isBucket, removeFile, signedUrl } from "@/lib/services/storage";

type P = { bucket: string; path: string[] };

function resolve(params: P, userId: string) {
  if (!isBucket(params.bucket)) throw new ApiError(404, "not_found", "File not found");
  const path = params.path.join("/");
  assertOwnPath(userId, path);
  return { bucket: params.bucket, path };
}

/** Serve a private file: verifies ownership, then redirects to a short-lived signed URL. */
export const GET = route<P>(async ({ params, supabase, user }) => {
  const { bucket, path } = resolve(params, user.id);
  const url = await signedUrl(supabase, bucket, path);
  return NextResponse.redirect(url, {
    status: 302,
    headers: { "Cache-Control": "private, max-age=240" },
  });
});

export const DELETE = route<P>(async ({ params, supabase, user }) => {
  const { bucket, path } = resolve(params, user.id);
  if (bucket === "avatars") {
    throw new ApiError(400, "use_avatar_endpoint", "Remove avatars via DELETE /api/profile/avatar");
  }
  await removeFile(supabase, bucket, path);
});
