"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { useTheme } from "next-themes";
import { toast } from "sonner";
import { api, errorMessage } from "@/lib/client/api";
import { createClient } from "@/lib/supabase/client";
import { useI18n } from "@/lib/i18n";
import type { Folder, Note, Preferences, Profile, TagWithCount, UserSettings } from "@/lib/types";

export interface RemoteNoteChange {
  id: string;
  version: number;
  deleted: boolean;
}

interface WorkspaceValue {
  profile: Profile;
  setProfile: (p: Profile) => void;
  settings: UserSettings;
  updateSettings: (patch: Partial<Omit<UserSettings, "preferences">> & { preferences?: Preferences }) => Promise<boolean>;
  folders: Folder[] | null;
  tags: TagWithCount[] | null;
  refreshFolders: () => Promise<void>;
  refreshTags: () => Promise<void>;
  /** Bumped whenever the note list should be refetched. */
  notesRevision: number;
  invalidateNotes: () => void;
  onRemoteNoteChange: (cb: (change: RemoteNoteChange) => void) => () => void;
  createNote: (input?: { folder_id?: string | null; tags?: string[]; is_favorite?: boolean }) => Promise<Note | null>;
  shortcutsOpen: boolean;
  setShortcutsOpen: (open: boolean) => void;
  drawerOpen: boolean;
  setDrawerOpen: (open: boolean) => void;
}

const WorkspaceContext = createContext<WorkspaceValue | null>(null);

export function useWorkspace() {
  const ctx = useContext(WorkspaceContext);
  if (!ctx) throw new Error("useWorkspace must be used inside WorkspaceProvider");
  return ctx;
}

function applyFont(font: Preferences["font"]) {
  const value = font ?? "sans";
  document.documentElement.dataset.font = value;
  document.cookie = `font=${value}; path=/; max-age=31536000; samesite=lax`;
}

export function WorkspaceProvider({
  initialProfile,
  initialSettings,
  children,
}: {
  initialProfile: Profile;
  initialSettings: UserSettings;
  children: React.ReactNode;
}) {
  const { t, locale, setLocale } = useI18n();
  const { setTheme } = useTheme();
  const [profile, setProfile] = useState(initialProfile);
  const [settings, setSettings] = useState(initialSettings);
  const [folders, setFolders] = useState<Folder[] | null>(null);
  const [tags, setTags] = useState<TagWithCount[] | null>(null);
  const [notesRevision, setNotesRevision] = useState(0);
  const [shortcutsOpen, setShortcutsOpen] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const listeners = useRef(new Set<(c: RemoteNoteChange) => void>());

  // Apply persisted preferences once (server is the source of truth).
  useEffect(() => {
    setTheme(initialSettings.theme);
    applyFont(initialSettings.preferences.font);
    if (initialSettings.language !== locale) setLocale(initialSettings.language);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const refreshFolders = useCallback(async () => {
    try {
      setFolders(await api<Folder[]>("/api/folders"));
    } catch {
      setFolders((f) => f ?? []);
    }
  }, []);

  const refreshTags = useCallback(async () => {
    try {
      setTags(await api<TagWithCount[]>("/api/tags"));
    } catch {
      setTags((tg) => tg ?? []);
    }
  }, []);

  useEffect(() => {
    void refreshFolders();
    void refreshTags();
  }, [refreshFolders, refreshTags]);

  const invalidateNotes = useCallback(() => setNotesRevision((r) => r + 1), []);

  const updateSettings = useCallback<WorkspaceValue["updateSettings"]>(
    async (patch) => {
      try {
        const next = await api<UserSettings>("/api/settings", { method: "PATCH", json: patch });
        setSettings(next);
        if (patch.theme) setTheme(next.theme);
        if (patch.language) setLocale(next.language);
        if (patch.preferences?.font !== undefined) applyFont(next.preferences.font);
        return true;
      } catch (err) {
        toast.error(errorMessage(err, t("toast.error")));
        return false;
      }
    },
    [setLocale, setTheme, t],
  );

  const createNote = useCallback<WorkspaceValue["createNote"]>(
    async (input = {}) => {
      try {
        const note = await api<Note>("/api/notes", { method: "POST", json: input });
        invalidateNotes();
        if (input.tags?.length) void refreshTags();
        if (input.folder_id) void refreshFolders();
        return note;
      } catch (err) {
        toast.error(errorMessage(err, t("toast.error")));
        return null;
      }
    },
    [invalidateNotes, refreshFolders, refreshTags, t],
  );

  const onRemoteNoteChange = useCallback((cb: (c: RemoteNoteChange) => void) => {
    listeners.current.add(cb);
    return () => listeners.current.delete(cb);
  }, []);

  // Realtime: other tabs/devices editing this user's notes.
  useEffect(() => {
    const supabase = createClient();
    let refreshTimer: ReturnType<typeof setTimeout> | undefined;
    let debounce: ReturnType<typeof setTimeout> | undefined;
    let cancelled = false;

    const authorise = async () => {
      try {
        const { access_token, expires_at } = await api<{ access_token: string; expires_at: number | null }>(
          "/api/session/realtime-token",
        );
        if (cancelled) return;
        await supabase.realtime.setAuth(access_token);
        const ms = expires_at ? expires_at * 1000 - Date.now() - 60_000 : 30 * 60_000;
        refreshTimer = setTimeout(authorise, Math.max(30_000, ms));
      } catch {
        refreshTimer = setTimeout(authorise, 60_000);
      }
    };

    const channel = supabase.channel(`notes:${initialProfile.id}`).on(
      "postgres_changes",
      { event: "*", schema: "public", table: "notes", filter: `user_id=eq.${initialProfile.id}` },
      (payload) => {
        const row = (payload.new && Object.keys(payload.new).length ? payload.new : payload.old) as {
          id?: string;
          version?: number;
        };
        if (row?.id) {
          const change = { id: row.id, version: row.version ?? 0, deleted: payload.eventType === "DELETE" };
          listeners.current.forEach((cb) => cb(change));
        }
        clearTimeout(debounce);
        debounce = setTimeout(() => {
          invalidateNotes();
          void refreshTags();
          void refreshFolders();
        }, 600);
      },
    );

    void authorise().then(() => {
      if (!cancelled) channel.subscribe();
    });

    return () => {
      cancelled = true;
      clearTimeout(refreshTimer);
      clearTimeout(debounce);
      void supabase.removeChannel(channel);
    };
  }, [initialProfile.id, invalidateNotes, refreshFolders, refreshTags]);

  const value = useMemo<WorkspaceValue>(
    () => ({
      profile,
      setProfile,
      settings,
      updateSettings,
      folders,
      tags,
      refreshFolders,
      refreshTags,
      notesRevision,
      invalidateNotes,
      onRemoteNoteChange,
      createNote,
      shortcutsOpen,
      setShortcutsOpen,
      drawerOpen,
      setDrawerOpen,
    }),
    [
      profile, settings, updateSettings, folders, tags, refreshFolders, refreshTags,
      notesRevision, invalidateNotes, onRemoteNoteChange, createNote, shortcutsOpen, drawerOpen,
    ],
  );

  return <WorkspaceContext.Provider value={value}>{children}</WorkspaceContext.Provider>;
}
