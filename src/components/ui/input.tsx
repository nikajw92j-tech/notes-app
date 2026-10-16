"use client";

import { forwardRef, useId, useState } from "react";
import { Eye, EyeOff, Info } from "lucide-react";
import { cn } from "@/lib/cn";
import { useI18n } from "@/lib/i18n";

export const inputClass =
  "w-full h-11 rounded-lg border border-line-strong bg-input px-4 text-preset-5 text-fg placeholder:text-fg-5 transition-shadow hover:bg-hover focus:outline-none focus-visible:ring-2 focus-visible:ring-neutral-500 focus-visible:ring-offset-2 focus-visible:ring-offset-bg disabled:opacity-60 aria-[invalid=true]:border-red-500 dark:border-neutral-600";

interface FieldProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label: string;
  hint?: string;
  error?: string;
  labelAction?: React.ReactNode;
}

export const Field = forwardRef<HTMLInputElement, FieldProps>(function Field(
  { label, hint, error, labelAction, id, className, type, ...rest },
  ref,
) {
  const autoId = useId();
  const inputId = id ?? autoId;
  const describedBy = error || hint ? `${inputId}-desc` : undefined;
  const [show, setShow] = useState(false);
  const { t } = useI18n();
  const isPassword = type === "password";

  return (
    <div className={cn("flex flex-col gap-1.5", className)}>
      <div className="flex items-center justify-between">
        <label htmlFor={inputId} className="text-preset-4 text-fg">
          {label}
        </label>
        {labelAction}
      </div>
      <div className="relative">
        <input
          ref={ref}
          id={inputId}
          type={isPassword && show ? "text" : type}
          aria-invalid={error ? true : undefined}
          aria-describedby={describedBy}
          className={cn(inputClass, isPassword && "pr-11")}
          {...rest}
        />
        {isPassword && (
          <button
            type="button"
            onClick={() => setShow((s) => !s)}
            aria-label={show ? t("auth.hidePassword") : t("auth.showPassword")}
            aria-pressed={show}
            className="focus-ring absolute top-1/2 right-3 -translate-y-1/2 rounded p-0.5 text-fg-5 hover:text-fg"
          >
            {show ? <EyeOff className="size-5" /> : <Eye className="size-5" />}
          </button>
        )}
      </div>
      {(error || hint) && (
        <p
          id={describedBy}
          className={cn("flex items-center gap-2 text-preset-6", error ? "text-red-500" : "text-fg-4")}
        >
          <Info className="size-4 shrink-0" aria-hidden />
          {error ?? hint}
        </p>
      )}
    </div>
  );
});
