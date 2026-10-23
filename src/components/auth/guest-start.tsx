"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { motion } from "framer-motion";
import { Loader2 } from "lucide-react";
import { Logo } from "@/components/ui/logo";
import { Button } from "@/components/ui/button";
import { startGuestSession } from "@/lib/actions/guest";
import { useI18n, type MessageKey } from "@/lib/i18n";
import { safeNextPath } from "@/lib/validation";

/** Opens the app straight away: creates a guest session, then continues. */
export function GuestStart() {
  const { t } = useI18n();
  const params = useSearchParams();
  const next = safeNextPath(params.get("next"));
  const [error, setError] = useState<string | null>(null);
  const started = useRef(false);

  const run = useCallback(async () => {
    setError(null);
    try {
      const res = await startGuestSession();
      if (res.ok) {
        // full navigation so the server layout sees the new session cookie
        window.location.replace(next);
        return;
      }
      setError(`auth.err.${res.error}`);
    } catch {
      setError("auth.err.generic");
    }
  }, [next]);

  useEffect(() => {
    if (started.current) return;
    started.current = true;
    void run();
  }, [run]);

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="flex w-full max-w-sm flex-col items-center gap-6 rounded-xl border border-neutral-200 bg-neutral-0 px-6 py-10 text-center dark:border-neutral-800 dark:bg-neutral-950"
    >
      <Logo />
      {error ? (
        <>
          <p role="alert" className="text-preset-5 text-fg-3">
            {t(error as MessageKey)}
          </p>
          <div className="flex flex-col items-center gap-3">
            <Button onClick={() => void run()}>{t("common.retry")}</Button>
            <Link href="/login" className="focus-ring rounded text-preset-5 text-fg-4 hover:text-fg hover:underline">
              {t("auth.login")}
            </Link>
          </div>
        </>
      ) : (
        <p role="status" className="flex items-center gap-2 text-preset-5 text-fg-3">
          <Loader2 className="size-4 animate-spin" aria-hidden />
          {t("start.preparing")}
        </p>
      )}
    </motion.div>
  );
}
