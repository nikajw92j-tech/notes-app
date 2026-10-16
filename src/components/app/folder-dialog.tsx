"use client";

import { useEffect, useState } from "react";
import { Check, FolderPlus, FolderPen } from "lucide-react";
import { toast } from "sonner";
import { Dialog } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { inputClass } from "@/components/ui/input";
import { api, errorMessage } from "@/lib/client/api";
import { useI18n } from "@/lib/i18n";
import type { Folder } from "@/lib/types";
import { cn } from "@/lib/cn";

export const FOLDER_COLORS = ["#335CFF", "#21C16B", "#FB3748", "#F5A524", "#8B5CF6", "#06B6D4", "#EC4899", "#717784"];

export function FolderDialog({
  open,
  onClose,
  folder,
  onSaved,
}: {
  open: boolean;
  onClose: () => void;
  folder?: Folder | null;
  onSaved: (folder: Folder) => void;
}) {
  const { t } = useI18n();
  const [name, setName] = useState("");
  const [color, setColor] = useState(FOLDER_COLORS[0]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string>();

  useEffect(() => {
    if (open) {
      setName(folder?.name ?? "");
      setColor(folder?.color ?? FOLDER_COLORS[0]);
      setError(undefined);
    }
  }, [open, folder]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    setSaving(true);
    setError(undefined);
    try {
      const saved = folder
        ? await api<Folder>(`/api/folders/${folder.id}`, { method: "PATCH", json: { name: name.trim(), color } })
        : await api<Folder>("/api/folders", { method: "POST", json: { name: name.trim(), color } });
      toast.success(t(folder ? "toast.folderUpdated" : "toast.folderCreated"));
      onSaved(saved);
      onClose();
    } catch (err) {
      setError(errorMessage(err, t("toast.error")));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={t(folder ? "dialog.editFolder" : "dialog.newFolder")}
      icon={folder ? <FolderPen className="size-6" /> : <FolderPlus className="size-6" />}
    >
      <form id="folder-form" onSubmit={submit} className="flex flex-col gap-4">
        <div className="flex flex-col gap-1.5">
          <label htmlFor="folder-name" className="text-preset-4 text-fg">
            {t("dialog.folderName")}
          </label>
          <input
            id="folder-name"
            data-autofocus
            className={inputClass}
            value={name}
            maxLength={60}
            onChange={(e) => setName(e.target.value)}
            aria-invalid={error ? true : undefined}
            required
          />
          {error && <p className="text-preset-6 text-red-500">{error}</p>}
        </div>
        <fieldset className="flex flex-col gap-2">
          <legend className="mb-2 text-preset-4 text-fg">{t("dialog.folderColor")}</legend>
          <div className="flex flex-wrap gap-2">
            {FOLDER_COLORS.map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => setColor(c)}
                aria-label={c}
                aria-pressed={color === c}
                className={cn(
                  "focus-ring flex size-8 cursor-pointer items-center justify-center rounded-full transition-transform hover:scale-110",
                  color === c && "ring-2 ring-fg ring-offset-2 ring-offset-bg",
                )}
                style={{ backgroundColor: c }}
              >
                {color === c && <Check className="size-4 text-white" />}
              </button>
            ))}
          </div>
        </fieldset>
        <div className="mt-2 flex justify-end gap-3">
          <Button variant="secondary" onClick={onClose}>
            {t("dialog.cancel")}
          </Button>
          <Button type="submit" loading={saving} disabled={!name.trim()}>
            {t(folder ? "dialog.save" : "dialog.create")}
          </Button>
        </div>
      </form>
    </Dialog>
  );
}
