"use client";

import { forwardRef } from "react";
import { motion, type HTMLMotionProps } from "framer-motion";
import { Loader2 } from "lucide-react";
import { cn } from "@/lib/cn";

type Variant = "primary" | "secondary" | "border" | "ghost" | "danger";
type Size = "md" | "sm" | "icon";

const VARIANTS: Record<Variant, string> = {
  primary: "bg-blue-500 text-neutral-0 hover:bg-blue-700 disabled:bg-neutral-100 disabled:text-neutral-300 dark:disabled:bg-neutral-800 dark:disabled:text-neutral-600",
  secondary: "bg-muted text-fg-4 hover:bg-line hover:text-fg-3 dark:bg-neutral-500 dark:text-neutral-0 dark:hover:bg-neutral-600",
  border: "border border-line-strong bg-bg text-fg hover:bg-hover dark:border-neutral-600",
  ghost: "text-fg-4 hover:bg-hover hover:text-fg",
  danger: "bg-red-500 text-neutral-0 hover:bg-red-500/90",
};

const SIZES: Record<Size, string> = {
  md: "h-[41px] px-4 gap-2 rounded-lg text-preset-4",
  sm: "h-8 px-3 gap-1.5 rounded-md text-preset-4",
  icon: "size-9 rounded-lg justify-center",
};

export interface ButtonProps extends Omit<HTMLMotionProps<"button">, "children"> {
  variant?: Variant;
  size?: Size;
  loading?: boolean;
  children?: React.ReactNode;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = "primary", size = "md", loading, disabled, className, children, type = "button", ...rest },
  ref,
) {
  return (
    <motion.button
      ref={ref}
      type={type}
      whileTap={disabled || loading ? undefined : { scale: 0.97 }}
      transition={{ duration: 0.12 }}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      className={cn(
        "focus-ring inline-flex shrink-0 cursor-pointer items-center justify-center whitespace-nowrap transition-colors disabled:cursor-not-allowed",
        VARIANTS[variant],
        SIZES[size],
        className,
      )}
      {...rest}
    >
      {loading && <Loader2 className="size-4 animate-spin" aria-hidden />}
      {children}
    </motion.button>
  );
});
