"use client";

import { useEffect, useRef, useState } from "react";
import type { Editor } from "@tiptap/react";
import {
  Bold,
  Code2,
  Heading1,
  Heading2,
  Heading3,
  Highlighter,
  ImagePlus,
  Italic,
  Link2,
  List,
  ListChecks,
  ListOrdered,
  Loader2,
  Quote,
  Redo2,
  Table as TableIcon,
  Underline as UnderlineIcon,
  Undo2,
  Rows3,
  Columns3,
  Trash2,
  Unlink,
} from "lucide-react";
import { Dialog } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { inputClass } from "@/components/ui/input";
import { useI18n, type MessageKey } from "@/lib/i18n";
import { cn } from "@/lib/cn";

function useEditorRerender(editor: Editor | null) {
  const [, force] = useState(0);
  useEffect(() => {
    if (!editor) return;
    const update = () => force((n) => n + 1);
    editor.on("selectionUpdate", update);
    editor.on("transaction", update);
    return () => {
      editor.off("selectionUpdate", update);
      editor.off("transaction", update);
    };
  }, [editor]);
}

function ToolButton({
  label,
  shortcut,
  active,
  disabled,
  onClick,
  children,
}: {
  label: string;
  shortcut?: string;
  active?: boolean;
  disabled?: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onMouseDown={(e) => e.preventDefault()}
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      aria-pressed={active ?? undefined}
      title={shortcut ? `${label} (${shortcut})` : label}
      className={cn(
        "focus-ring flex size-8 shrink-0 cursor-pointer items-center justify-center rounded-md transition-colors disabled:cursor-not-allowed disabled:opacity-40 [&>svg]:size-4",
        active ? "bg-blue-50 text-blue-500 dark:bg-blue-500/20" : "text-fg-4 hover:bg-hover hover:text-fg",
      )}
    >
      {children}
    </button>
  );
}

const Divider = () => <span className="mx-1 h-5 w-px shrink-0 bg-line" aria-hidden />;

export function isSafeHref(url: string) {
  try {
    const parsed = new URL(url);
    return ["http:", "https:", "mailto:"].includes(parsed.protocol);
  } catch {
    return false;
  }
}

export function LinkDialog({
  editor,
  open,
  onClose,
}: {
  editor: Editor | null;
  open: boolean;
  onClose: () => void;
}) {
  const { t } = useI18n();
  const [url, setUrl] = useState("");
  const [error, setError] = useState(false);

  useEffect(() => {
    if (open && editor) {
      setUrl((editor.getAttributes("link").href as string | undefined) ?? "");
      setError(false);
    }
  }, [open, editor]);

  const apply = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editor) return;
    let href = url.trim();
    if (href && !/^[a-z]+:/i.test(href)) href = `https://${href}`;
    if (!href || !isSafeHref(href)) {
      setError(true);
      return;
    }
    const chain = editor.chain().focus().extendMarkRange("link");
    if (editor.state.selection.empty && !editor.isActive("link")) {
      chain.insertContent({ type: "text", text: href, marks: [{ type: "link", attrs: { href } }] }).run();
    } else {
      chain.setLink({ href }).run();
    }
    onClose();
  };

  return (
    <Dialog open={open} onClose={onClose} title={t("tb.linkTitle")} icon={<Link2 className="size-6" />}>
      <form onSubmit={apply} className="flex flex-col gap-3">
        <label htmlFor="link-url" className="text-preset-4 text-fg">
          {t("tb.linkUrl")}
        </label>
        <input
          id="link-url"
          data-autofocus
          className={inputClass}
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder="https://"
          aria-invalid={error || undefined}
          inputMode="url"
        />
        {error && <p className="text-preset-6 text-red-500">{t("tb.linkInvalid")}</p>}
        <div className="mt-2 flex justify-between gap-3">
          {editor?.isActive("link") ? (
            <Button
              variant="ghost"
              onClick={() => {
                editor.chain().focus().extendMarkRange("link").unsetLink().run();
                onClose();
              }}
            >
              <Unlink className="size-4" />
              {t("tb.removeLink")}
            </Button>
          ) : (
            <span />
          )}
          <div className="flex gap-3">
            <Button variant="secondary" onClick={onClose}>
              {t("dialog.cancel")}
            </Button>
            <Button type="submit">{t("tb.apply")}</Button>
          </div>
        </div>
      </form>
    </Dialog>
  );
}

export function EditorToolbar({
  editor,
  onLink,
  onImage,
  uploading,
}: {
  editor: Editor | null;
  onLink: () => void;
  onImage: (file: File) => void;
  uploading: boolean;
}) {
  const { t } = useI18n();
  const fileRef = useRef<HTMLInputElement>(null);
  useEditorRerender(editor);
  if (!editor) return <div className="h-10" />;

  const L = (k: MessageKey) => t(k);
  const c = () => editor.chain().focus();
  const inTable = editor.isActive("table");

  return (
    <div
      role="toolbar"
      aria-label={L("tb.toolbar")}
      className="sticky top-0 z-10 -mx-1 flex items-center gap-0.5 overflow-x-auto border-b border-line bg-bg/95 px-1 py-1.5 backdrop-blur"
    >
      <ToolButton label={L("tb.undo")} shortcut="Ctrl+Z" disabled={!editor.can().undo()} onClick={() => c().undo().run()}>
        <Undo2 />
      </ToolButton>
      <ToolButton label={L("tb.redo")} shortcut="Ctrl+Shift+Z" disabled={!editor.can().redo()} onClick={() => c().redo().run()}>
        <Redo2 />
      </ToolButton>
      <Divider />
      <ToolButton label={L("tb.h1")} shortcut="Ctrl+Alt+1" active={editor.isActive("heading", { level: 1 })} onClick={() => c().toggleHeading({ level: 1 }).run()}>
        <Heading1 />
      </ToolButton>
      <ToolButton label={L("tb.h2")} shortcut="Ctrl+Alt+2" active={editor.isActive("heading", { level: 2 })} onClick={() => c().toggleHeading({ level: 2 }).run()}>
        <Heading2 />
      </ToolButton>
      <ToolButton label={L("tb.h3")} shortcut="Ctrl+Alt+3" active={editor.isActive("heading", { level: 3 })} onClick={() => c().toggleHeading({ level: 3 }).run()}>
        <Heading3 />
      </ToolButton>
      <Divider />
      <ToolButton label={L("tb.bold")} shortcut="Ctrl+B" active={editor.isActive("bold")} onClick={() => c().toggleBold().run()}>
        <Bold />
      </ToolButton>
      <ToolButton label={L("tb.italic")} shortcut="Ctrl+I" active={editor.isActive("italic")} onClick={() => c().toggleItalic().run()}>
        <Italic />
      </ToolButton>
      <ToolButton label={L("tb.underline")} shortcut="Ctrl+U" active={editor.isActive("underline")} onClick={() => c().toggleUnderline().run()}>
        <UnderlineIcon />
      </ToolButton>
      <ToolButton label={L("tb.highlight")} shortcut="Ctrl+Shift+H" active={editor.isActive("highlight")} onClick={() => c().toggleHighlight().run()}>
        <Highlighter />
      </ToolButton>
      <Divider />
      <ToolButton label={L("tb.bulletList")} shortcut="Ctrl+Shift+8" active={editor.isActive("bulletList")} onClick={() => c().toggleBulletList().run()}>
        <List />
      </ToolButton>
      <ToolButton label={L("tb.orderedList")} shortcut="Ctrl+Shift+7" active={editor.isActive("orderedList")} onClick={() => c().toggleOrderedList().run()}>
        <ListOrdered />
      </ToolButton>
      <ToolButton label={L("tb.taskList")} shortcut="Ctrl+Shift+9" active={editor.isActive("taskList")} onClick={() => c().toggleTaskList().run()}>
        <ListChecks />
      </ToolButton>
      <Divider />
      <ToolButton label={L("tb.quote")} shortcut="Ctrl+Shift+B" active={editor.isActive("blockquote")} onClick={() => c().toggleBlockquote().run()}>
        <Quote />
      </ToolButton>
      <ToolButton label={L("tb.codeBlock")} shortcut="Ctrl+Alt+C" active={editor.isActive("codeBlock")} onClick={() => c().toggleCodeBlock().run()}>
        <Code2 />
      </ToolButton>
      <ToolButton label={L("tb.link")} shortcut="Ctrl+Shift+L" active={editor.isActive("link")} onClick={onLink}>
        <Link2 />
      </ToolButton>
      <ToolButton label={L("tb.image")} disabled={uploading} onClick={() => fileRef.current?.click()}>
        {uploading ? <Loader2 className="animate-spin" /> : <ImagePlus />}
      </ToolButton>
      <input
        ref={fileRef}
        type="file"
        accept="image/png,image/jpeg,image/gif,image/webp"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) onImage(file);
          e.target.value = "";
        }}
      />
      <ToolButton
        label={L("tb.table")}
        active={inTable}
        disabled={inTable}
        onClick={() => c().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run()}
      >
        <TableIcon />
      </ToolButton>
      {inTable && (
        <>
          <Divider />
          <ToolButton label={L("tb.addRow")} onClick={() => c().addRowAfter().run()}>
            <Rows3 />
          </ToolButton>
          <ToolButton label={L("tb.addColumn")} onClick={() => c().addColumnAfter().run()}>
            <Columns3 />
          </ToolButton>
          <ToolButton label={L("tb.deleteRow")} onClick={() => c().deleteRow().run()}>
            <Rows3 className="text-red-500" />
          </ToolButton>
          <ToolButton label={L("tb.deleteColumn")} onClick={() => c().deleteColumn().run()}>
            <Columns3 className="text-red-500" />
          </ToolButton>
          <ToolButton label={L("tb.deleteTable")} onClick={() => c().deleteTable().run()}>
            <Trash2 className="text-red-500" />
          </ToolButton>
        </>
      )}
    </div>
  );
}
