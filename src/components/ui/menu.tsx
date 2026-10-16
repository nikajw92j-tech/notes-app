"use client";

import { createContext, useCallback, useContext, useEffect, useId, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Check } from "lucide-react";
import { cn } from "@/lib/cn";

const MenuContext = createContext<{ close: () => void } | null>(null);

interface MenuProps {
  trigger: (props: {
    ref: React.Ref<HTMLButtonElement>;
    onClick: () => void;
    "aria-haspopup": "menu";
    "aria-expanded": boolean;
    "aria-controls": string;
  }) => React.ReactNode;
  children: React.ReactNode;
  align?: "start" | "end";
  side?: "bottom" | "top";
  className?: string;
  label?: string;
}

/** Accessible dropdown menu: arrow keys, Home/End, Escape, outside click. */
export function Menu({ trigger, children, align = "end", side = "bottom", className, label }: MenuProps) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const id = useId();

  const close = useCallback(() => {
    setOpen(false);
    triggerRef.current?.focus();
  }, []);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("pointerdown", onDown);
    requestAnimationFrame(() => listRef.current?.querySelector<HTMLElement>('[role^="menuitem"]')?.focus());
    return () => document.removeEventListener("pointerdown", onDown);
  }, [open]);

  const onKeyDown = (e: React.KeyboardEvent) => {
    const items = Array.from(
      listRef.current?.querySelectorAll<HTMLElement>('[role^="menuitem"]:not([aria-disabled="true"])') ?? [],
    );
    const index = items.indexOf(document.activeElement as HTMLElement);
    if (e.key === "ArrowDown") {
      e.preventDefault();
      items[(index + 1) % items.length]?.focus();
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      items[(index - 1 + items.length) % items.length]?.focus();
    } else if (e.key === "Home") {
      e.preventDefault();
      items[0]?.focus();
    } else if (e.key === "End") {
      e.preventDefault();
      items[items.length - 1]?.focus();
    } else if (e.key === "Escape") {
      e.preventDefault();
      e.stopPropagation();
      close();
    } else if (e.key === "Tab") {
      setOpen(false);
    }
  };

  return (
    <MenuContext.Provider value={{ close }}>
      <div ref={rootRef} className="relative" onKeyDown={open ? onKeyDown : undefined}>
        {trigger({
          ref: triggerRef,
          onClick: () => setOpen((o) => !o),
          "aria-haspopup": "menu",
          "aria-expanded": open,
          "aria-controls": id,
        })}
        <AnimatePresence>
          {open && (
            <motion.div
              ref={listRef}
              id={id}
              role="menu"
              aria-label={label}
              initial={{ opacity: 0, scale: 0.96, y: side === "bottom" ? -4 : 4 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.97, y: side === "bottom" ? -2 : 2 }}
              transition={{ duration: 0.14, ease: [0.2, 0.8, 0.2, 1] }}
              style={{ transformOrigin: `${side === "bottom" ? "top" : "bottom"} ${align === "end" ? "right" : "left"}` }}
              className={cn(
                "absolute z-40 min-w-[200px] rounded-lg border border-line bg-bg p-1 shadow-pop",
                side === "bottom" ? "top-full mt-1.5" : "bottom-full mb-1.5",
                align === "end" ? "right-0" : "left-0",
                className,
              )}
            >
              {children}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </MenuContext.Provider>
  );
}

interface MenuItemProps {
  onSelect: () => void;
  icon?: React.ReactNode;
  children: React.ReactNode;
  danger?: boolean;
  checked?: boolean;
  disabled?: boolean;
  keepOpen?: boolean;
}

export function MenuItem({ onSelect, icon, children, danger, checked, disabled, keepOpen }: MenuItemProps) {
  const ctx = useContext(MenuContext);
  const isCheckable = checked !== undefined;
  return (
    <button
      type="button"
      role={isCheckable ? "menuitemradio" : "menuitem"}
      aria-checked={isCheckable ? checked : undefined}
      aria-disabled={disabled || undefined}
      tabIndex={-1}
      onClick={() => {
        if (disabled) return;
        if (!keepOpen) ctx?.close();
        onSelect();
      }}
      className={cn(
        "flex w-full cursor-pointer items-center gap-2.5 rounded-md px-2.5 py-2 text-left text-preset-4 outline-none transition-colors focus:bg-hover hover:bg-hover",
        danger ? "text-red-500" : "text-fg-3",
        disabled && "cursor-not-allowed opacity-50",
      )}
    >
      {icon && <span className="flex size-4 shrink-0 items-center justify-center [&>svg]:size-4">{icon}</span>}
      <span className="min-w-0 flex-1 truncate">{children}</span>
      {checked && <Check className="size-4 text-blue-500" aria-hidden />}
    </button>
  );
}

export function MenuSeparator() {
  return <div role="separator" className="my-1 h-px bg-line" />;
}

export function MenuLabel({ children }: { children: React.ReactNode }) {
  return <div className="px-2.5 pt-2 pb-1 text-preset-6 text-fg-5">{children}</div>;
}
