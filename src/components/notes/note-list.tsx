"use client";

import Link from "next/link";
import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { ArrowDownWideNarrow, Pin, Plus, Star, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/dialog";
import { Menu, MenuItem } from "@/components/ui/menu";
import { EmptyState, Skeleton } from "@/components/ui/misc";
import { SearchInput } from "@/components/app/header";
import { useWorkspace } from "@/components/app/workspace";
import { notesHref, useNoteParams } from "@/components/notes/use-note-params";
import { api, errorMessage } from "@/lib/client/api";
import { useI18n, type MessageKey } from "@/lib/i18n";
import { NOTE_SORTS, type NoteSort, type NoteSummary } from "@/lib/types";
import { cn } from "@/lib/cn";

export function TagChip({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-flex max-w-full items-center truncate rounded bg-chip px-1.5 py-0.5 text-preset-6 text-fg">
      {children}
    </span>
  );
}

function NoteListItem({ note, active, href }: { note: NoteSummary; active: boolean; href: string }) {
  const { t, formatDate } = useI18n();
  const { folders } = useWorkspace();
  const { q } = useNoteParams();
  const folder = note.folder_id ? folders?.find((f) => f.id === note.folder_id) : undefined;

  return (
    <motion.li
      layout="position"
      initial={{ opacity: 0, y: -6 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, height: 0, transition: { duration: 0.18 } }}
      transition={{ duration: 0.2, ease: "easeOut" }}
      className="border-b border-line last:border-b-0"
    >
      <Link
        href={href}
        scroll={false}
        aria-current={active ? "true" : undefined}
        className={cn(
          "focus-ring my-1 flex flex-col gap-3 rounded-md p-2 transition-colors",
          active ? "bg-muted" : "hover:bg-hover",
        )}
      >
        <div className="flex items-start justify-between gap-2">
          <h3 className={cn("min-w-0 break-words text-preset-3", note.title ? "text-fg" : "text-fg-5")}>
            {note.title || t("list.untitled")}
          </h3>
          <span className="flex shrink-0 items-center gap-1 pt-0.5 text-fg-5">
            {note.is_pinned && <Pin className="size-3.5 fill-current text-blue-500" aria-label={t("list.pinned")} />}
            {note.is_favorite && <Star className="size-3.5 fill-amber-400 text-amber-400" aria-label={t("list.favorite")} />}
          </span>
        </div>
        {q && note.excerpt && <p className="line-clamp-2 text-preset-6 text-fg-4">{note.excerpt}</p>}
        {note.tags.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {note.tags.map((tag) => (
              <TagChip key={tag.id}>{tag.name}</TagChip>
            ))}
          </div>
        )}
        <p className="flex items-center gap-1.5 text-preset-6 text-fg-3">
          <time dateTime={note.updated_at}>{formatDate(note.deleted_at ?? note.updated_at)}</time>
          {folder && (
            <>
              <span aria-hidden>·</span>
              <span className="size-2 rounded-full" style={{ backgroundColor: folder.color }} aria-hidden />
              <span className="truncate">{folder.name}</span>
            </>
          )}
        </p>
      </Link>
    </motion.li>
  );
}

function ListSkeleton() {
  return (
    <div className="flex flex-col gap-4 pt-2" aria-busy="true" aria-live="polite">
      {Array.from({ length: 6 }).map((_, i) => (
        <div key={i} className="flex flex-col gap-3 border-b border-line p-2 pb-4 last:border-0">
          <Skeleton className="h-4 w-4/5" />
          <div className="flex gap-1">
            <Skeleton className="h-4 w-12" />
            <Skeleton className="h-4 w-16" />
          </div>
          <Skeleton className="h-3 w-20" />
        </div>
      ))}
    </div>
  );
}

const SORT_LABEL: Record<NoteSort, MessageKey> = {
  updated: "sort.updated",
  created: "sort.created",
  title: "sort.title",
  opened: "sort.opened",
};

interface NoteListProps {
  title: string;
  items: NoteSummary[] | null;
  error: boolean;
  hasMore: boolean;
  loadingMore: boolean;
  onLoadMore: () => void;
  onRetry: () => void;
  onCreate: () => void;
  creating: boolean;
  sort: NoteSort;
  className?: string;
}

export function NoteList({
  title,
  items,
  error,
  hasMore,
  loadingMore,
  onLoadMore,
  onRetry,
  onCreate,
  creating,
  sort,
  className,
}: NoteListProps) {
  const { t } = useI18n();
  const params = useNoteParams();
  const { view, folder, tag, q, note: activeId, search, setParams } = params;
  const { tags, updateSettings, invalidateNotes } = useWorkspace();
  const [confirmEmpty, setConfirmEmpty] = useState(false);
  const [emptying, setEmptying] = useState(false);
  const tagName = tag ? tags?.find((tg) => tg.id === tag)?.name ?? "" : "";

  const hint =
    q ? t("list.hint.search", { q })
    : tag ? t("list.hint.tag", { tag: tagName })
    : view === "archived" ? t("list.hint.archived")
    : view === "trash" ? t("list.hint.trash")
    : view === "recent" ? t("list.hint.recent")
    : null;

  const emptyKey: MessageKey =
    q ? "list.empty.search"
    : tag ? "list.empty.tag"
    : folder ? "list.empty.folder"
    : (`list.empty.${view}` as MessageKey);

  const emptyTrash = async () => {
    setEmptying(true);
    try {
      await api("/api/trash", { method: "DELETE" });
      toast.success(t("toast.trashEmptied"));
      setConfirmEmpty(false);
      setParams({ note: null });
      invalidateNotes();
    } catch (err) {
      toast.error(errorMessage(err, t("toast.error")));
    } finally {
      setEmptying(false);
    }
  };

  const hrefFor = (id: string) =>
    notesHref({ view: view === "all" ? null : view, folder, tag, q: q || null, sort: params.sort, search: search ? "1" : null, note: id });

  const sortOptions = NOTE_SORTS.filter((s) => s !== "opened" || view === "recent");

  return (
    <section
      aria-label={title}
      className={cn(
        "relative min-h-0 w-full shrink-0 flex-col border-line lg:w-[290px] lg:border-r",
        className,
      )}
    >
      <div className="flex flex-col gap-4 px-4 pt-5 md:px-8 lg:pr-4 lg:pl-8">
        <h1 className="text-preset-1 text-fg lg:hidden">{title}</h1>
        {search && <SearchInput autoFocus className="lg:hidden" />}
        <Button onClick={onCreate} loading={creating} className="hidden w-full lg:inline-flex">
          {!creating && <Plus className="size-4" aria-hidden />}
          {t("list.create")}
        </Button>
        {hint && <p className="text-preset-5 text-fg-3">{hint}</p>}
        <div className="flex items-center justify-between gap-2">
          <Menu
            align="start"
            label={t("list.sort")}
            trigger={(p) => (
              <button
                {...p}
                type="button"
                className="focus-ring -ml-1 flex cursor-pointer items-center gap-1.5 rounded-md px-1 py-1 text-preset-6 text-fg-4 hover:text-fg"
              >
                <ArrowDownWideNarrow className="size-4" aria-hidden />
                {t("list.sort")}: <span className="text-fg">{t(SORT_LABEL[sort])}</span>
              </button>
            )}
          >
            {sortOptions.map((s) => (
              <MenuItem
                key={s}
                checked={sort === s}
                onSelect={() => {
                  setParams({ sort: s }, { replace: true });
                  if (s !== "opened") void updateSettings({ preferences: { sort: s } });
                }}
              >
                {t(SORT_LABEL[s])}
              </MenuItem>
            ))}
          </Menu>
          {view === "trash" && !!items?.length && (
            <Button variant="ghost" size="sm" onClick={() => setConfirmEmpty(true)} className="text-red-500 hover:text-red-500">
              <Trash2 className="size-4" aria-hidden />
              {t("list.emptyTrash")}
            </Button>
          )}
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto px-4 pt-2 pb-24 md:px-8 lg:pr-4 lg:pb-5 lg:pl-8">
        {error ? (
          <EmptyState action={<Button variant="border" size="sm" onClick={onRetry}>{t("common.retry")}</Button>}>
            {t("list.error")}
          </EmptyState>
        ) : items === null ? (
          <ListSkeleton />
        ) : items.length === 0 ? (
          <EmptyState>
            {t(emptyKey)}
          </EmptyState>
        ) : (
          <>
            <ul className="flex flex-col">
              <AnimatePresence initial={false}>
                {items.map((n) => (
                  <NoteListItem key={n.id} note={n} active={n.id === activeId} href={hrefFor(n.id)} />
                ))}
              </AnimatePresence>
            </ul>
            {hasMore && (
              <Button variant="border" size="sm" className="mt-3 w-full" loading={loadingMore} onClick={onLoadMore}>
                {t("list.loadMore")}
              </Button>
            )}
          </>
        )}
      </div>

      {/* Mobile / tablet floating create button */}
      <motion.button
        type="button"
        onClick={onCreate}
        disabled={creating}
        aria-label={t("list.create")}
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.92 }}
        className="focus-ring fixed right-4 bottom-[72px] z-20 flex size-12 cursor-pointer items-center justify-center rounded-full bg-blue-500 text-white shadow-lg shadow-blue-500/30 md:right-8 md:bottom-[90px] md:size-16 lg:hidden"
      >
        <Plus className="size-6 md:size-8" />
      </motion.button>

      <ConfirmDialog
        open={confirmEmpty}
        onClose={() => setConfirmEmpty(false)}
        onConfirm={emptyTrash}
        loading={emptying}
        title={t("dialog.emptyTrashTitle")}
        description={t("dialog.emptyTrashBody")}
      />
    </section>
  );
}
