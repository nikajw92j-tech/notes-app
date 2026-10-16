"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { NotebookPen } from "lucide-react";
import { Header } from "@/components/app/header";
import { useWorkspace } from "@/components/app/workspace";
import { BlankState } from "@/components/ui/misc";
import dynamic from "next/dynamic";
import { Skeleton } from "@/components/ui/misc";

// TipTap is the heaviest dependency — load it only when a note is opened.
const NoteEditor = dynamic(() => import("@/components/notes/note-editor").then((m) => m.NoteEditor), {
  ssr: false,
  loading: () => (
    <div className="flex flex-1 flex-col gap-5 px-6 py-5" aria-busy="true">
      <Skeleton className="h-7 w-2/3" />
      <Skeleton className="h-4 w-1/3" />
      <Skeleton className="h-40 w-full" />
    </div>
  ),
});
import { NoteList } from "@/components/notes/note-list";
import { useNoteList } from "@/components/notes/use-note-list";
import { useNoteParams } from "@/components/notes/use-note-params";
import { useI18n, type MessageKey } from "@/lib/i18n";
import type { NoteSummary, NoteView } from "@/lib/types";
import { cn } from "@/lib/cn";

const VIEW_TITLES: Record<NoteView, MessageKey> = {
  all: "nav.allNotes",
  favorites: "nav.favorites",
  recent: "nav.recent",
  archived: "nav.archived",
  trash: "nav.trash",
};

function useIsDesktop() {
  const [desktop, setDesktop] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia("(min-width: 1024px)");
    const update = () => setDesktop(mq.matches);
    update();
    mq.addEventListener("change", update);
    return () => mq.removeEventListener("change", update);
  }, []);
  return desktop;
}

export function NotesWorkspace() {
  const { t } = useI18n();
  const params = useNoteParams();
  const { view, folder, tag, q, note, setParams } = params;
  const { folders, tags, settings, notesRevision, createNote } = useWorkspace();
  const sort = params.sort ?? (view === "recent" ? "opened" : settings.preferences.sort ?? "updated");
  const list = useNoteList({ view, folder, tag, q, sort }, notesRevision);
  const [creating, setCreating] = useState(false);
  const [freshId, setFreshId] = useState<string | null>(null);
  const isDesktop = useIsDesktop();

  const folderName = folder ? folders?.find((f) => f.id === folder)?.name : undefined;
  const tagName = tag ? tags?.find((tg) => tg.id === tag)?.name : undefined;
  const title = q
    ? t("header.search", { q })
    : folder
      ? t("header.folder", { name: folderName ?? "…" })
      : tag
        ? t("header.tag", { tag: tagName ?? "…" })
        : t(VIEW_TITLES[view]);

  useEffect(() => {
    document.title = `${title} · ${t("app.name")}`;
  }, [title, t]);

  // Desktop shows the first note when nothing is selected (as in the design).
  const autoSelected = useRef<string | null>(null);
  useEffect(() => {
    if (!isDesktop || note || !list.items?.length) return;
    const key = JSON.stringify({ view, folder, tag, q });
    if (autoSelected.current === key) return;
    autoSelected.current = key;
    setParams({ note: list.items[0].id }, { replace: true });
  }, [isDesktop, note, list.items, view, folder, tag, q, setParams]);

  const handleCreate = useCallback(async () => {
    if (creating) return;
    setCreating(true);
    const created = await createNote({
      folder_id: folder,
      tags: tagName ? [tagName] : undefined,
      is_favorite: view === "favorites" || undefined,
    });
    setCreating(false);
    if (!created) return;
    const leaveView = view === "archived" || view === "trash" || view === "recent";
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { content, ...summary } = created;
    if (!leaveView && !q) list.prependItem(summary);
    setFreshId(created.id);
    setParams({ note: created.id, view: leaveView ? null : undefined, q: null, search: null });
  }, [createNote, creating, folder, list, q, setParams, tagName, view]);

  const handleSummary = useCallback(
    (s: NoteSummary) => list.patchItem(s.id, s),
    [list],
  );

  return (
    <>
      <Header title={title} />
      <div className="flex min-h-0 flex-1">
        <NoteList
          title={title}
          items={list.items}
          error={list.error}
          hasMore={list.hasMore}
          loadingMore={list.loadingMore}
          onLoadMore={list.loadMore}
          onRetry={list.retry}
          onCreate={handleCreate}
          creating={creating}
          sort={sort}
          className={note ? "hidden lg:flex" : "flex"}
        />
        <div className={cn("min-w-0 flex-1", note ? "flex" : "hidden lg:flex")}>
          {note ? (
            <NoteEditor
              key={note}
              id={note}
              autoFocusTitle={freshId === note}
              onSummary={handleSummary}
              onClose={() => setParams({ note: null })}
              onOpenNote={(id) => setParams({ note: id })}
            />
          ) : (
            <BlankState icon={<NotebookPen className="size-9" />}>{t("list.noSelection")}</BlankState>
          )}
        </div>
      </div>
    </>
  );
}
