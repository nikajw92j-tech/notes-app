"use client";

import { useEffect, useId, useRef } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion } from "framer-motion";
import { cn } from "@/lib/cn";
import { Button } from "./button";
import { useI18n } from "@/lib/i18n";
import { Trash2 } from "lucide-react";

const FOCUSABLE =
  'a[href],button:not([disabled]),input:not([disabled]),select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex="-1"])';

interface DialogProps {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: React.ReactNode;
  icon?: React.ReactNode;
  children?: React.ReactNode;
  footer?: React.ReactNode;
  className?: string;
}

export function Dialog({ open, onClose, title, description, icon, children, footer, className }: DialogProps) {
  const panelRef = useRef<HTMLDivElement>(null);
  const titleId = useId();
  const descId = useId();
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  useEffect(() => {
    if (!open) return;
    const previous = document.activeElement as HTMLElement | null;
    const panel = panelRef.current;
    const first = panel?.querySelector<HTMLElement>("[data-autofocus]") ?? panel?.querySelector<HTMLElement>(FOCUSABLE);
    requestAnimationFrame(() => first?.focus());

    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        onCloseRef.current();
      } else if (e.key === "Tab" && panel) {
        const items = Array.from(panel.querySelectorAll<HTMLElement>(FOCUSABLE));
        if (!items.length) return;
        const firstEl = items[0];
        const lastEl = items[items.length - 1];
        if (e.shiftKey && document.activeElement === firstEl) {
          e.preventDefault();
          lastEl.focus();
        } else if (!e.shiftKey && document.activeElement === lastEl) {
          e.preventDefault();
          firstEl.focus();
        }
      }
    };
    document.addEventListener("keydown", onKey, true);
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey, true);
      document.body.style.overflow = overflow;
      previous?.focus?.();
    };
  }, [open]);

  if (typeof document === "undefined") return null;

  return createPortal(
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <motion.div
            className="absolute inset-0 bg-overlay"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.18 }}
            onClick={onClose}
            aria-hidden
          />
          <motion.div
            ref={panelRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby={titleId}
            aria-describedby={description ? descId : undefined}
            initial={{ opacity: 0, scale: 0.96, y: 8 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.97, y: 4 }}
            transition={{ type: "spring", stiffness: 420, damping: 32, mass: 0.8 }}
            className={cn(
              "relative w-full max-w-[440px] overflow-hidden rounded-xl border border-line bg-bg shadow-xl",
              className,
            )}
          >
            <div className="flex gap-4 p-5">
              {icon && (
                <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-muted text-fg">
                  {icon}
                </div>
              )}
              <div className="flex min-w-0 flex-1 flex-col gap-1.5">
                <h2 id={titleId} className="text-preset-3 text-fg">
                  {title}
                </h2>
                {description && (
                  <div id={descId} className="text-preset-5 text-fg-3">
                    {description}
                  </div>
                )}
                {children && <div className="mt-3">{children}</div>}
              </div>
            </div>
            {footer && (
              <div className="flex justify-end gap-4 border-t border-line px-5 py-4">{footer}</div>
            )}
          </motion.div>
        </div>
      )}
    </AnimatePresence>,
    document.body,
  );
}

interface ConfirmProps {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void | Promise<void>;
  title: string;
  description: React.ReactNode;
  confirmLabel?: string;
  loading?: boolean;
  icon?: React.ReactNode;
}

export function ConfirmDialog({ open, onClose, onConfirm, title, description, confirmLabel, loading, icon }: ConfirmProps) {
  const { t } = useI18n();
  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={title}
      description={description}
      icon={icon ?? <Trash2 className="size-6" />}
      footer={
        <>
          <Button variant="secondary" onClick={onClose} data-autofocus>
            {t("dialog.cancel")}
          </Button>
          <Button variant="danger" loading={loading} onClick={() => void onConfirm()}>
            {confirmLabel ?? t("dialog.delete")}
          </Button>
        </>
      }
    />
  );
}
