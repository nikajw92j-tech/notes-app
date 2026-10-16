import { z } from "zod";
import { NOTE_SORTS, NOTE_VIEWS } from "@/lib/types";

export const MAX_TITLE = 200;
export const MAX_CONTENT = 1_000_000;
export const MAX_TAGS = 20;

const tagName = z
  .string()
  .trim()
  .min(1)
  .max(30)
  .regex(/^[^,<>]+$/, "Tags cannot contain commas or angle brackets");

const tagList = z
  .array(tagName)
  .max(MAX_TAGS)
  .transform((names) => {
    const seen = new Set<string>();
    return names.filter((n) => {
      const key = n.toLowerCase();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  });

export const idSchema = z.uuid();

export const noteCreateSchema = z.strictObject({
  title: z.string().max(MAX_TITLE).optional(),
  content: z.string().max(MAX_CONTENT).optional(),
  folder_id: z.uuid().nullable().optional(),
  tags: tagList.optional(),
  is_pinned: z.boolean().optional(),
  is_favorite: z.boolean().optional(),
});

export const noteUpdateSchema = z
  .strictObject({
    title: z.string().max(MAX_TITLE).optional(),
    content: z.string().max(MAX_CONTENT).optional(),
    folder_id: z.uuid().nullable().optional(),
    tags: tagList.optional(),
    is_pinned: z.boolean().optional(),
    is_favorite: z.boolean().optional(),
    is_archived: z.boolean().optional(),
    /** Required when title or content change: rejects stale writes with 409. */
    expected_version: z.number().int().positive().optional(),
  })
  .refine((v) => Object.keys(v).some((k) => k !== "expected_version"), {
    message: "Nothing to update",
  });

const boolParam = z
  .enum(["true", "false"])
  .transform((v) => v === "true")
  .optional();

export const noteListQuerySchema = z.object({
  view: z.enum(NOTE_VIEWS).default("all"),
  folder: z.uuid().optional(),
  tag: z.uuid().optional(),
  q: z.string().trim().max(200).optional(),
  sort: z.enum(NOTE_SORTS).default("updated"),
  favorite: boolParam,
  page: z.coerce.number().int().min(0).max(10_000).default(0),
  limit: z.coerce.number().int().min(1).max(100).default(50),
});
export type NoteListQuery = z.infer<typeof noteListQuerySchema>;

export const searchQuerySchema = noteListQuerySchema.extend({
  q: z.string().trim().min(1).max(200),
});

const hexColor = z.string().regex(/^#[0-9A-Fa-f]{6}$/, "Invalid color");

export const folderCreateSchema = z.strictObject({
  name: z.string().trim().min(1).max(60),
  color: hexColor.default("#335CFF"),
});

export const folderUpdateSchema = z
  .strictObject({
    name: z.string().trim().min(1).max(60).optional(),
    color: hexColor.optional(),
  })
  .refine((v) => v.name !== undefined || v.color !== undefined, {
    message: "Nothing to update",
  });

export const profileUpdateSchema = z.strictObject({
  username: z
    .string()
    .trim()
    .regex(/^[A-Za-z0-9_]{3,30}$/, "3–30 letters, numbers or underscores")
    .nullable(),
});

export const settingsUpdateSchema = z
  .strictObject({
    theme: z.enum(["light", "dark", "system"]).optional(),
    language: z.enum(["en", "ka", "ru"]).optional(),
    preferences: z
      .strictObject({
        font: z.enum(["sans", "serif", "mono"]).optional(),
        sort: z.enum(NOTE_SORTS).optional(),
      })
      .optional(),
  })
  .refine((v) => Object.keys(v).length > 0, { message: "Nothing to update" });

export const deleteAccountSchema = z.strictObject({
  confirm: z.literal("DELETE"),
});

export const emailSchema = z.email().max(254);
export const passwordSchema = z
  .string()
  .min(8, "At least 8 characters")
  .max(72, "At most 72 characters");

/** Only allow same-site relative redirect targets. */
export function safeNextPath(next: string | null | undefined, fallback = "/notes") {
  if (!next || !next.startsWith("/") || next.startsWith("//") || next.startsWith("/\\")) {
    return fallback;
  }
  return next;
}
