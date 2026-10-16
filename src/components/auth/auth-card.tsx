"use client";

import { motion } from "framer-motion";
import { Logo } from "@/components/ui/logo";

export function AuthCard({
  title,
  subtitle,
  children,
  footer,
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
}) {
  return (
    <motion.section
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, ease: [0.2, 0.8, 0.2, 1] }}
      className="w-full max-w-[540px] rounded-xl border border-neutral-200 bg-neutral-0 px-4 py-10 shadow-[0_8px_12px_0_rgba(240,240,240,0.6)] sm:px-8 md:px-12 md:py-12 dark:border-neutral-800 dark:bg-neutral-950 dark:shadow-none"
    >
      <div className="flex flex-col items-center gap-4 text-center">
        <Logo />
        <div className="flex flex-col gap-2">
          <h1 className="text-preset-1 text-fg">{title}</h1>
          {subtitle && <p className="text-preset-5 text-fg-4">{subtitle}</p>}
        </div>
      </div>
      <div className="mt-10 flex flex-col gap-4">{children}</div>
      {footer && <div className="mt-4 border-t border-line pt-4 text-center text-preset-5 text-fg-4">{footer}</div>}
    </motion.section>
  );
}

export function FormError({ message }: { message?: string }) {
  if (!message) return null;
  return (
    <motion.p
      role="alert"
      initial={{ opacity: 0, y: -4 }}
      animate={{ opacity: 1, y: 0 }}
      className="rounded-lg border border-red-500/30 bg-red-100 px-3 py-2 text-preset-5 text-neutral-950 dark:bg-red-500/15 dark:text-neutral-0"
    >
      {message}
    </motion.p>
  );
}

export function FormSuccess({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <motion.div
      role="status"
      initial={{ opacity: 0, scale: 0.98 }}
      animate={{ opacity: 1, scale: 1 }}
      className="rounded-lg border border-green-500/30 bg-green-100 px-4 py-3 text-preset-5 text-neutral-950 dark:bg-green-500/15 dark:text-neutral-0"
    >
      <p className="text-preset-4">{title}</p>
      <p className="mt-1">{children}</p>
    </motion.div>
  );
}
