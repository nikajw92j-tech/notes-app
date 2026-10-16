"use client";

import { useCallback, useMemo } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { NOTE_SORTS, NOTE_VIEWS, type NoteSort, type NoteView } from "@/lib/types";

export type ParamKey = "view" | "folder" | "tag" | "q" | "sort" | "note" | "search";

export interface NoteParams {
  view: NoteView;
  folder: string | null;
  tag: string | null;
  q: string;
  sort: NoteSort | null;
  note: string | null;
  search: boolean;
}

export function notesHref(params: Partial<Record<ParamKey, string | null | undefined>> = {}) {
  const sp = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) if (v) sp.set(k, v);
  const s = sp.toString();
  return `/notes${s ? `?${s}` : ""}`;
}

export function useNoteParams() {
  const sp = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();

  const params = useMemo<NoteParams>(() => {
    const view = sp.get("view");
    const sort = sp.get("sort");
    return {
      view: (NOTE_VIEWS as readonly string[]).includes(view ?? "") ? (view as NoteView) : "all",
      folder: sp.get("folder"),
      tag: sp.get("tag"),
      q: sp.get("q") ?? "",
      sort: (NOTE_SORTS as readonly string[]).includes(sort ?? "") ? (sort as NoteSort) : null,
      note: sp.get("note"),
      search: sp.get("search") === "1",
    };
  }, [sp]);

  const setParams = useCallback(
    /** `null`/"" removes a key, `undefined` leaves it untouched. */
    (patch: Partial<Record<ParamKey, string | null | undefined>>, opts: { replace?: boolean } = {}) => {
      const next = new URLSearchParams(pathname === "/notes" ? sp.toString() : "");
      for (const [k, v] of Object.entries(patch)) {
        if (v === undefined) continue;
        if (v === null || v === "") next.delete(k);
        else next.set(k, v);
      }
      const s = next.toString();
      const url = `/notes${s ? `?${s}` : ""}`;
      if (opts.replace) router.replace(url, { scroll: false });
      else router.push(url, { scroll: false });
    },
    [pathname, router, sp],
  );

  return { ...params, isNotesPage: pathname === "/notes", setParams };
}
