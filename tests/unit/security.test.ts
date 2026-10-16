import { describe, expect, it } from "vitest";
import { htmlToText, isAllowedImageSrc, sanitizeNoteHtml } from "@/lib/sanitize";
import { buildPrefixTsQuery } from "@/lib/search";
import { rateLimit } from "@/lib/rate-limit";
import { assertOwnPath, sniffImageType } from "@/lib/services/storage";
import {
  folderCreateSchema,
  noteCreateSchema,
  noteListQuerySchema,
  noteUpdateSchema,
  safeNextPath,
  settingsUpdateSchema,
} from "@/lib/validation";

const UID = "6f1c2a8e-3b4d-4e5f-8a9b-0c1d2e3f4a5b";

describe("rich-text sanitisation", () => {
  it("removes scripts, event handlers and javascript: URLs", () => {
    const dirty =
      '<p onclick="steal()">Hi<script>alert(1)</script></p><a href="javascript:alert(1)">x</a><img src="x" onerror="alert(1)"><iframe src="https://evil"></iframe>';
    const clean = sanitizeNoteHtml(dirty);
    expect(clean).not.toMatch(/script|onclick|onerror|javascript:|iframe/i);
    expect(clean).toContain("<p>Hi</p>");
  });

  it("keeps editor formatting: headings, lists, checklists, tables, code, highlight", () => {
    const html =
      '<h1>T</h1><h2>a</h2><h3>b</h3><p><strong>b</strong><em>i</em><u>u</u><mark>m</mark></p>' +
      '<ul data-type="taskList"><li data-type="taskItem" data-checked="true"><label><input type="checkbox" checked="checked"><span></span></label><div><p>done</p></div></li></ul>' +
      '<ol><li><p>1</p></li></ol><blockquote><p>q</p></blockquote><pre><code class="language-ts">x</code></pre>' +
      '<table><tbody><tr><th colspan="1"><p>h</p></th></tr><tr><td><p>c</p></td></tr></tbody></table>';
    const clean = sanitizeNoteHtml(html);
    for (const frag of ["<h1>", "<h3>", "<mark>", 'data-checked="true"', 'type="checkbox"', "<table>", 'class="language-ts"', "<blockquote>"]) {
      expect(clean).toContain(frag);
    }
  });

  it("forces safe link attributes", () => {
    const clean = sanitizeNoteHtml('<a href="https://example.com" target="_self">x</a>');
    expect(clean).toContain('rel="noopener noreferrer nofollow"');
    expect(clean).toContain('target="_blank"');
  });

  it("only allows images from our private file route or https", () => {
    expect(isAllowedImageSrc(`/api/files/note-images/${UID}/a1b2.png`)).toBe(true);
    expect(isAllowedImageSrc("https://example.com/a.png")).toBe(true);
    expect(isAllowedImageSrc("http://example.com/a.png")).toBe(false);
    expect(isAllowedImageSrc("data:image/png;base64,AAAA")).toBe(false);
    expect(isAllowedImageSrc("/api/files/note-images/../../etc/passwd")).toBe(false);
    expect(sanitizeNoteHtml('<img src="data:image/png;base64,AAAA">')).toBe("");
  });

  it("produces a plain-text projection for search", () => {
    expect(htmlToText("<h1>Title</h1><p>one&nbsp;two</p><ul><li>three</li></ul>")).toBe("Title one two three");
  });
});

describe("full-text query builder", () => {
  it("builds prefix queries and strips tsquery operators", () => {
    expect(buildPrefixTsQuery("react hooks")).toBe("react:* & hooks:*");
    expect(buildPrefixTsQuery("a' | b & !c:*")).toBe("a:* & b:* & c:*");
    expect(buildPrefixTsQuery("!!!")).toBeNull();
  });

  it("supports Georgian and Cyrillic words", () => {
    expect(buildPrefixTsQuery("ჩანაწერი Заметка")).toBe("ჩანაწერი:* & заметка:*");
  });
});

describe("input validation", () => {
  it("rejects unknown fields (mass-assignment protection)", () => {
    expect(noteCreateSchema.safeParse({ title: "x", user_id: UID }).success).toBe(false);
    expect(noteUpdateSchema.safeParse({ version: 99 }).success).toBe(false);
  });

  it("de-duplicates tags case-insensitively and enforces limits", () => {
    const parsed = noteCreateSchema.parse({ tags: ["Work", "work", " Ideas "] });
    expect(parsed.tags).toEqual(["Work", "Ideas"]);
    expect(noteCreateSchema.safeParse({ tags: Array.from({ length: 21 }, (_, i) => `t${i}`) }).success).toBe(false);
    expect(noteCreateSchema.safeParse({ title: "x".repeat(201) }).success).toBe(false);
  });

  it("requires something to update", () => {
    expect(noteUpdateSchema.safeParse({}).success).toBe(false);
    expect(noteUpdateSchema.safeParse({ expected_version: 1 }).success).toBe(false);
    expect(noteUpdateSchema.safeParse({ title: "x", expected_version: 1 }).success).toBe(true);
  });

  it("validates list query params", () => {
    expect(noteListQuerySchema.parse({}).view).toBe("all");
    expect(noteListQuerySchema.safeParse({ view: "everything" }).success).toBe(false);
    expect(noteListQuerySchema.safeParse({ folder: "not-a-uuid" }).success).toBe(false);
    expect(noteListQuerySchema.safeParse({ limit: "1000" }).success).toBe(false);
  });

  it("validates folders and settings", () => {
    expect(folderCreateSchema.safeParse({ name: "  " }).success).toBe(false);
    expect(folderCreateSchema.safeParse({ name: "Work", color: "red" }).success).toBe(false);
    expect(settingsUpdateSchema.safeParse({ language: "de" }).success).toBe(false);
    expect(settingsUpdateSchema.safeParse({ language: "ka", theme: "dark" }).success).toBe(true);
  });

  it("only allows same-site redirect targets", () => {
    expect(safeNextPath("/notes?view=archived")).toBe("/notes?view=archived");
    expect(safeNextPath("//evil.com")).toBe("/notes");
    expect(safeNextPath("https://evil.com")).toBe("/notes");
    expect(safeNextPath("/\\evil.com")).toBe("/notes");
  });
});

describe("upload validation", () => {
  it("detects real image types from magic bytes", () => {
    expect(sniffImageType(new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))).toBe("image/png");
    expect(sniffImageType(new Uint8Array([0xff, 0xd8, 0xff, 0xe0]))).toBe("image/jpeg");
    expect(sniffImageType(new TextEncoder().encode("<svg onload=alert(1)>"))).toBeNull();
    expect(sniffImageType(new TextEncoder().encode("GIF89a"))).toBe("image/gif");
  });

  it("refuses paths outside the caller's own folder", () => {
    expect(() => assertOwnPath(UID, `${UID}/abc.png`)).not.toThrow();
    expect(() => assertOwnPath(UID, `00000000-0000-4000-8000-000000000000/abc.png`)).toThrow();
    expect(() => assertOwnPath(UID, `${UID}/../x.png`)).toThrow();
    expect(() => assertOwnPath(UID, `${UID}/a/b.png`)).toThrow();
  });
});

describe("rate limiting", () => {
  it("blocks after the limit and resets after the window", () => {
    const key = `test:${Math.random()}`;
    const now = 1_000_000;
    for (let i = 0; i < 3; i++) expect(rateLimit(key, 3, 1000, now).ok).toBe(true);
    const blocked = rateLimit(key, 3, 1000, now + 10);
    expect(blocked.ok).toBe(false);
    expect(blocked.retryAfterSeconds).toBe(1);
    expect(rateLimit(key, 3, 1000, now + 1001).ok).toBe(true);
  });
});
