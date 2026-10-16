export type Theme = "light" | "dark" | "system";
export type Locale = "en" | "ka" | "ru";
export type FontTheme = "sans" | "serif" | "mono";

export const NOTE_VIEWS = ["all", "favorites", "recent", "archived", "trash"] as const;
export type NoteView = (typeof NOTE_VIEWS)[number];

export const NOTE_SORTS = ["updated", "created", "title", "opened"] as const;
export type NoteSort = (typeof NOTE_SORTS)[number];

export interface Tag {
  id: string;
  name: string;
}

export interface TagWithCount extends Tag {
  note_count: number;
}

export interface Folder {
  id: string;
  name: string;
  color: string;
  created_at: string;
  note_count?: number;
}

/** Lightweight note shape used in lists. */
export interface NoteSummary {
  id: string;
  title: string;
  folder_id: string | null;
  is_pinned: boolean;
  is_favorite: boolean;
  is_archived: boolean;
  deleted_at: string | null;
  last_opened_at: string | null;
  version: number;
  created_at: string;
  updated_at: string;
  excerpt: string;
  tags: Tag[];
}

export interface Note extends NoteSummary {
  content: string;
}

export interface NoteListResponse {
  items: NoteSummary[];
  nextPage: number | null;
}

export interface Preferences {
  font?: FontTheme;
  sort?: NoteSort;
}

export interface UserSettings {
  theme: Theme;
  language: Locale;
  preferences: Preferences;
}

export interface Profile {
  id: string;
  email: string;
  username: string | null;
  avatar_url: string | null;
  /** Same-origin URL that serves the private avatar, or null. */
  avatar_src: string | null;
  providers: string[];
  created_at: string;
}

export interface StoredFile {
  name: string;
  path: string;
  src: string;
  size: number;
  created_at: string | null;
}

export interface ApiErrorBody {
  error: { code: string; message: string; details?: unknown };
}
