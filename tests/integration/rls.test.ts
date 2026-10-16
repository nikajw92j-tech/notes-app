import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { anonClient, createTestUser, deleteTestUser, hasSupabase, PNG_BYTES, type TestUser } from "./helpers";

/**
 * Database-level isolation: talks to PostgREST/Storage directly with each
 * user's JWT, bypassing the app, to prove RLS alone protects the data.
 */
describe.skipIf(!hasSupabase)("Row Level Security & storage policies", () => {
  let alice: TestUser;
  let bob: TestUser;
  let aliceNoteId: string;
  let aliceFolderId: string;
  const aliceFile = () => `${alice.id}/rls-test.png`;

  beforeAll(async () => {
    alice = await createTestUser("alice");
    bob = await createTestUser("bob");

    const { data: folder, error: fErr } = await alice.db
      .from("folders")
      .insert({ user_id: alice.id, name: "Private" })
      .select("id")
      .single();
    if (fErr) throw fErr;
    aliceFolderId = folder.id;

    const { data: note, error } = await alice.db
      .from("notes")
      .insert({ user_id: alice.id, title: "alice secret", content: "<p>top secret</p>", content_text: "top secret", folder_id: aliceFolderId })
      .select("id")
      .single();
    if (error) throw error;
    aliceNoteId = note.id;

    const { error: rpcErr } = await alice.db.rpc("set_note_tags", { p_note_id: aliceNoteId, p_names: ["Confidential"] });
    if (rpcErr) throw rpcErr;

    const { error: upErr } = await alice.db.storage
      .from("note-images")
      .upload(aliceFile(), PNG_BYTES, { contentType: "image/png" });
    if (upErr) throw upErr;
  });

  afterAll(async () => {
    await deleteTestUser(alice);
    await deleteTestUser(bob);
  });

  it("creates profile and settings rows on sign-up (trigger)", async () => {
    const { data: profile } = await alice.db.from("profiles").select("email").eq("id", alice.id).single();
    expect(profile?.email).toBe(alice.email);
    const { data: settings } = await alice.db.from("user_settings").select("theme,language").eq("user_id", alice.id).single();
    expect(settings).toEqual({ theme: "system", language: "en" });
  });

  it("owner can read their own note, folder and tags", async () => {
    const { data } = await alice.db.from("notes").select("id,title,note_tags(tags(name))").eq("id", aliceNoteId).single();
    expect(data?.title).toBe("alice secret");
  });

  it("another user cannot read the note, folder, tags or profile", async () => {
    for (const [table, col, id] of [
      ["notes", "id", aliceNoteId],
      ["folders", "id", aliceFolderId],
      ["profiles", "id", alice.id],
      ["user_settings", "user_id", alice.id],
    ] as const) {
      const { data, error } = await bob.db.from(table).select("*").eq(col, id);
      expect(error).toBeNull();
      expect(data).toEqual([]);
    }
    const { data: tags } = await bob.db.from("tags").select("*").eq("user_id", alice.id);
    expect(tags).toEqual([]);
    const { data: search } = await bob.db.from("notes").select("id").textSearch("search_vector", "secret:*", { config: "simple" });
    expect(search).toEqual([]);
  });

  it("another user cannot update or delete the note", async () => {
    const { data: updated } = await bob.db.from("notes").update({ title: "pwned" }).eq("id", aliceNoteId).select("id");
    expect(updated).toEqual([]);
    const { data: deleted } = await bob.db.from("notes").delete().eq("id", aliceNoteId).select("id");
    expect(deleted).toEqual([]);
    const { data } = await alice.db.from("notes").select("title").eq("id", aliceNoteId).single();
    expect(data?.title).toBe("alice secret");
  });

  it("cannot create rows on behalf of another user", async () => {
    const { error } = await bob.db.from("notes").insert({ user_id: alice.id, title: "forged" });
    expect(error).not.toBeNull();
  });

  it("cannot file a note into someone else's folder (composite FK)", async () => {
    const { error } = await bob.db.from("notes").insert({ user_id: bob.id, title: "x", folder_id: aliceFolderId });
    expect(error).not.toBeNull();
  });

  it("cannot transfer ownership of their own note", async () => {
    const { data: own } = await bob.db.from("notes").insert({ user_id: bob.id, title: "bob" }).select("id").single();
    await bob.db.from("notes").update({ user_id: alice.id }).eq("id", own!.id);
    const { data } = await bob.db.from("notes").select("user_id").eq("id", own!.id).single();
    expect(data?.user_id).toBe(bob.id);
  });

  it("set_note_tags refuses notes the caller does not own", async () => {
    const { error } = await bob.db.rpc("set_note_tags", { p_note_id: aliceNoteId, p_names: ["hijack"] });
    expect(error).not.toBeNull();
  });

  it("bumps version only on title/content edits", async () => {
    const { data: before } = await alice.db.from("notes").select("version,updated_at").eq("id", aliceNoteId).single();
    await alice.db.from("notes").update({ is_pinned: true }).eq("id", aliceNoteId);
    const { data: pinned } = await alice.db.from("notes").select("version,updated_at").eq("id", aliceNoteId).single();
    expect(pinned).toEqual(before);
    await alice.db.from("notes").update({ title: "alice secret 2" }).eq("id", aliceNoteId);
    const { data: edited } = await alice.db.from("notes").select("version").eq("id", aliceNoteId).single();
    expect(edited?.version).toBe(before!.version + 1);
  });

  it("anonymous clients see nothing", async () => {
    const { data } = await anonClient().from("notes").select("id");
    expect(data ?? []).toEqual([]);
  });

  it("storage: another user cannot read, list, overwrite or delete the owner's file", async () => {
    const { data: signed, error } = await bob.db.storage.from("note-images").createSignedUrl(aliceFile(), 60);
    expect(signed).toBeNull();
    expect(error).not.toBeNull();

    const { data: listing } = await bob.db.storage.from("note-images").list(alice.id);
    expect(listing ?? []).toEqual([]);

    const { error: upErr } = await bob.db.storage
      .from("note-images")
      .upload(aliceFile(), PNG_BYTES, { contentType: "image/png", upsert: true });
    expect(upErr).not.toBeNull();

    const { data: removed } = await bob.db.storage.from("note-images").remove([aliceFile()]);
    expect(removed ?? []).toEqual([]);
    const { data: stillThere } = await alice.db.storage.from("note-images").createSignedUrl(aliceFile(), 60);
    expect(stillThere?.signedUrl).toBeTruthy();
  });

  it("storage: users cannot upload outside their own folder", async () => {
    const { error } = await bob.db.storage
      .from("note-images")
      .upload(`${alice.id}/planted.png`, PNG_BYTES, { contentType: "image/png" });
    expect(error).not.toBeNull();
  });
});
