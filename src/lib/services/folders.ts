import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { dbError, notFound } from "@/lib/api";
import type { Folder, TagWithCount } from "@/lib/types";

const COLUMNS = "id,name,color,created_at";

export async function listFolders(db: SupabaseClient, userId: string): Promise<Folder[]> {
  const { data, error } = await db
    .from("folders")
    .select(`${COLUMNS},notes(count)`)
    .eq("user_id", userId)
    .is("notes.deleted_at", null)
    .order("name", { ascending: true });
  if (error) throw dbError(error);
  return (data ?? []).map(({ notes, ...f }) => ({
    ...(f as Folder),
    note_count: (notes as { count: number }[] | null)?.[0]?.count ?? 0,
  }));
}

export async function createFolder(
  db: SupabaseClient,
  userId: string,
  input: { name: string; color: string },
): Promise<Folder> {
  const { data, error } = await db
    .from("folders")
    .insert({ user_id: userId, name: input.name, color: input.color })
    .select(COLUMNS)
    .single();
  if (error) throw dbError(error);
  return { ...(data as Folder), note_count: 0 };
}

export async function updateFolder(
  db: SupabaseClient,
  userId: string,
  id: string,
  input: { name?: string; color?: string },
): Promise<Folder> {
  const { data, error } = await db
    .from("folders")
    .update(input)
    .eq("user_id", userId)
    .eq("id", id)
    .select(COLUMNS)
    .maybeSingle();
  if (error) throw dbError(error);
  if (!data) throw notFound("Folder");
  return data as Folder;
}

/** Deleting a folder keeps its notes; their folder_id becomes null (FK rule). */
export async function deleteFolder(db: SupabaseClient, userId: string, id: string) {
  const { data, error } = await db.from("folders").delete().eq("user_id", userId).eq("id", id).select("id");
  if (error) throw dbError(error);
  if (!data?.length) throw notFound("Folder");
}

export async function listTags(db: SupabaseClient, userId: string): Promise<TagWithCount[]> {
  const { data, error } = await db
    .from("tags")
    .select("id,name,note_tags(count)")
    .eq("user_id", userId)
    .order("name", { ascending: true });
  if (error) throw dbError(error);
  return (data ?? []).map(({ note_tags, ...t }) => ({
    id: t.id as string,
    name: t.name as string,
    note_count: (note_tags as { count: number }[] | null)?.[0]?.count ?? 0,
  }));
}
