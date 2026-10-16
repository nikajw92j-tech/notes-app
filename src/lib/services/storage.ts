import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { ApiError } from "@/lib/api";
import type { StoredFile } from "@/lib/types";

export const BUCKETS = {
  "note-images": {
    maxBytes: 4 * 1024 * 1024, // under Vercel's 4.5 MB request-body cap
    types: ["image/png", "image/jpeg", "image/gif", "image/webp"],
  },
  avatars: {
    maxBytes: 2 * 1024 * 1024,
    types: ["image/png", "image/jpeg", "image/webp"],
  },
} as const;
export type Bucket = keyof typeof BUCKETS;

export function isBucket(value: string): value is Bucket {
  return value in BUCKETS;
}

export function fileSrc(bucket: Bucket, path: string) {
  return `/api/files/${bucket}/${path}`;
}

const EXT: Record<string, string> = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/gif": "gif",
  "image/webp": "webp",
};

/** Detect the real image type from magic bytes; never trust the client's MIME type. */
export function sniffImageType(bytes: Uint8Array): string | null {
  const b = bytes;
  if (b.length >= 8 && b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47) return "image/png";
  if (b.length >= 3 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return "image/jpeg";
  if (b.length >= 6 && b[0] === 0x47 && b[1] === 0x49 && b[2] === 0x46 && b[3] === 0x38) return "image/gif";
  if (
    b.length >= 12 &&
    b[0] === 0x52 && b[1] === 0x49 && b[2] === 0x46 && b[3] === 0x46 &&
    b[8] === 0x57 && b[9] === 0x45 && b[10] === 0x42 && b[11] === 0x50
  ) {
    return "image/webp";
  }
  return null;
}

/** Validate an uploaded file and store it under "<userId>/<uuid>.<ext>". */
export async function uploadImage(
  db: SupabaseClient,
  userId: string,
  bucket: Bucket,
  file: File,
): Promise<{ path: string; src: string }> {
  const rules = BUCKETS[bucket];
  if (file.size === 0) throw new ApiError(400, "empty_file", "File is empty");
  if (file.size > rules.maxBytes) {
    throw new ApiError(413, "file_too_large", `File must be ${rules.maxBytes / 1024 / 1024} MB or smaller`);
  }
  const bytes = new Uint8Array(await file.arrayBuffer());
  const type = sniffImageType(bytes);
  if (!type || !(rules.types as readonly string[]).includes(type)) {
    throw new ApiError(415, "unsupported_type", "Unsupported file type");
  }
  const path = `${userId}/${crypto.randomUUID()}.${EXT[type]}`;
  const { error } = await db.storage.from(bucket).upload(path, bytes, {
    contentType: type,
    upsert: false,
    cacheControl: "3600",
  });
  if (error) {
    console.error("[storage upload]", error);
    throw new ApiError(500, "upload_failed", "Upload failed");
  }
  return { path, src: fileSrc(bucket, path) };
}

/** Paths must live in the caller's own folder. */
export function assertOwnPath(userId: string, path: string) {
  const parts = path.split("/");
  if (parts.length !== 2 || parts[0] !== userId || !/^[\w-]+\.(png|jpg|gif|webp)$/.test(parts[1])) {
    throw new ApiError(404, "not_found", "File not found");
  }
}

export async function signedUrl(db: SupabaseClient, bucket: Bucket, path: string) {
  const { data, error } = await db.storage.from(bucket).createSignedUrl(path, 300);
  if (error || !data) throw new ApiError(404, "not_found", "File not found");
  return data.signedUrl;
}

export async function removeFile(db: SupabaseClient, bucket: Bucket, path: string) {
  const { data, error } = await db.storage.from(bucket).remove([path]);
  if (error) {
    console.error("[storage remove]", error);
    throw new ApiError(500, "delete_failed", "Could not delete file");
  }
  if (!data?.length) throw new ApiError(404, "not_found", "File not found");
}

export async function listFiles(db: SupabaseClient, userId: string, bucket: Bucket): Promise<StoredFile[]> {
  const { data, error } = await db.storage.from(bucket).list(userId, {
    limit: 1000,
    sortBy: { column: "created_at", order: "desc" },
  });
  if (error) {
    console.error("[storage list]", error);
    throw new ApiError(500, "list_failed", "Could not list files");
  }
  return (data ?? [])
    .filter((f) => f.id) // skip folder placeholders
    .map((f) => {
      const path = `${userId}/${f.name}`;
      return {
        name: f.name,
        path,
        src: fileSrc(bucket, path),
        size: (f.metadata as { size?: number } | null)?.size ?? 0,
        created_at: f.created_at ?? null,
      };
    });
}
