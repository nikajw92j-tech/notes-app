"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { Search, Settings, X } from "lucide-react";
import { ProfileMenu } from "@/components/app/profile-menu";
import { useNoteParams } from "@/components/notes/use-note-params";
import { useI18n } from "@/lib/i18n";
import { cn } from "@/lib/cn";

export const SEARCH_INPUT_ID = "global-search";

export function SearchInput({ className, autoFocus }: { className?: string; autoFocus?: boolean }) {
  const { t } = useI18n();
  const { q, setParams, isNotesPage } = useNoteParams();
  const [value, setValue] = useState(q);
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);

  useEffect(() => setValue(q), [q]);
  useEffect(() => () => clearTimeout(timer.current), []);

  const commit = (next: string) => {
    clearTimeout(timer.current);
    timer.current = setTimeout(
      () => setParams({ q: next.trim() || null, note: null }, { replace: isNotesPage }),
      250,
    );
  };

  return (
    <div className={cn("relative", className)} role="search">
      <Search className="pointer-events-none absolute top-1/2 left-4 size-5 -translate-y-1/2 text-fg-5" aria-hidden />
      <input
        id={SEARCH_INPUT_ID}
        type="search"
        autoFocus={autoFocus}
        value={value}
        onChange={(e) => {
          setValue(e.target.value);
          commit(e.target.value);
        }}
        onKeyDown={(e) => {
          if (e.key === "Escape" && value) {
            e.stopPropagation();
            setValue("");
            commit("");
          }
        }}
        placeholder={t("header.searchPlaceholder")}
        aria-label={t("header.searchLabel")}
        className="h-11 w-full rounded-lg border border-line-strong bg-input pr-10 pl-12 text-preset-5 text-fg placeholder:text-fg-5 transition-shadow hover:bg-hover focus:outline-none focus-visible:ring-2 focus-visible:ring-neutral-500 focus-visible:ring-offset-2 focus-visible:ring-offset-bg dark:border-neutral-600 [&::-webkit-search-cancel-button]:hidden"
      />
      {value && (
        <button
          type="button"
          onClick={() => {
            setValue("");
            commit("");
          }}
          aria-label={t("header.clearSearch")}
          className="focus-ring absolute top-1/2 right-3 flex size-6 -translate-y-1/2 cursor-pointer items-center justify-center rounded text-fg-5 hover:text-fg"
        >
          <X className="size-4" />
        </button>
      )}
    </div>
  );
}

export function Header({ title }: { title: React.ReactNode }) {
  const { t } = useI18n();
  return (
    <header className="hidden h-[81px] shrink-0 items-center justify-between gap-6 border-b border-line px-8 lg:flex">
      <h1 className="min-w-0 truncate text-preset-1 text-fg">{title}</h1>
      <div className="flex items-center gap-4">
        <SearchInput className="w-[300px]" />
        <Link
          href="/settings"
          aria-label={t("nav.settings")}
          title={t("nav.settings")}
          className="focus-ring flex size-10 items-center justify-center rounded-lg text-fg-5 transition-colors hover:bg-hover hover:text-fg"
        >
          <Settings className="size-6" />
        </Link>
        <ProfileMenu />
      </div>
    </header>
  );
}
