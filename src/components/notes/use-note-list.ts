"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { api } from "@/lib/client/api";
import type { NoteListResponse, NoteSort, NoteSummary, NoteView } from "@/lib/types";

interface Query {
  view: NoteView;
  folder: string | null;
  tag: string | null;
  q: string;
  sort: NoteSort;
}

function toQueryString(query: Query, page: number, limit: number) {
  const sp = new URLSearchParams({ view: query.view, sort: query.sort, page: String(page), limit: String(limit) });
  if (query.folder) sp.set("folder", query.folder);
  if (query.tag) sp.set("tag", query.tag);
  if (query.q) sp.set("q", query.q);
  return sp.toString();
}

const PAGE = 50;

export function useNoteList(query: Query, revision: number) {
  const [items, setItems] = useState<NoteSummary[] | null>(null);
  const [nextPage, setNextPage] = useState<number | null>(null);
  const [error, setError] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const requestId = useRef(0);
  const countRef = useRef(0);
  countRef.current = items?.length ?? 0;

  const key = JSON.stringify(query);
  const endpoint = query.q ? "/api/search" : "/api/notes";

  const load = useCallback(
    async (silent: boolean) => {
      const id = ++requestId.current;
      if (!silent) {
        setItems(null);
        setError(false);
      }
      const limit = silent ? Math.min(100, Math.max(PAGE, countRef.current)) : PAGE;
      try {
        const res = await api<NoteListResponse>(`${endpoint}?${toQueryString(query, 0, limit)}`);
        if (id !== requestId.current) return;
        setItems(res.items);
        setNextPage(res.nextPage === null ? null : Math.ceil(res.items.length / PAGE));
        setError(false);
      } catch {
        if (id !== requestId.current) return;
        if (!silent) setError(true);
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [key],
  );

  const loadRef = useRef(load);
  loadRef.current = load;

  useEffect(() => {
    void load(false);
  }, [load]);

  useEffect(() => {
    if (revision > 0) void loadRef.current(true);
  }, [revision]);

  const loadMore = useCallback(async () => {
    if (nextPage === null || loadingMore) return;
    setLoadingMore(true);
    const id = requestId.current;
    try {
      const res = await api<NoteListResponse>(`${endpoint}?${toQueryString(query, nextPage, PAGE)}`);
      if (id !== requestId.current) return;
      setItems((prev) => {
        const seen = new Set(prev?.map((n) => n.id));
        return [...(prev ?? []), ...res.items.filter((n) => !seen.has(n.id))];
      });
      setNextPage(res.nextPage);
    } finally {
      setLoadingMore(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, nextPage, loadingMore]);

  const patchItem = useCallback((id: string, patch: Partial<NoteSummary>) => {
    setItems((prev) => prev?.map((n) => (n.id === id ? { ...n, ...patch } : n)) ?? prev);
  }, []);

  const prependItem = useCallback((note: NoteSummary) => {
    setItems((prev) => [note, ...(prev ?? []).filter((n) => n.id !== note.id)]);
  }, []);

  return {
    items,
    error,
    hasMore: nextPage !== null,
    loadingMore,
    loadMore,
    retry: () => void load(false),
    patchItem,
    prependItem,
  };
}
