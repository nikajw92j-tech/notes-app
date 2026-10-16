"use client";

import { useFormStatus } from "react-dom";
import { Loader2 } from "lucide-react";
import { signInWithGoogle } from "@/lib/actions/auth";
import { useI18n } from "@/lib/i18n";

function GoogleIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" aria-hidden>
      <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.27-4.74 3.27-8.1z" />
      <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84A11 11 0 0 0 12 23z" />
      <path fill="#FBBC05" d="M5.84 14.1A6.6 6.6 0 0 1 5.5 12c0-.73.13-1.44.34-2.1V7.06H2.18A11 11 0 0 0 1 12c0 1.77.43 3.45 1.18 4.94l3.66-2.84z" />
      <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15A10.96 10.96 0 0 0 12 1 11 11 0 0 0 2.18 7.06l3.66 2.84C6.71 7.31 9.14 5.38 12 5.38z" />
    </svg>
  );
}

function Inner() {
  const { pending } = useFormStatus();
  const { t } = useI18n();
  return (
    <button
      type="submit"
      disabled={pending}
      className="focus-ring flex h-12 w-full cursor-pointer items-center justify-center gap-4 rounded-xl border border-line-strong text-preset-3 text-fg transition-colors hover:bg-hover disabled:opacity-60 dark:border-neutral-600"
    >
      {pending ? <Loader2 className="size-5 animate-spin" /> : <GoogleIcon />}
      {t("auth.google")}
    </button>
  );
}

export function GoogleButton({ next }: { next?: string }) {
  const { t } = useI18n();
  return (
    <form action={signInWithGoogle} className="flex flex-col items-center gap-4 border-t border-line pt-6">
      <p className="text-preset-5 text-fg-4">{t("auth.orLoginWith")}</p>
      {next && <input type="hidden" name="next" value={next} />}
      <Inner />
    </form>
  );
}
