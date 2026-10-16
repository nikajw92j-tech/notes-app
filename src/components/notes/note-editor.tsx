"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { EditorContent, Extension, useEditor, type Editor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Underline from "@tiptap/extension-underline";
import Link from "@tiptap/extension-link";
import Highlight from "@tiptap/extension-highlight";
import TaskList from "@tiptap/extension-task-list";
import TaskItem from "@tiptap/extension-task-item";
import Table from "@tiptap/extension-table";
import TableRow from "@tiptap/extension-table-row";
import TableCell from "@tiptap/extension-table-cell";
import TableHeader from "@tiptap/extension-table-header";
import Placeholder from "@tiptap/extension-placeholder";
import Image from "@tiptap/extension-image";
import CharacterCount from "@tiptap/extension-character-count";
import {
  AlertCircle,
  Archive,
  ArchiveRestore,
  Check,
  ChevronLeft,
  Clock3,
  CloudOff,
  Copy,
  FileX2,
  Folder as FolderIcon,
  FolderInput,
  Loader2,
  MoreHorizontal,
  Pin,
  PinOff,
  RotateCcw,
  Star,
  Tag as TagIcon,
  Trash2,
  CircleDot,
} from "lucide-react";
import { toast } from "sonner";
import { SaveQueue, type SaveStatus } from "@/lib/autosave";
import { api, ApiClientError, errorMessage } from "@/lib/client/api";
import { useI18n } from "@/lib/i18n";
import type { Note, NoteSummary } from "@/lib/types";
import { cn } from "@/lib/cn";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/dialog";
import { Menu, MenuItem, MenuSeparator } from "@/components/ui/menu";
import { BlankState, Skeleton } from "@/components/ui/misc";
import { useWorkspace } from "@/components/app/workspace";
import { SAVE_EVENT } from "@/components/app/app-shell";
import { EditorToolbar, LinkDialog } from "@/components/notes/editor-toolbar";
import { TagInput } from "@/components/notes/tag-input";

type Patch = { title: string; content: string; tags: string[] };

const DRAFT_PREFIX = "note-draft:";
const KEEPALIVE_LIMIT = 60_000;

interface Draft {
  base: number;
  patch: Partial<Patch>;
  at: number;
}

function readDraft(id: string): Draft | null {
  try {
    const raw = localStorage.getItem(DRAFT_PREFIX + id);
    return raw ? (JSON.parse(raw) as Draft) : null;
  } catch {
    return null;
  }
}
function writeDraft(id: string, draft: Draft) {
  try {
    localStorage.setItem(DRAFT_PREFIX + id, JSON.stringify(draft));
  } catch {
    /* storage full or unavailable — server save still proceeds */
  }
}
function clearDraft(id: string) {
  try {
    localStorage.removeItem(DRAFT_PREFIX + id);
  } catch {
    /* ignore */
  }
}

export function toSummary(note: Note): NoteSummary {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { content, ...summary } = note;
  return summary;
}

/* ------------------------------------------------------------------ */

export function NoteEditor({
  id,
  onSummary,
  onClose,
  onOpenNote,
  autoFocusTitle,
}: {
  id: string;
  onSummary: (summary: NoteSummary) => void;
  onClose: () => void;
  onOpenNote: (id: string) => void;
  autoFocusTitle?: boolean;
}) {
  const { t } = useI18n();
  const [note, setNote] = useState<Note | null>(null);
  const [error, setError] = useState<"not_found" | "failed" | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      const n = await api<Note>(`/api/notes/${id}`);
      setNote(n);
      void api(`/api/notes/${id}/open`, { method: "POST" }).catch(() => undefined);
    } catch (err) {
      setError(err instanceof ApiClientError && err.status === 404 ? "not_found" : "failed");
    }
  }, [id]);

  useEffect(() => {
    void load();
  }, [load]);

  if (error) {
    return (
      <div className="flex flex-1 flex-col">
        <MobileBack onClose={onClose} />
        <BlankState icon={<FileX2 className="size-8" />} title={t("editor.loadError")}>
          {error === "failed" && (
            <Button variant="border" size="sm" className="mt-2" onClick={() => void load()}>
              {t("common.retry")}
            </Button>
          )}
        </BlankState>
      </div>
    );
  }

  if (!note) return <EditorSkeleton />;

  return (
    <EditorInner
      key={note.id}
      initial={note}
      onSummary={onSummary}
      onClose={onClose}
      onOpenNote={onOpenNote}
      autoFocusTitle={autoFocusTitle}
    />
  );
}

function EditorSkeleton() {
  return (
    <div className="flex min-w-0 flex-1" aria-busy="true">
      <div className="flex flex-1 flex-col gap-5 px-6 py-5">
        <Skeleton className="h-7 w-2/3" />
        <div className="flex flex-col gap-3">
          <Skeleton className="h-4 w-1/3" />
          <Skeleton className="h-4 w-1/4" />
        </div>
        <div className="h-px bg-line" />
        <div className="flex flex-col gap-2.5">
          {[100, 92, 96, 70, 85, 40].map((w, i) => (
            <div key={i} style={{ width: `${w}%` }}>
              <Skeleton className="h-3.5" />
            </div>
          ))}
        </div>
      </div>
      <div className="hidden w-[258px] flex-col gap-3 border-l border-line px-4 py-5 lg:flex">
        <Skeleton className="h-[41px]" />
        <Skeleton className="h-[41px]" />
      </div>
    </div>
  );
}

function MobileBack({ onClose, children }: { onClose: () => void; children?: React.ReactNode }) {
  const { t } = useI18n();
  return (
    <div className="flex items-center justify-between gap-2 border-b border-line px-4 py-3 md:px-8 lg:hidden">
      <button
        type="button"
        onClick={onClose}
        className="focus-ring -ml-1 flex cursor-pointer items-center gap-1 rounded px-1 text-preset-5 text-fg-3 hover:text-fg"
      >
        <ChevronLeft className="size-[18px]" />
        {t("editor.back")}
      </button>
      <div className="flex items-center gap-1">{children}</div>
    </div>
  );
}

/* ------------------------------------------------------------------ */

function SaveIndicator({ status }: { status: SaveStatus }) {
  const { t } = useI18n();
  const map: Record<SaveStatus, { icon: React.ReactNode; text: string; className: string }> = {
    idle: { icon: <Check className="size-3.5" />, text: t("save.idle"), className: "text-fg-5" },
    unsaved: { icon: <CircleDot className="size-3.5" />, text: t("save.unsaved"), className: "text-fg-4" },
    saving: { icon: <Loader2 className="size-3.5 animate-spin" />, text: t("save.saving"), className: "text-fg-4" },
    saved: { icon: <Check className="size-3.5" />, text: t("save.saved"), className: "text-green-500" },
    error: { icon: <AlertCircle className="size-3.5" />, text: t("save.error"), className: "text-red-500" },
    offline: { icon: <CloudOff className="size-3.5" />, text: t("save.offline"), className: "text-amber-500" },
    conflict: { icon: <AlertCircle className="size-3.5" />, text: t("save.conflict"), className: "text-red-500" },
  };
  const s = map[status];
  return (
    <span role="status" aria-live="polite" className={cn("flex items-center gap-1.5 text-preset-6", s.className)}>
      <AnimatePresence mode="wait" initial={false}>
        <motion.span
          key={status}
          initial={{ opacity: 0, y: 3 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -3 }}
          transition={{ duration: 0.15 }}
          className="flex items-center gap-1.5"
        >
          {s.icon}
          {s.text}
        </motion.span>
      </AnimatePresence>
    </span>
  );
}

function ActionButton({
  icon,
  children,
  onClick,
  danger,
  loading,
}: {
  icon: React.ReactNode;
  children: React.ReactNode;
  onClick: () => void;
  danger?: boolean;
  loading?: boolean;
}) {
  return (
    <Button
      variant="border"
      onClick={onClick}
      loading={loading}
      className={cn("w-full justify-start", danger && "hover:border-red-500/40")}
    >
      {!loading && <span className={cn("[&>svg]:size-5", danger ? "text-red-500" : "text-fg")}>{icon}</span>}
      {children}
    </Button>
  );
}

/* ------------------------------------------------------------------ */

function EditorInner({
  initial,
  onSummary,
  onClose,
  onOpenNote,
  autoFocusTitle,
}: {
  initial: Note;
  onSummary: (summary: NoteSummary) => void;
  onClose: () => void;
  onOpenNote: (id: string) => void;
  autoFocusTitle?: boolean;
}) {
  const { t, formatDate } = useI18n();
  const { folders, refreshTags, refreshFolders, invalidateNotes, onRemoteNoteChange } = useWorkspace();
  const id = initial.id;

  const [meta, setMeta] = useState<Note>(initial);
  const [title, setTitle] = useState(initial.title);
  const [tags, setTags] = useState(initial.tags.map((tg) => tg.name));
  const [status, setStatus] = useState<SaveStatus>("idle");
  const [conflict, setConflict] = useState<Note | null>(null);
  const [linkOpen, setLinkOpen] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [confirmPurge, setConfirmPurge] = useState(false);
  const titleRef = useRef<HTMLTextAreaElement>(null);
  const editorRef = useRef<Editor | null>(null);
  const unsaved = useRef<Partial<Patch>>({});
  const backupTimer = useRef<ReturnType<typeof setTimeout>>(undefined);

  const readOnly = !!meta.deleted_at;

  const cb = useRef({ onSummary, refreshTags });
  cb.current = { onSummary, refreshTags };

  const applyServer = useCallback(
    (n: Note) => {
      setMeta(n);
      cb.current.onSummary(toSummary(n));
    },
    [],
  );

  const [saver] = useState(
    () =>
      new SaveQueue<Patch>(
        async (patch, expectedVersion) => {
          const body = JSON.stringify({ ...patch, expected_version: expectedVersion });
          const n = await api<Note>(`/api/notes/${id}`, {
            method: "PATCH",
            body,
            headers: { "Content-Type": "application/json" },
            keepalive: body.length < KEEPALIVE_LIMIT,
          });
          applyServer(n);
          if (patch.tags) void cb.current.refreshTags();
          return { version: n.version };
        },
        initial.version,
        {
          debounceMs: 800,
          onStatus: (s) => {
            setStatus(s);
            if (s === "saved") {
              unsaved.current = {};
              clearTimeout(backupTimer.current);
              clearDraft(id);
            }
          },
          isConflict: (e) => e instanceof ApiClientError && e.code === "version_conflict",
          isFatal: (e) => e instanceof ApiClientError && [400, 404, 409, 413].includes(e.status),
          isOffline: () => typeof navigator !== "undefined" && !navigator.onLine,
          onConflict: (e) => {
            const current = ((e as ApiClientError).details as { current?: Note } | undefined)?.current;
            if (current) setConflict(current);
          },
          onSaved: () => {
            // keep the local backup's base version in step with the server
            if (Object.keys(unsaved.current).length) writeDraft(id, { base: saver.version, patch: unsaved.current, at: Date.now() });
          },
        },
      ),
  );

  const queue = useCallback(
    (patch: Partial<Patch>) => {
      if (readOnly) return;
      unsaved.current = { ...unsaved.current, ...patch };
      saver.update(patch);
      clearTimeout(backupTimer.current);
      backupTimer.current = setTimeout(
        () => writeDraft(id, { base: saver.version, patch: unsaved.current, at: Date.now() }),
        300,
      );
    },
    [id, readOnly, saver],
  );

  /* ---------- TipTap ---------- */
  const openLinkRef = useRef(() => setLinkOpen(true));

  const uploadImage = useCallback(
    async (file: File) => {
      const editor = editorRef.current;
      if (!editor) return;
      setUploading(true);
      const toastId = toast.loading(t("tb.uploading"));
      try {
        const form = new FormData();
        form.append("file", file);
        const { src } = await api<{ src: string }>("/api/uploads", { method: "POST", body: form });
        editor.chain().focus().setImage({ src, alt: file.name.replace(/\.[^.]+$/, "") }).run();
        toast.dismiss(toastId);
      } catch (err) {
        toast.error(errorMessage(err, t("tb.uploadFailed")), { id: toastId });
      } finally {
        setUploading(false);
      }
    },
    [t],
  );

  const extensions = useMemo(
    () => [
      StarterKit.configure({ heading: { levels: [1, 2, 3] } }),
      Underline,
      Link.configure({
        openOnClick: false,
        autolink: true,
        linkOnPaste: true,
        protocols: ["http", "https", "mailto"],
        HTMLAttributes: { rel: "noopener noreferrer nofollow", target: "_blank" },
        validate: (href: string) => /^(https?:|mailto:)/i.test(href),
      }),
      Highlight,
      TaskList,
      TaskItem.configure({ nested: true }),
      Table.configure({ resizable: true }),
      TableRow,
      TableHeader,
      TableCell,
      Image.configure({ inline: false, allowBase64: false }),
      Placeholder.configure({ placeholder: t("editor.bodyPlaceholder") }),
      CharacterCount,
      Extension.create({
        name: "appShortcuts",
        addKeyboardShortcuts() {
          return {
            "Mod-Shift-l": () => {
              openLinkRef.current();
              return true;
            },
          };
        },
      }),
    ],
    // placeholder text follows the language at mount time
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

  const editor = useEditor({
    extensions,
    content: initial.content,
    editable: !initial.deleted_at,
    immediatelyRender: false,
    editorProps: {
      attributes: {
        class: "prose-note min-h-[280px] pb-10",
        "aria-label": t("editor.bodyLabel"),
        role: "textbox",
        "aria-multiline": "true",
      },
      handlePaste: (_view, event) => {
        const files = Array.from(event.clipboardData?.files ?? []).filter((f) => f.type.startsWith("image/"));
        if (!files.length) return false;
        files.forEach((f) => void uploadImage(f));
        return true;
      },
      handleDrop: (_view, event) => {
        const files = Array.from((event as DragEvent).dataTransfer?.files ?? []).filter((f) =>
          f.type.startsWith("image/"),
        );
        if (!files.length) return false;
        event.preventDefault();
        files.forEach((f) => void uploadImage(f));
        return true;
      },
    },
    onUpdate: ({ editor: e }) => queue({ content: e.getHTML() }),
  });
  editorRef.current = editor;

  useEffect(() => {
    editor?.setEditable(!readOnly);
  }, [editor, readOnly]);

  /* ---------- recover a local draft left by a crash / closed tab ---------- */
  const recovered = useRef(false);
  useEffect(() => {
    if (!editor || recovered.current) return;
    recovered.current = true;
    const draft = readDraft(id);
    if (!draft) return;
    if (draft.base !== initial.version || initial.deleted_at) {
      clearDraft(id);
      return;
    }
    const { patch } = draft;
    if (patch.title !== undefined) setTitle(patch.title);
    if (patch.tags) setTags(patch.tags);
    if (patch.content !== undefined) editor.commands.setContent(patch.content, false);
    queue(patch);
    toast.info(t("editor.recovered"));
  }, [editor, id, initial.deleted_at, initial.version, queue, t]);

  /* ---------- lifecycle: flush on hide/unmount, warn before unload ---------- */
  useEffect(() => {
    const onHide = () => {
      if (document.visibilityState === "hidden") void saver.flush();
    };
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      if (saver.hasUnsavedChanges) {
        void saver.flush();
        e.preventDefault();
      }
    };
    const onOnline = () => saver.retry();
    const onSaveNow = () => {
      void saver.flush().then(() => {
        if (saver.status === "saved" || saver.status === "idle") toast.success(t("toast.saved"));
      });
    };
    document.addEventListener("visibilitychange", onHide);
    window.addEventListener("beforeunload", onBeforeUnload);
    window.addEventListener("online", onOnline);
    window.addEventListener(SAVE_EVENT, onSaveNow);
    return () => {
      document.removeEventListener("visibilitychange", onHide);
      window.removeEventListener("beforeunload", onBeforeUnload);
      window.removeEventListener("online", onOnline);
      window.removeEventListener(SAVE_EVENT, onSaveNow);
    };
  }, [saver, t]);

  useEffect(() => () => void saver.flush(), [saver]);

  /* ---------- realtime: pick up edits made on another device ---------- */
  useEffect(
    () =>
      onRemoteNoteChange(async (change) => {
        if (change.id !== id) return;
        if (change.deleted) {
          onClose();
          return;
        }
        if (change.version <= saver.version || saver.hasUnsavedChanges) return;
        try {
          const fresh = await api<Note>(`/api/notes/${id}`);
          if (saver.hasUnsavedChanges || fresh.version <= saver.version) return;
          saver.reset(fresh.version);
          setTitle(fresh.title);
          setTags(fresh.tags.map((tg) => tg.name));
          editorRef.current?.commands.setContent(fresh.content, false);
          applyServer(fresh);
        } catch {
          /* next change event or save will reconcile */
        }
      }),
    [applyServer, id, onClose, onRemoteNoteChange, saver],
  );

  /* ---------- focus title on freshly created notes ---------- */
  useEffect(() => {
    if (autoFocusTitle) titleRef.current?.focus();
  }, [autoFocusTitle]);

  // auto-size title textarea
  useEffect(() => {
    const el = titleRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${el.scrollHeight}px`;
  }, [title]);

  /* ---------- conflict resolution ---------- */
  const loadLatest = () => {
    if (!conflict) return;
    saver.reset(conflict.version);
    unsaved.current = {};
    clearDraft(id);
    setTitle(conflict.title);
    setTags(conflict.tags.map((tg) => tg.name));
    editorRef.current?.commands.setContent(conflict.content, false);
    applyServer(conflict);
    setConflict(null);
  };
  const keepMine = () => {
    if (!conflict) return;
    saver.version = conflict.version;
    setConflict(null);
    saver.retry();
  };

  /* ---------- note actions ---------- */
  const run = async (key: string, fn: () => Promise<void>) => {
    setBusy(key);
    try {
      await saver.flush();
      await fn();
    } catch (err) {
      toast.error(errorMessage(err, t("toast.error")));
    } finally {
      setBusy(null);
    }
  };

  const patchFlags = (body: Partial<Pick<Note, "is_pinned" | "is_favorite" | "is_archived" | "folder_id">>) =>
    api<Note>(`/api/notes/${id}`, { method: "PATCH", json: body }).then((n) => {
      applyServer(n);
      invalidateNotes();
      return n;
    });

  const togglePin = () =>
    run("pin", async () => {
      await patchFlags({ is_pinned: !meta.is_pinned });
      toast.success(t(meta.is_pinned ? "toast.unpinned" : "toast.pinned"));
    });

  const toggleFavorite = () =>
    run("favorite", async () => {
      await patchFlags({ is_favorite: !meta.is_favorite });
      toast.success(t(meta.is_favorite ? "toast.unfavorited" : "toast.favorited"));
    });

  const toggleArchive = () =>
    run("archive", async () => {
      const archiving = !meta.is_archived;
      await patchFlags({ is_archived: archiving });
      toast.success(t(archiving ? "toast.archived" : "toast.unarchived"), {
        action: {
          label: t("toast.undo"),
          onClick: () => void patchFlags({ is_archived: !archiving }).catch(() => toast.error(t("toast.error"))),
        },
      });
    });

  const moveTo = (folderId: string | null) =>
    run("move", async () => {
      await patchFlags({ folder_id: folderId });
      void refreshFolders();
      const name = folders?.find((f) => f.id === folderId)?.name;
      toast.success(name ? t("toast.moved", { folder: name }) : t("toast.unfiled"));
    });

  const duplicate = () =>
    run("duplicate", async () => {
      const copy = await api<Note>(`/api/notes/${id}/duplicate`, { method: "POST" });
      invalidateNotes();
      void refreshFolders();
      toast.success(t("toast.duplicated"));
      onOpenNote(copy.id);
    });

  const restore = async () => {
    const n = await api<Note>(`/api/notes/${id}/restore`, { method: "POST" });
    applyServer(n);
    invalidateNotes();
    void refreshFolders();
  };

  const moveToTrash = () =>
    run("trash", async () => {
      const n = await api<Note>(`/api/notes/${id}`, { method: "DELETE" });
      applyServer(n);
      invalidateNotes();
      void refreshFolders();
      toast.success(t("toast.trashed"), {
        action: { label: t("toast.undo"), onClick: () => void restore().catch(() => toast.error(t("toast.error"))) },
      });
    });

  const restoreFromTrash = () =>
    run("restore", async () => {
      await restore();
      toast.success(t("toast.restored"));
    });

  const purge = () =>
    run("purge", async () => {
      await api(`/api/notes/${id}/permanent`, { method: "DELETE" });
      saver.dispose();
      clearDraft(id);
      setConfirmPurge(false);
      invalidateNotes();
      void refreshTags();
      toast.success(t("toast.deleted"));
      onClose();
    });

  const saveNow = () =>
    run("save", async () => {
      await saver.flush();
      if (saver.status === "saved" || saver.status === "idle") toast.success(t("toast.saved"));
    });

  /* ---------- render ---------- */
  const words = editor?.storage.characterCount?.words?.() ?? 0;
  const chars = editor?.storage.characterCount?.characters?.() ?? 0;
  const folder = meta.folder_id ? folders?.find((f) => f.id === meta.folder_id) : undefined;

  const folderMenu = (
    <Menu
      align="start"
      label={t("action.move")}
      trigger={(p) => (
        <button
          {...p}
          type="button"
          disabled={readOnly}
          className="focus-ring -ml-1 flex cursor-pointer items-center gap-2 rounded px-1 py-1 text-preset-5 text-fg hover:bg-hover disabled:cursor-default disabled:hover:bg-transparent"
        >
          {folder ? (
            <>
              <span className="size-2.5 rounded-full" style={{ backgroundColor: folder.color }} aria-hidden />
              {folder.name}
            </>
          ) : (
            <span className="text-fg-5">{t("editor.noFolder")}</span>
          )}
        </button>
      )}
    >
      <MenuItem checked={!meta.folder_id} onSelect={() => meta.folder_id && moveTo(null)}>
        {t("editor.noFolder")}
      </MenuItem>
      {folders?.map((f) => (
        <MenuItem
          key={f.id}
          checked={meta.folder_id === f.id}
          onSelect={() => meta.folder_id !== f.id && moveTo(f.id)}
          icon={<span className="size-2.5 rounded-full" style={{ backgroundColor: f.color }} />}
        >
          {f.name}
        </MenuItem>
      ))}
    </Menu>
  );

  const actionsColumn = readOnly ? (
    <>
      <ActionButton icon={<RotateCcw />} onClick={restoreFromTrash} loading={busy === "restore"}>
        {t("action.restore")}
      </ActionButton>
      <ActionButton icon={<Trash2 />} danger onClick={() => setConfirmPurge(true)}>
        {t("action.deleteForever")}
      </ActionButton>
    </>
  ) : (
    <>
      <ActionButton icon={meta.is_pinned ? <PinOff /> : <Pin />} onClick={togglePin} loading={busy === "pin"}>
        {t(meta.is_pinned ? "action.unpin" : "action.pin")}
      </ActionButton>
      <ActionButton
        icon={<Star className={meta.is_favorite ? "fill-amber-400 text-amber-400" : ""} />}
        onClick={toggleFavorite}
        loading={busy === "favorite"}
      >
        {t(meta.is_favorite ? "action.unfavorite" : "action.favorite")}
      </ActionButton>
      <ActionButton icon={<Copy />} onClick={duplicate} loading={busy === "duplicate"}>
        {t("action.duplicate")}
      </ActionButton>
      <ActionButton
        icon={meta.is_archived ? <ArchiveRestore /> : <Archive />}
        onClick={toggleArchive}
        loading={busy === "archive"}
      >
        {t(meta.is_archived ? "action.unarchive" : "action.archive")}
      </ActionButton>
      <ActionButton icon={<Trash2 />} onClick={moveToTrash} loading={busy === "trash"}>
        {t("action.delete")}
      </ActionButton>
    </>
  );

  const mobileActions = (
    <>
      {readOnly ? (
        <>
          <IconAction label={t("action.restore")} onClick={restoreFromTrash}>
            <RotateCcw />
          </IconAction>
          <IconAction label={t("action.deleteForever")} onClick={() => setConfirmPurge(true)} danger>
            <Trash2 />
          </IconAction>
        </>
      ) : (
        <>
          <IconAction label={t("action.delete")} onClick={moveToTrash}>
            <Trash2 />
          </IconAction>
          <IconAction label={t(meta.is_archived ? "action.unarchive" : "action.archive")} onClick={toggleArchive}>
            {meta.is_archived ? <ArchiveRestore /> : <Archive />}
          </IconAction>
          <Menu
            label={t("action.more")}
            trigger={(p) => (
              <button
                {...p}
                type="button"
                aria-label={t("action.more")}
                className="focus-ring flex size-9 cursor-pointer items-center justify-center rounded-lg text-fg-3 hover:bg-hover"
              >
                <MoreHorizontal className="size-[18px]" />
              </button>
            )}
          >
            <MenuItem icon={meta.is_pinned ? <PinOff /> : <Pin />} onSelect={togglePin}>
              {t(meta.is_pinned ? "action.unpin" : "action.pin")}
            </MenuItem>
            <MenuItem icon={<Star />} onSelect={toggleFavorite}>
              {t(meta.is_favorite ? "action.unfavorite" : "action.favorite")}
            </MenuItem>
            <MenuItem icon={<Copy />} onSelect={duplicate}>
              {t("action.duplicate")}
            </MenuItem>
            <MenuSeparator />
            <MenuItem icon={<FolderInput />} checked={!meta.folder_id} onSelect={() => meta.folder_id && moveTo(null)}>
              {t("editor.noFolder")}
            </MenuItem>
            {folders?.map((f) => (
              <MenuItem
                key={f.id}
                checked={meta.folder_id === f.id}
                icon={<span className="size-2.5 rounded-full" style={{ backgroundColor: f.color }} />}
                onSelect={() => meta.folder_id !== f.id && moveTo(f.id)}
              >
                {f.name}
              </MenuItem>
            ))}
          </Menu>
          <button
            type="button"
            onClick={saveNow}
            className="focus-ring ml-1 cursor-pointer rounded px-1 text-preset-5 text-blue-500"
          >
            {t("editor.save")}
          </button>
        </>
      )}
    </>
  );

  return (
    <div className="flex min-w-0 flex-1">
      <div className="flex min-w-0 flex-1 flex-col">
        <MobileBack onClose={onClose}>{mobileActions}</MobileBack>

        <AnimatePresence initial={false}>
          {(readOnly || conflict) && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="overflow-hidden"
            >
              <div
                role="alert"
                className={cn(
                  "flex flex-wrap items-center gap-3 border-b px-6 py-2.5 text-preset-5",
                  conflict ? "border-red-500/30 bg-red-100 text-neutral-950 dark:bg-red-500/15 dark:text-neutral-0" : "border-line bg-muted text-fg-3",
                )}
              >
                <AlertCircle className="size-4 shrink-0" aria-hidden />
                <span className="flex-1">{conflict ? t("editor.conflict") : t("editor.inTrash")}</span>
                {conflict ? (
                  <span className="flex gap-2">
                    <Button size="sm" variant="border" onClick={loadLatest}>
                      {t("editor.conflictReload")}
                    </Button>
                    <Button size="sm" onClick={keepMine}>
                      {t("editor.conflictOverwrite")}
                    </Button>
                  </span>
                ) : (
                  <Button size="sm" variant="border" onClick={restoreFromTrash} loading={busy === "restore"}>
                    {t("action.restore")}
                  </Button>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        <div className="min-h-0 flex-1 overflow-y-auto px-4 pt-5 md:px-8 lg:px-6">
          <textarea
            ref={titleRef}
            value={title}
            rows={1}
            readOnly={readOnly}
            maxLength={200}
            aria-label={t("editor.titleLabel")}
            placeholder={t("editor.titlePlaceholder")}
            onChange={(e) => {
              const v = e.target.value.replace(/\n/g, " ");
              setTitle(v);
              queue({ title: v });
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                editor?.commands.focus("start");
              }
            }}
            className="w-full resize-none overflow-hidden bg-transparent text-preset-1 text-fg placeholder:text-fg-5 focus:outline-none"
          />

          <dl className="mt-3 grid grid-cols-[minmax(96px,115px)_1fr] items-center gap-x-2 gap-y-1 text-preset-5">
            <dt className="flex items-center gap-1.5 py-1 text-fg-3">
              <TagIcon className="size-4" aria-hidden />
              {t("editor.tags")}
            </dt>
            <dd>
              <TagInput
                value={tags}
                disabled={readOnly}
                onChange={(next) => {
                  setTags(next);
                  queue({ tags: next });
                }}
              />
            </dd>
            <dt className="flex items-center gap-1.5 py-1 text-fg-3">
              <FolderIcon className="size-4" aria-hidden />
              {t("editor.folder")}
            </dt>
            <dd>{folderMenu}</dd>
            {meta.is_archived && (
              <>
                <dt className="flex items-center gap-1.5 py-1 text-fg-3">
                  <Loader2 className="size-4" aria-hidden />
                  {t("editor.status")}
                </dt>
                <dd className="py-1 text-fg">{t("nav.archived")}</dd>
              </>
            )}
            <dt className="flex items-center gap-1.5 py-1 text-fg-3">
              <Clock3 className="size-4" aria-hidden />
              {t("editor.lastEdited")}
            </dt>
            <dd className="py-1 text-fg">
              <time dateTime={meta.updated_at}>{formatDate(meta.updated_at, true)}</time>
            </dd>
          </dl>

          <div className="mt-3 mb-1 h-px bg-line" />

          {!readOnly && (
            <EditorToolbar editor={editor} onLink={() => setLinkOpen(true)} onImage={uploadImage} uploading={uploading} />
          )}
          <div className="pt-4" onClick={() => !readOnly && editor && !editor.isFocused && editor.commands.focus("end")}>
            <EditorContent editor={editor} />
          </div>
        </div>

        <footer className="flex flex-wrap items-center justify-between gap-3 border-t border-line px-4 py-3 md:px-8 lg:px-6 lg:py-4">
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-preset-6 text-fg-4">
            <span>{t("editor.words", { n: words })}</span>
            <span>{t("editor.chars", { n: chars })}</span>
            {!readOnly && <SaveIndicator status={status} />}
          </div>
          {!readOnly && (
            <Button onClick={saveNow} loading={busy === "save"} className="hidden lg:inline-flex">
              {t("editor.save")}
            </Button>
          )}
        </footer>
      </div>

      <aside
        aria-label={t("action.more")}
        className="hidden w-[258px] shrink-0 flex-col gap-3 border-l border-line px-4 py-5 lg:flex"
      >
        {actionsColumn}
      </aside>

      <LinkDialog editor={editor} open={linkOpen} onClose={() => setLinkOpen(false)} />
      <ConfirmDialog
        open={confirmPurge}
        onClose={() => setConfirmPurge(false)}
        onConfirm={purge}
        loading={busy === "purge"}
        title={t("dialog.deleteNoteTitle")}
        description={t("dialog.deleteNoteBody")}
      />
    </div>
  );
}

function IconAction({
  label,
  onClick,
  children,
  danger,
}: {
  label: string;
  onClick: () => void;
  children: React.ReactNode;
  danger?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      title={label}
      className={cn(
        "focus-ring flex size-9 cursor-pointer items-center justify-center rounded-lg hover:bg-hover [&>svg]:size-[18px]",
        danger ? "text-red-500" : "text-fg-3",
      )}
    >
      {children}
    </button>
  );
}
