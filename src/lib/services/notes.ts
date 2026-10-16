import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { ApiError, dbError, notFound } from "@/lib/api";
import { htmlToText, sanitizeNoteHtml } from "@/lib/sanitize";
import { buildPrefixTsQuery } from "@/lib/search";
import type { Note, NoteListResponse, NoteSummary, Tag } from "@/lib/types";
import type { NoteListQuery } from "@/lib/validation";
import { MAX_TITLE } from "@/lib/validation";

const SUMMARY_COLUMNS =
  "id,title,folder_id,is_pinned,is_favorite,is_archived,deleted_at,last_opened_at,version,created_at,updated_at,excerpt,note_tags(tags(id,name))";
const FULL_COLUMNS = `${SUMMARY_COLUMNS},content`;

type Row = Omit<NoteSummary, "tags"> & {
  content?: string;
  note_tags?: { tags: Tag | Tag[] | null }[];
};

function mapRow<T extends NoteSummary>(row: Row): T {
  const { note_tags, ...rest } = row;
  const tags = (note_tags ?? [])
    .flatMap((nt) => (Array.isArray(nt.tags) ? nt.tags : nt.tags ? [nt.tags] : []))
    .sort((a, b) => a.name.localeCompare(b.name));
  return { ...rest, excerpt: rest.excerpt ?? "", tags } as unknown as T;
}

export async function listNotes(
  db: SupabaseClient,
  userId: string,
  query: NoteListQuery,
): Promise<NoteListResponse> {
  const { view, folder, tag, q, sort, favorite, page, limit } = query;
  let qb = db.from("notes").select(SUMMARY_COLUMNS).eq("user_id", userId);

  switch (view) {
    case "all":
      qb = qb.is("deleted_at", null).eq("is_archived", false);
      break;
    case "favorites":
      qb = qb.is("deleted_at", null).eq("is_favorite", true);
      break;
    case "recent":
      qb = qb.is("deleted_at", null).not("last_opened_at", "is", null);
      break;
    case "archived":
      qb = qb.is("deleted_at", null).eq("is_archived", true);
      break;
    case "trash":
      qb = qb.not("deleted_at", "is", null);
      break;
  }

  if (folder) qb = qb.eq("folder_id", folder);
  if (favorite !== undefined) qb = qb.eq("is_favorite", favorite);

  if (tag) {
    const { data: links, error } = await db
      .from("note_tags")
      .select("note_id")
      .eq("user_id", userId)
      .eq("tag_id", tag);
    if (error) throw dbError(error);
    if (!links.length) return { items: [], nextPage: null };
    qb = qb.in("id", links.map((l) => l.note_id));
  }

  if (q) {
    const tsq = buildPrefixTsQuery(q);
    if (!tsq) return { items: [], nextPage: null };
    qb = qb.textSearch("search_vector", tsq, { config: "simple" });
  }

  if (view === "trash") {
    qb = qb.order("deleted_at", { ascending: false });
  } else {
    qb = qb.order("is_pinned", { ascending: false });
  }
  const effectiveSort = view === "recent" && sort === "updated" ? "opened" : sort;
  switch (effectiveSort) {
    case "created":
      qb = qb.order("created_at", { ascending: false });
      break;
    case "title":
      qb = qb.order("title", { ascending: true }).order("updated_at", { ascending: false });
      break;
    case "opened":
      qb = qb.order("last_opened_at", { ascending: false, nullsFirst: false });
      break;
    default:
      qb = qb.order("updated_at", { ascending: false });
  }
  qb = qb.order("id", { ascending: true });

  const from = page * limit;
  const { data, error } = await qb.range(from, from + limit); // one extra row → hasMore
  if (error) throw dbError(error);
  const rows = (data ?? []) as unknown as Row[];
  const hasMore = rows.length > limit;
  return {
    items: rows.slice(0, limit).map((r) => mapRow<NoteSummary>(r)),
    nextPage: hasMore ? page + 1 : null,
  };
}

export async function getNote(db: SupabaseClient, userId: string, id: string): Promise<Note> {
  const { data, error } = await db
    .from("notes")
    .select(FULL_COLUMNS)
    .eq("user_id", userId)
    .eq("id", id)
    .maybeSingle();
  if (error) throw dbError(error);
  if (!data) throw notFound("Note");
  return mapRow<Note>(data as unknown as Row);
}

async function setTags(db: SupabaseClient, noteId: string, tags: string[]) {
  const { error } = await db.rpc("set_note_tags", { p_note_id: noteId, p_names: tags });
  if (error) throw dbError(error);
}

export interface NoteInput {
  title?: string;
  content?: string;
  folder_id?: string | null;
  tags?: string[];
  is_pinned?: boolean;
  is_favorite?: boolean;
  is_archived?: boolean;
  expected_version?: number;
}

function contentColumns(content: string) {
  const clean = sanitizeNoteHtml(content);
  return { content: clean, content_text: htmlToText(clean) };
}

export async function createNote(db: SupabaseClient, userId: string, input: NoteInput): Promise<Note> {
  const row: Record<string, unknown> = {
    user_id: userId,
    title: input.title ?? "",
    folder_id: input.folder_id ?? null,
    is_pinned: input.is_pinned ?? false,
    is_favorite: input.is_favorite ?? false,
    ...(input.content !== undefined ? contentColumns(input.content) : {}),
  };
  const { data, error } = await db.from("notes").insert(row).select("id").single();
  if (error) throw dbError(error);
  if (input.tags?.length) await setTags(db, data.id, input.tags);
  return getNote(db, userId, data.id);
}

export async function updateNote(
  db: SupabaseClient,
  userId: string,
  id: string,
  input: NoteInput,
): Promise<Note> {
  const { tags, expected_version, content, ...fields } = input;
  const row: Record<string, unknown> = { ...fields };
  if (content !== undefined) Object.assign(row, contentColumns(content));
  const editsText = row.title !== undefined || row.content !== undefined;

  if (Object.keys(row).length > 0) {
    let qb = db.from("notes").update(row).eq("user_id", userId).eq("id", id);
    if (editsText) {
      qb = qb.is("deleted_at", null);
      if (expected_version !== undefined) qb = qb.eq("version", expected_version);
    }
    const { data, error } = await qb.select("id");
    if (error) throw dbError(error);
    if (!data?.length) {
      const current = await getNote(db, userId, id); // throws 404 if not ours / missing
      if (current.deleted_at) {
        throw new ApiError(409, "note_in_trash", "Restore the note before editing it");
      }
      throw new ApiError(409, "version_conflict", "Note was changed elsewhere", { current });
    }
  }

  if (tags) await setTags(db, id, tags);
  return getNote(db, userId, id);
}

export async function markOpened(db: SupabaseClient, userId: string, id: string) {
  const { data, error } = await db
    .from("notes")
    .update({ last_opened_at: new Date().toISOString() })
    .eq("user_id", userId)
    .eq("id", id)
    .select("id");
  if (error) throw dbError(error);
  if (!data?.length) throw notFound("Note");
}

export async function trashNote(db: SupabaseClient, userId: string, id: string): Promise<Note> {
  const { data, error } = await db
    .from("notes")
    .update({ deleted_at: new Date().toISOString(), is_pinned: false })
    .eq("user_id", userId)
    .eq("id", id)
    .select("id");
  if (error) throw dbError(error);
  if (!data?.length) throw notFound("Note");
  return getNote(db, userId, id);
}

export async function restoreNote(db: SupabaseClient, userId: string, id: string): Promise<Note> {
  const { data, error } = await db
    .from("notes")
    .update({ deleted_at: null })
    .eq("user_id", userId)
    .eq("id", id)
    .select("id");
  if (error) throw dbError(error);
  if (!data?.length) throw notFound("Note");
  return getNote(db, userId, id);
}

export async function deleteNotePermanently(db: SupabaseClient, userId: string, id: string) {
  const note = await getNote(db, userId, id);
  if (!note.deleted_at) {
    throw new ApiError(409, "not_in_trash", "Move the note to trash before deleting it permanently");
  }
  const { error } = await db.from("notes").delete().eq("user_id", userId).eq("id", id);
  if (error) throw dbError(error);
  await db.rpc("cleanup_orphan_tags");
}

export async function emptyTrash(db: SupabaseClient, userId: string): Promise<{ deleted: number }> {
  const { data, error } = await db
    .from("notes")
    .delete()
    .eq("user_id", userId)
    .not("deleted_at", "is", null)
    .select("id");
  if (error) throw dbError(error);
  await db.rpc("cleanup_orphan_tags");
  return { deleted: data?.length ?? 0 };
}

export async function duplicateNote(db: SupabaseClient, userId: string, id: string): Promise<Note> {
  const source = await getNote(db, userId, id);
  const suffix = " (copy)";
  const base = source.title || "Untitled";
  return createNote(db, userId, {
    title: base.slice(0, MAX_TITLE - suffix.length) + suffix,
    content: source.content,
    folder_id: source.folder_id,
    is_favorite: source.is_favorite,
    tags: source.tags.map((t) => t.name),
  });
}
