import { ApiError, route } from "@/lib/api";
import { isBucket, listFiles } from "@/lib/services/storage";

/** List the caller's files in a bucket (default: note images). */
export const GET = route(async ({ req, supabase, user }) => {
  const bucket = req.nextUrl.searchParams.get("bucket") ?? "note-images";
  if (!isBucket(bucket)) throw new ApiError(400, "invalid_bucket", "Unknown bucket");
  return listFiles(supabase, user.id, bucket);
});
