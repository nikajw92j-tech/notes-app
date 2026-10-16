"use client";

import Link from "next/link";
import { useState } from "react";
import { motion } from "framer-motion";
import {
  Archive,
  ChevronRight,
  Clock3,
  FolderPlus,
  House,
  MoreHorizontal,
  Pencil,
  Star,
  Tag as TagIcon,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";
import { Logo } from "@/components/ui/logo";
import { Menu, MenuItem } from "@/components/ui/menu";
import { ConfirmDialog } from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/misc";
import { FolderDialog } from "@/components/app/folder-dialog";
import { useWorkspace } from "@/components/app/workspace";
import { notesHref, useNoteParams } from "@/components/notes/use-note-params";
import { api, errorMessage } from "@/lib/client/api";
import { useI18n, type MessageKey } from "@/lib/i18n";
import type { Folder, NoteView } from "@/lib/types";
import { cn } from "@/lib/cn";

const VIEWS: { view: NoteView; label: MessageKey; icon: typeof House }[] = [
  { view: "all", label: "nav.allNotes", icon: House },
  { view: "favorites", label: "nav.favorites", icon: Star },
  { view: "recent", label: "nav.recent", icon: Clock3 },
  { view: "archived", label: "nav.archived", icon: Archive },
  { view: "trash", label: "nav.trash", icon: Trash2 },
];

function NavItem({
  href,
  active,
  icon,
  children,
  count,
  onNavigate,
  trailing,
  layoutGroup,
}: {
  href: string;
  active: boolean;
  icon: React.ReactNode;
  children: React.ReactNode;
  count?: number;
  onNavigate?: () => void;
  trailing?: React.ReactNode;
  layoutGroup: string;
}) {
  return (
    <li className="group relative">
      <Link
        href={href}
        onClick={onNavigate}
        aria-current={active ? "page" : undefined}
        className={cn(
          "focus-ring relative flex h-10 items-center gap-2 rounded-lg px-3 text-preset-4 transition-colors",
          active ? "text-fg" : "text-fg-3 hover:bg-hover hover:text-fg",
        )}
      >
        {active && (
          <motion.span
            layoutId={`${layoutGroup}-active`}
            className="absolute inset-0 rounded-lg bg-muted"
            transition={{ type: "spring", stiffness: 500, damping: 40 }}
          />
        )}
        <span
          className={cn(
            "relative flex size-5 shrink-0 items-center justify-center [&>svg]:size-5",
            active ? "text-blue-500" : "text-fg-3",
          )}
        >
          {icon}
        </span>
        <span className="relative min-w-0 flex-1 truncate">{children}</span>
        {count !== undefined && count > 0 && !active && (
          <span className="relative text-preset-6 text-fg-5 group-hover:opacity-0">{count}</span>
        )}
        {active && <ChevronRight className="relative size-5 text-fg" aria-hidden />}
      </Link>
      {trailing}
    </li>
  );
}

export function Sidebar({ onNavigate, layoutGroup = "sidebar" }: { onNavigate?: () => void; layoutGroup?: string }) {
  const { t } = useI18n();
  const { folders, tags, refreshFolders, invalidateNotes } = useWorkspace();
  const { view, folder, tag, isNotesPage, setParams } = useNoteParams();
  const [dialog, setDialog] = useState<{ open: boolean; folder: Folder | null }>({ open: false, folder: null });
  const [toDelete, setToDelete] = useState<Folder | null>(null);
  const [deleting, setDeleting] = useState(false);

  const deleteFolder = async () => {
    if (!toDelete) return;
    setDeleting(true);
    try {
      await api(`/api/folders/${toDelete.id}`, { method: "DELETE" });
      toast.success(t("toast.folderDeleted"));
      if (folder === toDelete.id) setParams({ folder: null, note: null });
      await refreshFolders();
      invalidateNotes();
      setToDelete(null);
    } catch (err) {
      toast.error(errorMessage(err, t("toast.error")));
    } finally {
      setDeleting(false);
    }
  };

  return (
    <nav aria-label="Primary" className="flex h-full w-full flex-col gap-4 overflow-y-auto px-4 py-3">
      <Link href="/notes" onClick={onNavigate} className="focus-ring hidden rounded py-3 lg:block" aria-label={t("app.name")}>
        <Logo />
      </Link>

      <ul className="flex flex-col gap-1">
        {VIEWS.map(({ view: v, label, icon: Icon }) => (
          <NavItem
            key={v}
            layoutGroup={layoutGroup}
            href={notesHref({ view: v === "all" ? null : v })}
            active={isNotesPage && view === v && !folder && !tag}
            icon={<Icon />}
            onNavigate={onNavigate}
          >
            {t(label)}
          </NavItem>
        ))}
      </ul>

      <div className="h-px bg-line" />

      <section aria-labelledby="folders-heading" className="flex flex-col gap-2">
        <div className="flex items-center justify-between px-2">
          <h2 id="folders-heading" className="text-preset-4 text-fg-5">
            {t("nav.folders")}
          </h2>
          <button
            type="button"
            onClick={() => setDialog({ open: true, folder: null })}
            className="focus-ring flex size-7 cursor-pointer items-center justify-center rounded-md text-fg-5 transition-colors hover:bg-hover hover:text-fg"
            aria-label={t("nav.newFolder")}
            title={t("nav.newFolder")}
          >
            <FolderPlus className="size-4" />
          </button>
        </div>
        {folders === null ? (
          <div className="flex flex-col gap-2 px-3">
            <Skeleton className="h-5 w-3/4" />
            <Skeleton className="h-5 w-1/2" />
          </div>
        ) : folders.length === 0 ? (
          <p className="px-3 text-preset-6 text-fg-5">{t("nav.noFolders")}</p>
        ) : (
          <ul className="flex flex-col gap-1">
            {folders.map((f) => (
              <NavItem
                key={f.id}
                layoutGroup={layoutGroup}
                href={notesHref({ folder: f.id })}
                active={isNotesPage && folder === f.id}
                count={f.note_count}
                onNavigate={onNavigate}
                icon={<span className="size-3 rounded-full" style={{ backgroundColor: f.color }} />}
                trailing={
                  <div className="absolute top-1/2 right-1 -translate-y-1/2 opacity-0 transition-opacity group-focus-within:opacity-100 group-hover:opacity-100 has-[[aria-expanded=true]]:opacity-100">
                    <Menu
                      label={t("nav.folderActions")}
                      trigger={(p) => (
                        <button
                          {...p}
                          type="button"
                          aria-label={`${t("nav.folderActions")}: ${f.name}`}
                          className="focus-ring flex size-7 cursor-pointer items-center justify-center rounded-md bg-bg text-fg-4 hover:text-fg"
                        >
                          <MoreHorizontal className="size-4" />
                        </button>
                      )}
                    >
                      <MenuItem icon={<Pencil />} onSelect={() => setDialog({ open: true, folder: f })}>
                        {t("dialog.edit")}
                      </MenuItem>
                      <MenuItem icon={<Trash2 />} danger onSelect={() => setToDelete(f)}>
                        {t("dialog.delete")}
                      </MenuItem>
                    </Menu>
                  </div>
                }
              >
                {f.name}
              </NavItem>
            ))}
          </ul>
        )}
      </section>

      <div className="h-px bg-line" />

      <section aria-labelledby="tags-heading" className="flex flex-col gap-2 pb-4">
        <h2 id="tags-heading" className="px-2 text-preset-4 text-fg-5">
          {t("nav.tags")}
        </h2>
        {tags === null ? (
          <div className="flex flex-col gap-2 px-3">
            <Skeleton className="h-5 w-2/3" />
            <Skeleton className="h-5 w-1/3" />
          </div>
        ) : tags.length === 0 ? (
          <p className="px-3 text-preset-6 text-fg-5">{t("nav.noTags")}</p>
        ) : (
          <ul className="flex flex-col gap-1">
            {tags.map((tg) => (
              <NavItem
                key={tg.id}
                layoutGroup={layoutGroup}
                href={notesHref({ tag: tg.id })}
                active={isNotesPage && tag === tg.id}
                count={tg.note_count}
                onNavigate={onNavigate}
                icon={<TagIcon />}
              >
                {tg.name}
              </NavItem>
            ))}
          </ul>
        )}
      </section>

      <FolderDialog
        open={dialog.open}
        folder={dialog.folder}
        onClose={() => setDialog({ open: false, folder: null })}
        onSaved={() => void refreshFolders()}
      />
      <ConfirmDialog
        open={!!toDelete}
        onClose={() => setToDelete(null)}
        onConfirm={deleteFolder}
        loading={deleting}
        title={t("dialog.deleteFolderTitle")}
        description={t("dialog.deleteFolderBody", { name: toDelete?.name ?? "" })}
      />
    </nav>
  );
}
