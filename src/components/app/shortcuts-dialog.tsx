"use client";

import { Keyboard } from "lucide-react";
import { Dialog } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Kbd } from "@/components/ui/misc";
import { useWorkspace } from "@/components/app/workspace";
import { useI18n, type MessageKey } from "@/lib/i18n";

const SHORTCUTS: { keys: string[]; label: MessageKey }[] = [
  { keys: ["N"], label: "shortcuts.newNote" },
  { keys: ["Ctrl/⌘", "Alt", "N"], label: "shortcuts.newNote" },
  { keys: ["/"], label: "shortcuts.search" },
  { keys: ["Ctrl/⌘", "K"], label: "shortcuts.search" },
  { keys: ["Ctrl/⌘", "S"], label: "shortcuts.save" },
  { keys: ["?"], label: "shortcuts.help" },
  { keys: ["Esc"], label: "shortcuts.close" },
  { keys: ["Ctrl/⌘", "B"], label: "shortcuts.bold" },
  { keys: ["Ctrl/⌘", "I"], label: "shortcuts.italic" },
  { keys: ["Ctrl/⌘", "U"], label: "shortcuts.underline" },
  { keys: ["Ctrl/⌘", "Shift", "9"], label: "shortcuts.checklist" },
  { keys: ["Ctrl/⌘", "Shift", "L"], label: "shortcuts.link" },
  { keys: ["Ctrl/⌘", "Z"], label: "shortcuts.undo" },
  { keys: ["Ctrl/⌘", "Shift", "Z"], label: "shortcuts.redo" },
];

export function ShortcutsDialog() {
  const { t } = useI18n();
  const { shortcutsOpen, setShortcutsOpen } = useWorkspace();
  return (
    <Dialog
      open={shortcutsOpen}
      onClose={() => setShortcutsOpen(false)}
      title={t("shortcuts.title")}
      icon={<Keyboard className="size-6" />}
      className="max-w-[520px]"
      footer={
        <Button variant="secondary" onClick={() => setShortcutsOpen(false)} data-autofocus>
          {t("dialog.close")}
        </Button>
      }
    >
      <ul className="flex max-h-[60vh] flex-col divide-y divide-line overflow-y-auto">
        {SHORTCUTS.map((s, i) => (
          <li key={i} className="flex items-center justify-between gap-4 py-2 text-preset-5 text-fg-3">
            <span>{t(s.label)}</span>
            <span className="flex shrink-0 gap-1">
              {s.keys.map((k) => (
                <Kbd key={k}>{k}</Kbd>
              ))}
            </span>
          </li>
        ))}
      </ul>
    </Dialog>
  );
}
