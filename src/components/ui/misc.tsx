"use client";

import { motion } from "framer-motion";
import { cn } from "@/lib/cn";

export function Skeleton({ className }: { className?: string }) {
  return <div className={cn("skeleton rounded-md", className)} aria-hidden />;
}

export function EmptyState({
  icon,
  children,
  action,
  className,
}: {
  icon?: React.ReactNode;
  children: React.ReactNode;
  action?: React.ReactNode;
  className?: string;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25, ease: "easeOut" }}
      className={cn(
        "flex flex-col items-start gap-3 rounded-lg border border-line bg-muted p-2 text-preset-5 text-fg",
        className,
      )}
    >
      {icon && <div className="text-fg-5">{icon}</div>}
      <div>{children}</div>
      {action}
    </motion.div>
  );
}

/** Large centered illustration-style empty state used in the editor area. */
export function BlankState({ icon, title, children }: { icon: React.ReactNode; title?: string; children?: React.ReactNode }) {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.98 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.3, ease: "easeOut" }}
      className="flex h-full flex-col items-center justify-center gap-4 p-8 text-center"
    >
      <div className="relative flex size-20 items-center justify-center rounded-2xl bg-muted text-fg-5">
        <div className="absolute inset-0 rounded-2xl bg-blue-500/5" />
        {icon}
      </div>
      {title && <p className="text-preset-3 text-fg">{title}</p>}
      {children && <div className="max-w-xs text-preset-5 text-fg-4">{children}</div>}
    </motion.div>
  );
}

export function Kbd({ children }: { children: React.ReactNode }) {
  return (
    <kbd className="inline-flex h-6 min-w-6 items-center justify-center rounded border border-line-strong bg-muted px-1.5 font-mono text-[11px] text-fg-3">
      {children}
    </kbd>
  );
}
