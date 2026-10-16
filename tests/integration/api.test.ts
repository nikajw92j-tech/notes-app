import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { anonClient, call, createTestUser, deleteTestUser, hasApp, PNG_BYTES, type TestUser } from "./helpers";

/** End-to-end checks of the REST API against a running app (TEST_APP_URL). */
describe.skipIf(!hasApp)("REST API", () => {
  let alice: TestUser;
  let bob: TestUser;

  beforeAll(async () => {
    alice = await createTestUser("api-alice");
    bob = await createTestUser("api-bob");
  });

  afterAll(async () => {
    await deleteTestUser(alice);
    await deleteTestUser(bob);
  });

  describe("authentication", () => {
    it("logs in with correct credentials and rejects a wrong password", async () => {
      const ok = await anonClient().auth.signInWithPassword({ email: alice.email, password: alice.password });
      expect(ok.error).toBeNull();
      const bad = await anonClient().auth.signInWithPassword({ email: alice.email, password: "wrong-password" });
      expect(bad.error?.code).toBe("invalid_credentials");
    });

    it("rejects unauthenticated requests with 401", async () => {
      for (const [m, p] of [
        ["GET", "/api/notes"],
        ["POST", "/api/notes"],
        ["GET", "/api/folders"],
        ["GET", "/api/search?q=x"],
        ["GET", "/api/profile"],
        ["PATCH", "/api/settings"],
        ["POST", "/api/uploads"],
        ["DELETE", "/api/account"],
      ] as const) {
        const res = await call(null, m, p, m === "GET" ? undefined : {});
        expect(res.status, `${m} ${p}`).toBe(401);
      }
    });

    it("rejects a forged token", async () => {
      const res = await call({ ...alice, token: "not.a.jwt" }, "GET", "/api/notes");
      expect(res.status).toBe(401);
    });

    it("redirects unauthenticated page visits to /login", async () => {
      const res = await fetch(`${process.env.TEST_APP_URL}/notes`, { redirect: "manual" });
      expect([302, 307]).toContain(res.status);
      expect(res.headers.get("location")).toContain("/login");
    });
  });

  describe("notes lifecycle", () => {
    let id: string;
    let version: number;

    it("creates a note (sanitised, with tags)", async () => {
      const res = await call(alice, "POST", "/api/notes", {
        title: "Groceries",
        content: '<p>milk<script>alert(1)</script></p><ul data-type="taskList"><li data-type="taskItem" data-checked="false"><label><input type="checkbox"><span></span></label><div><p>eggs</p></div></li></ul>',
        tags: ["Home", "home", "Shopping"],
      });
      expect(res.status).toBe(201);
      expect(res.body.content).not.toContain("script");
      expect(res.body.tags.map((t: { name: string }) => t.name)).toEqual(["Home", "Shopping"]);
      id = res.body.id;
      version = res.body.version;
    });

    it("rejects invalid input with 400", async () => {
      expect((await call(alice, "POST", "/api/notes", { title: 5 })).status).toBe(400);
      expect((await call(alice, "POST", "/api/notes", { user_id: bob.id })).status).toBe(400);
      expect((await call(alice, "GET", "/api/notes?view=nope")).status).toBe(400);
    });

    it("reads and edits it with optimistic locking", async () => {
      expect((await call(alice, "GET", `/api/notes/${id}`)).body.title).toBe("Groceries");
      const res = await call(alice, "PATCH", `/api/notes/${id}`, { title: "Groceries (Sat)", expected_version: version });
      expect(res.status).toBe(200);
      expect(res.body.version).toBe(version + 1);
    });

    it("rejects a stale write with 409 and returns the current note", async () => {
      const res = await call(alice, "PATCH", `/api/notes/${id}`, { content: "<p>old tab</p>", expected_version: version });
      expect(res.status).toBe(409);
      expect(res.body.error.code).toBe("version_conflict");
      expect(res.body.error.details.current.title).toBe("Groceries (Sat)");
    });

    it("finds it with full-text prefix search", async () => {
      const res = await call(alice, "GET", "/api/search?q=grocer");
      expect(res.status).toBe(200);
      expect(res.body.items.map((n: { id: string }) => n.id)).toContain(id);
    });

    it("pins, favourites, archives and duplicates", async () => {
      await call(alice, "PATCH", `/api/notes/${id}`, { is_pinned: true, is_favorite: true });
      const favs = await call(alice, "GET", "/api/notes?view=favorites");
      expect(favs.body.items[0].id).toBe(id);

      await call(alice, "PATCH", `/api/notes/${id}`, { is_archived: true });
      const all = await call(alice, "GET", "/api/notes");
      expect(all.body.items.map((n: { id: string }) => n.id)).not.toContain(id);
      const archived = await call(alice, "GET", "/api/notes?view=archived");
      expect(archived.body.items.map((n: { id: string }) => n.id)).toContain(id);
      await call(alice, "PATCH", `/api/notes/${id}`, { is_archived: false });

      const dup = await call(alice, "POST", `/api/notes/${id}/duplicate`);
      expect(dup.status).toBe(201);
      expect(dup.body.title).toBe("Groceries (Sat) (copy)");
      expect(dup.body.tags).toHaveLength(2);
    });

    it("moves to trash, restores, and only purges from trash", async () => {
      expect((await call(alice, "DELETE", `/api/notes/${id}/permanent`)).status).toBe(409);

      const trashed = await call(alice, "DELETE", `/api/notes/${id}`);
      expect(trashed.body.deleted_at).toBeTruthy();
      const edit = await call(alice, "PATCH", `/api/notes/${id}`, { title: "x" });
      expect(edit.status).toBe(409);

      const restored = await call(alice, "POST", `/api/notes/${id}/restore`);
      expect(restored.body.deleted_at).toBeNull();

      await call(alice, "DELETE", `/api/notes/${id}`);
      expect((await call(alice, "DELETE", `/api/notes/${id}/permanent`)).status).toBe(204);
      expect((await call(alice, "GET", `/api/notes/${id}`)).status).toBe(404);
    });
  });

  describe("folders", () => {
    it("creates, renames and deletes a folder (notes are kept)", async () => {
      const f = await call(alice, "POST", "/api/folders", { name: "Work", color: "#21C16B" });
      expect(f.status).toBe(201);
      expect((await call(alice, "POST", "/api/folders", { name: "work" })).status).toBe(409);

      const note = await call(alice, "POST", "/api/notes", { title: "in folder", folder_id: f.body.id });
      const listed = await call(alice, "GET", `/api/notes?folder=${f.body.id}`);
      expect(listed.body.items).toHaveLength(1);

      const renamed = await call(alice, "PATCH", `/api/folders/${f.body.id}`, { name: "Office" });
      expect(renamed.body.name).toBe("Office");

      expect((await call(alice, "DELETE", `/api/folders/${f.body.id}`)).status).toBe(204);
      const after = await call(alice, "GET", `/api/notes/${note.body.id}`);
      expect(after.status).toBe(200);
      expect(after.body.folder_id).toBeNull();
    });
  });

  describe("user data isolation", () => {
    let aliceNote: string;
    let aliceFolder: string;

    beforeAll(async () => {
      aliceNote = (await call(alice, "POST", "/api/notes", { title: "alice only" })).body.id;
      aliceFolder = (await call(alice, "POST", "/api/folders", { name: "Alice private" })).body.id;
    });

    it("another user gets 404 for every operation on someone else's note", async () => {
      expect((await call(bob, "GET", `/api/notes/${aliceNote}`)).status).toBe(404);
      expect((await call(bob, "PATCH", `/api/notes/${aliceNote}`, { title: "pwned" })).status).toBe(404);
      expect((await call(bob, "DELETE", `/api/notes/${aliceNote}`)).status).toBe(404);
      expect((await call(bob, "POST", `/api/notes/${aliceNote}/restore`)).status).toBe(404);
      expect((await call(bob, "POST", `/api/notes/${aliceNote}/duplicate`)).status).toBe(404);
      expect((await call(bob, "DELETE", `/api/notes/${aliceNote}/permanent`)).status).toBe(404);
      expect((await call(alice, "GET", `/api/notes/${aliceNote}`)).body.title).toBe("alice only");
    });

    it("another user cannot see, edit or delete someone else's folder", async () => {
      const list = await call(bob, "GET", "/api/folders");
      expect(list.body.map((f: { id: string }) => f.id)).not.toContain(aliceFolder);
      expect((await call(bob, "PATCH", `/api/folders/${aliceFolder}`, { name: "x" })).status).toBe(404);
      expect((await call(bob, "DELETE", `/api/folders/${aliceFolder}`)).status).toBe(404);
      expect((await call(bob, "POST", "/api/notes", { folder_id: aliceFolder })).status).toBe(400);
    });

    it("search and listings never include another user's notes", async () => {
      const search = await call(bob, "GET", "/api/search?q=alice");
      expect(search.body.items).toEqual([]);
      const all = await call(bob, "GET", "/api/notes");
      expect(all.body.items.map((n: { id: string }) => n.id)).not.toContain(aliceNote);
    });
  });

  describe("file uploads", () => {
    let src: string;

    it("accepts a real image and rejects disguised or oversized files", async () => {
      const ok = new FormData();
      ok.append("file", new Blob([PNG_BYTES], { type: "image/png" }), "dot.png");
      const res = await call(alice, "POST", "/api/uploads", ok);
      expect(res.status).toBe(201);
      src = res.body.src;

      const fake = new FormData();
      fake.append("file", new Blob(["<svg onload=alert(1)>"], { type: "image/png" }), "x.png");
      expect((await call(alice, "POST", "/api/uploads", fake)).status).toBe(415);

      const big = new FormData();
      const huge = new Uint8Array(6 * 1024 * 1024);
      huge.set(PNG_BYTES);
      big.append("file", new Blob([huge], { type: "image/png" }), "big.png");
      expect((await call(alice, "POST", "/api/uploads", big)).status).toBe(413);
    });

    it("serves the file to its owner only", async () => {
      const own = await call(alice, "GET", src);
      expect(own.status).toBe(302);
      expect(own.headers.get("location")).toContain("token=");
      expect((await call(bob, "GET", src)).status).toBe(404);
      expect((await call(null, "GET", src)).status).toBe(401);
    });

    it("lets only the owner delete it", async () => {
      expect((await call(bob, "DELETE", src)).status).toBe(404);
      const files = await call(alice, "GET", "/api/files");
      expect(files.body.map((f: { src: string }) => f.src)).toContain(src);
      expect((await call(alice, "DELETE", src)).status).toBe(204);
    });
  });

  describe("profile & settings", () => {
    it("updates username and persists settings", async () => {
      const name = `user_${Date.now().toString(36)}`;
      const p = await call(alice, "PATCH", "/api/profile", { username: name });
      expect(p.body.username).toBe(name);
      expect((await call(alice, "PATCH", "/api/profile", { username: "x" })).status).toBe(400);

      const s = await call(alice, "PATCH", "/api/settings", { theme: "dark", language: "ka", preferences: { font: "serif" } });
      expect(s.body).toMatchObject({ theme: "dark", language: "ka", preferences: { font: "serif" } });
      const again = await call(alice, "GET", "/api/settings");
      expect(again.body.language).toBe("ka");
    });
  });
});
