"use client";

import { useEffect } from "react";
import { AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useI18n } from "@/lib/i18n";

export default function ErrorPage({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  const { t } = useI18n();
  useEffect(() => {
    console.error(error);
  }, [error]);
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center gap-4 bg-bg p-6 text-center">
      <div className="flex size-16 items-center justify-center rounded-2xl bg-muted text-red-500">
        <AlertTriangle className="size-8" />
      </div>
      <p className="max-w-sm text-preset-3 text-fg">{t("toast.error")}</p>
      <Button onClick={reset}>{t("common.retry")}</Button>
    </main>
  );
}
