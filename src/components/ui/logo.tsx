import { cn } from "@/lib/cn";

/** Brand mark: quill feather + "Notes" wordmark (Pacifico). */
export function Logo({ className }: { className?: string }) {
  return (
    <span className={cn("inline-flex items-center gap-1.5 text-fg select-none", className)} aria-label="Notes">
      <svg width="24" height="28" viewBox="0 0 24 28" fill="none" aria-hidden>
        <path
          d="M21.5 1.5C14 2.5 8.4 7.6 6.2 14.6c-.9 2.9-1.2 6-1 9.1l.1 1.8"
          stroke="#335CFF"
          strokeWidth="2.2"
          strokeLinecap="round"
        />
        <path
          d="M21.5 1.5c.6 6.2-2 12.4-7.4 15.8-2.3 1.4-4.9 2.2-7.6 2.4 1.1-4.6 3.4-8.9 6.9-12.2"
          fill="#335CFF"
          fillOpacity=".18"
          stroke="#335CFF"
          strokeWidth="1.6"
          strokeLinejoin="round"
        />
      </svg>
      <span className="font-logo text-[24px] leading-none tracking-tight">Notes</span>
    </span>
  );
}
