import type { Locale } from "@/lib/types";

export const LOCALE_COOKIE = "locale";

export function isLocale(value: unknown): value is Locale {
  return value === "en" || value === "ka" || value === "ru";
}
