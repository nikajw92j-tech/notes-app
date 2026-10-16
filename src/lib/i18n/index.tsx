"use client";

import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react";
import type { Locale } from "@/lib/types";
import { en, type Dictionary, type MessageKey } from "./en";
import { ka } from "./ka";
import { ru } from "./ru";
import { isLocale, LOCALE_COOKIE } from "./server";

export const LOCALES: { code: Locale; label: string; intl: string }[] = [
  { code: "en", label: "English", intl: "en-GB" },
  { code: "ka", label: "ქართული", intl: "ka-GE" },
  { code: "ru", label: "Русский", intl: "ru-RU" },
];

const DICTIONARIES: Record<Locale, Dictionary> = { en, ka, ru };

export { isLocale, LOCALE_COOKIE };

type Vars = Record<string, string | number>;

interface I18nValue {
  locale: Locale;
  setLocale: (locale: Locale) => void;
  t: (key: MessageKey, vars?: Vars) => string;
  formatDate: (iso: string, withTime?: boolean) => string;
}

const I18nContext = createContext<I18nValue | null>(null);

export function I18nProvider({ initialLocale, children }: { initialLocale: Locale; children: ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>(initialLocale);

  const setLocale = useCallback((next: Locale) => {
    setLocaleState(next);
    document.documentElement.lang = next;
    document.cookie = `${LOCALE_COOKIE}=${next}; path=/; max-age=31536000; samesite=lax`;
  }, []);

  const value = useMemo<I18nValue>(() => {
    const dict = DICTIONARIES[locale];
    const intl = LOCALES.find((l) => l.code === locale)!.intl;
    const dateFmt = new Intl.DateTimeFormat(intl, { day: "numeric", month: "short", year: "numeric" });
    const dateTimeFmt = new Intl.DateTimeFormat(intl, {
      day: "numeric",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
    return {
      locale,
      setLocale,
      t: (key, vars) => {
        let msg = dict[key] ?? en[key] ?? key;
        if (vars) for (const [k, v] of Object.entries(vars)) msg = msg.replaceAll(`{${k}}`, String(v));
        return msg;
      },
      formatDate: (iso, withTime) => (withTime ? dateTimeFmt : dateFmt).format(new Date(iso)),
    };
  }, [locale, setLocale]);

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n() {
  const ctx = useContext(I18nContext);
  if (!ctx) throw new Error("useI18n must be used inside I18nProvider");
  return ctx;
}

export type { MessageKey };
