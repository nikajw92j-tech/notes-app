"use client";

import { ThemeProvider } from "next-themes";
import { MotionConfig } from "framer-motion";
import { Toaster } from "sonner";
import { I18nProvider } from "@/lib/i18n";
import type { Locale } from "@/lib/types";

export function Providers({ locale, children }: { locale: Locale; children: React.ReactNode }) {
  return (
    <ThemeProvider attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange>
      <I18nProvider initialLocale={locale}>
        <MotionConfig reducedMotion="user">
          {children}
          <Toaster
            position="bottom-right"
            closeButton
            toastOptions={{
              classNames: {
                toast:
                  "!bg-bg !border !border-line !text-fg !rounded-lg !shadow-pop !font-sans !text-preset-5 !gap-2",
                actionButton: "!bg-transparent !text-fg !underline !font-medium",
                closeButton: "!bg-bg !border-line !text-fg-5",
                success: "[&_[data-icon]]:!text-green-500",
                error: "[&_[data-icon]]:!text-red-500",
              },
            }}
          />
        </MotionConfig>
      </I18nProvider>
    </ThemeProvider>
  );
}
