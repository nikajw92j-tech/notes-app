"use client";

import { useId, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { X } from "lucide-react";
import { useWorkspace } from "@/components/app/workspace";
import { useI18n } from "@/lib/i18n";
import { MAX_TAGS } from "@/lib/validation";

export function TagInput({
  value,
  onChange,
  disabled,
}: {
  value: string[];
  onChange: (tags: string[]) => void;
  disabled?: boolean;
}) {
  const { t } = useI18n();
  const { tags } = useWorkspace();
  const [draft, setDraft] = useState("");
  const listId = useId();

  const add = (raw: string) => {
    const names = raw
      .split(",")
      .map((s) => s.replace(/[<>]/g, "").trim().slice(0, 30))
      .filter(Boolean);
    if (!names.length) return;
    const next = [...value];
    for (const name of names) {
      if (next.length >= MAX_TAGS) break;
      if (!next.some((n) => n.toLowerCase() === name.toLowerCase())) next.push(name);
    }
    if (next.length !== value.length) onChange(next);
    setDraft("");
  };

  const remove = (name: string) => onChange(value.filter((n) => n !== name));

  return (
    <div className="flex min-h-7 flex-wrap items-center gap-1">
      <AnimatePresence initial={false}>
        {value.map((name) => (
          <motion.span
            key={name}
            layout
            initial={{ opacity: 0, scale: 0.85 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.85 }}
            transition={{ duration: 0.14 }}
            className="inline-flex items-center gap-1 rounded bg-chip py-0.5 pr-1 pl-1.5 text-preset-6 text-fg"
          >
            {name}
            {!disabled && (
              <button
                type="button"
                onClick={() => remove(name)}
                aria-label={t("editor.removeTag", { tag: name })}
                className="focus-ring flex size-4 cursor-pointer items-center justify-center rounded-sm text-fg-4 hover:text-fg"
              >
                <X className="size-3" />
              </button>
            )}
          </motion.span>
        ))}
      </AnimatePresence>
      {!disabled && value.length < MAX_TAGS && (
        <>
          <input
            value={draft}
            list={listId}
            onChange={(e) => {
              const v = e.target.value;
              if (v.includes(",")) add(v);
              else setDraft(v);
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                add(draft);
              } else if (e.key === "Backspace" && !draft && value.length) {
                remove(value[value.length - 1]);
              }
            }}
            onBlur={() => add(draft)}
            placeholder={value.length ? "" : t("editor.tagsPlaceholder")}
            aria-label={t("editor.tags")}
            className="min-w-[8rem] flex-1 bg-transparent py-1 text-preset-5 text-fg placeholder:text-fg-5 focus:outline-none"
          />
          <datalist id={listId}>
            {tags
              ?.filter((tg) => !value.some((v) => v.toLowerCase() === tg.name.toLowerCase()))
              .map((tg) => <option key={tg.id} value={tg.name} />)}
          </datalist>
        </>
      )}
    </div>
  );
}
