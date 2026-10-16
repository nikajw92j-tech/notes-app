import { ApiError } from "@/lib/api";
import { idSchema } from "@/lib/validation";

/** Malformed ids are reported as 404 so existence is never leaked. */
export function parseId(value: string | string[] | undefined): string {
  const parsed = idSchema.safeParse(value);
  if (!parsed.success) throw new ApiError(404, "not_found", "Not found");
  return parsed.data;
}
