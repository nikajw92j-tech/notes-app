"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Archive, FolderTree, House, Search, Settings, X } from "lucide-react";
import { Sidebar } from "@/components/app/sidebar";
import { ProfileMenu } from "@/components/app/profile-menu";
import { ShortcutsDialog } from "@/components/app/shortcuts-dialog";
import { SEARCH_INPUT_ID } from "@/components/app/header";
import { useWorkspace, WorkspaceProvider } from "@/components/app/workspace";
import { notesHref, useNoteParams } from "@/components/notes/use-note-params";
import { Logo } from "@/components/ui/logo";
import { useI18n } from "@/lib/i18n";
import type { Profile, UserSettings } from "@/lib/types";
import { cn } from "@/lib/cn";

export const SAVE_EVENT = "notes:save-now";

function isTyping(target: EventTarget | null) {
  const el = target as HTMLElement | null;
  return !!el && (el.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(el.tagName));
}

function GlobalShortcuts() {
  const router = useRouter();
  const { createNote, setShortcutsOpen } = useWorkspace();
  const { folder, setParams, isNotesPage } = useNoteParams();

  useEffect(() => {
    const onKey = async (e: KeyboardEvent) => {
      const mod = e.metaKey || e.ctrlKey;
      const typing = isTyping(e.target);
      if (!mod && document.querySelector('[role="dialog"], [role="menu"]')) return;

      if (mod && e.key.toLowerCase() === "s") {
        e.preventDefault();
        window.dispatchEvent(new Event(SAVE_EVENT));
        return;
      }
      if ((mod && e.key.toLowerCase() === "k") || (!typing && e.key === "/")) {
        e.preventDefault();
        const input = document.getElementById(SEARCH_INPUT_ID) as HTMLInputElement | null;
        if (input && input.offsetParent !== null) input.focus();
        else setParams({ search: "1", note: null });
        return;
      }
      if ((mod && e.altKey && e.code === "KeyN") || (!typing && !mod && !e.altKey && e.key.toLowerCase() === "n")) {
        e.preventDefault();
        const note = await createNote({ folder_id: isNotesPage ? folder : null });
        if (note) router.push(notesHref({ folder: isNotesPage ? folder : null, note: note.id }));
        return;
      }
      if (!typing && e.key === "?") {
        e.preventDefault();
        setShortcutsOpen(true);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [createNote, folder, isNotesPage, router, setParams, setShortcutsOpen]);

  return null;
}

function MobileNav() {
  const { t } = useI18n();
  const pathname = usePathname();
  const { view, search, folder, tag, note } = useNoteParams();
  const { setDrawerOpen, drawerOpen } = useWorkspace();
  const onNotes = pathname === "/notes";
  if (onNotes && note) return null; // the note editor owns the full screen on mobile

  const items = [
    { key: "home", href: "/notes", icon: House, label: t("nav.home"), active: onNotes && view === "all" && !search && !folder && !tag },
    { key: "search", href: notesHref({ search: "1" }), icon: Search, label: t("nav.search"), active: onNotes && search },
    { key: "archived", href: notesHref({ view: "archived" }), icon: Archive, label: t("nav.archived"), active: onNotes && view === "archived" && !search },
  ];

  const itemClass = (active: boolean) =>
    cn(
      "focus-ring flex h-full flex-1 flex-col items-center justify-center gap-1 rounded text-preset-6 transition-colors",
      active ? "bg-blue-50 text-blue-500 dark:bg-neutral-700" : "text-fg-4 hover:text-fg",
    );

  return (
    <nav
      aria-label="Mobile"
      className="fixed inset-x-0 bottom-0 z-30 flex h-14 items-stretch gap-1 border-t border-line bg-bg px-4 py-2 shadow-[0_-4px_6px_rgba(240,240,240,0.6)] md:h-[74px] md:px-8 md:py-3 lg:hidden dark:shadow-none"
    >
      {items.map(({ key, href, icon: Icon, label, active }) => (
        <Link key={key} href={href} className={itemClass(active)} aria-current={active ? "page" : undefined}>
          <Icon className="size-6" aria-hidden />
          <span className="hidden md:block">{label}</span>
          <span className="sr-only md:hidden">{label}</span>
        </Link>
      ))}
      <button
        type="button"
        onClick={() => setDrawerOpen(true)}
        className={cn(itemClass(drawerOpen || (onNotes && !!(folder || tag) && !search)), "cursor-pointer")}
        aria-expanded={drawerOpen}
      >
        <FolderTree className="size-6" aria-hidden />
        <span className="hidden md:block">{t("nav.browse")}</span>
        <span className="sr-only md:hidden">{t("nav.browse")}</span>
      </button>
      <Link href="/settings" className={itemClass(pathname.startsWith("/settings"))} aria-current={pathname.startsWith("/settings") ? "page" : undefined}>
        <Settings className="size-6" aria-hidden />
        <span className="hidden md:block">{t("nav.settings")}</span>
        <span className="sr-only md:hidden">{t("nav.settings")}</span>
      </Link>
    </nav>
  );
}

function MobileDrawer() {
  const { t } = useI18n();
  const { drawerOpen, setDrawerOpen } = useWorkspace();

  useEffect(() => {
    if (!drawerOpen) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setDrawerOpen(false);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [drawerOpen, setDrawerOpen]);

  return (
    <AnimatePresence>
      {drawerOpen && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <motion.div
            className="absolute inset-0 bg-overlay"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setDrawerOpen(false)}
            aria-hidden
          />
          <motion.aside
            role="dialog"
            aria-modal="true"
            aria-label={t("nav.browse")}
            initial={{ x: "-100%" }}
            animate={{ x: 0 }}
            exit={{ x: "-100%" }}
            transition={{ type: "spring", stiffness: 380, damping: 38 }}
            className="absolute inset-y-0 left-0 flex w-[min(300px,85vw)] flex-col bg-bg shadow-xl"
          >
            <div className="flex items-center justify-between border-b border-line px-4 py-3">
              <Logo />
              <button
                type="button"
                onClick={() => setDrawerOpen(false)}
                aria-label={t("nav.closeMenu")}
                className="focus-ring flex size-9 cursor-pointer items-center justify-center rounded-lg text-fg-4 hover:bg-hover"
                autoFocus
              >
                <X className="size-5" />
              </button>
            </div>
            <Sidebar layoutGroup="drawer" onNavigate={() => setDrawerOpen(false)} />
          </motion.aside>
        </div>
      )}
    </AnimatePresence>
  );
}

function MobileTopBar() {
  const { note } = useNoteParams();
  const pathname = usePathname();
  if (pathname === "/notes" && note) return null;
  return (
    <div className="flex items-center justify-between bg-shell px-4 py-3 md:px-8 md:py-6 lg:hidden">
      <Link href="/notes" className="focus-ring rounded">
        <Logo />
      </Link>
      <ProfileMenu />
    </div>
  );
}

export function AppShell({
  profile,
  settings,
  children,
}: {
  profile: Profile;
  settings: UserSettings;
  children: React.ReactNode;
}) {
  const { t } = useI18n();
  return (
    <WorkspaceProvider initialProfile={profile} initialSettings={settings}>
      <a
        href="#main"
        className="sr-only z-50 rounded-lg bg-blue-500 px-4 py-2 text-white focus:not-sr-only focus:fixed focus:top-2 focus:left-2"
      >
        {t("app.skip")}
      </a>
      <div className="flex h-dvh flex-col bg-shell lg:flex-row lg:bg-bg">
        <aside className="hidden w-[272px] shrink-0 border-r border-line lg:flex">
          <Sidebar />
        </aside>
        <MobileTopBar />
        <main
          id="main"
          className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-t-xl bg-bg lg:rounded-none"
        >
          {children}
        </main>
        <MobileNav />
      </div>
      <MobileDrawer />
      <ShortcutsDialog />
      <GlobalShortcuts />
    </WorkspaceProvider>
  );
}
