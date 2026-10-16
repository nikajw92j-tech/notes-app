# Notes — full-stack note-taking app

Next.js 15 (App Router) · TypeScript · Tailwind CSS v4 · Framer Motion · TipTap · Supabase (Postgres, Auth, Storage, Realtime) · Zod · Vercel.

The UI follows the Frontend Mentor **Note-taking web app** design system (Inter / Noto Serif / Source Code Pro, blue `#335CFF`, neutral scale, 3-column desktop layout, bottom nav on mobile). All design tokens live in [`src/app/globals.css`](src/app/globals.css). Exact values can be swapped there if they differ from the Figma file.

---

## Features

| Area | What is implemented |
|---|---|
| Notes | Create, edit, duplicate, pin, favourite, archive, trash/restore, permanent delete (with confirmation), empty trash, folders, tags, sort (modified / created / title / opened), paginated lists |
| Editor | TipTap: H1–H3, bold/italic/underline, highlight, bullet/numbered lists, checklists, quotes, code blocks, links, tables (resizable), images (upload, paste, drop), undo/redo, keyboard shortcuts, word & character count |
| Saving | Debounced autosave with Saving / Saved / Error / Offline / Conflict states; one request in flight at a time; retry with backoff; optimistic locking (`version`) so stale tabs can't overwrite newer content; local crash-recovery draft; flush on tab hide / unload |
| Realtime | Supabase Realtime on `notes`: lists refresh and an open note reloads when it changes on another device |
| Search | Postgres full-text search (`tsvector` + GIN, title weighted above content, prefix matching), works with Georgian & Cyrillic; combinable with view/folder/tag filters |
| Auth | Email + password sign-up with email verification, login, Google OAuth, forgot/reset password, change password, logout, account deletion; HttpOnly session cookies refreshed by middleware; protected routes |
| Files | Private Supabase Storage buckets; note images & avatars; server-side size + magic-byte type checks; owner-only access via `/api/files/...` (short-lived signed URL redirect); file manager in Settings |
| Settings | Profile (username, avatar), colour theme (light/dark/system), font theme (sans/serif/mono), language (English / ქართული / Русский), password, uploaded files, delete account, all persisted in `user_settings` |
| UX | Responsive (mobile, tablet, desktop), dark mode, animated sidebar/drawer, dialogs, menus, list transitions, skeleton loaders, empty states, toasts with Undo, keyboard navigation, focus management, reduced-motion support |

### Keyboard shortcuts

`N` or `Ctrl/⌘+Alt+N` new note · `/` or `Ctrl/⌘+K` search · `Ctrl/⌘+S` save now · `?` shortcut list · `Esc` close. Editor: `Ctrl/⌘+B/I/U`, `Ctrl/⌘+Shift+L` link, `Ctrl/⌘+Shift+9` checklist, `Ctrl/⌘+Z` / `Ctrl/⌘+Shift+Z`.

---

## Architecture

```
supabase/migrations/        SQL schema, RLS, triggers, storage buckets & policies, realtime
src/middleware.ts           session refresh + route protection
src/lib/
  supabase/                 server (cookie / bearer), browser (realtime only), admin (account deletion)
  services/                 notes, folders+tags, account (profile/settings), storage — all DB logic
  api.ts                    route wrapper: auth, CSRF origin check, rate limit, Zod & DB error mapping
  validation.ts             Zod schemas for every input
  sanitize.ts               server-side HTML sanitisation of note content
  autosave.ts               SaveQueue (sequential, debounced, versioned autosave)
  actions/auth.ts           Server Actions for all auth flows
  i18n/                     en / ka / ru dictionaries (type-checked for completeness)
src/app/api/                REST endpoints (below)
src/app/(auth)/             login, signup, forgot-password, reset-password
src/app/(app)/              notes, settings (protected)
src/components/             UI primitives, app shell, notes workspace, editor, settings
tests/unit                  autosave, sanitisation, validation, search, uploads, rate limit
tests/integration           RLS / storage isolation (direct to Supabase) and REST API (running app)
```

**Why no Prisma?** All data access goes through Supabase with the *user's* JWT, so Postgres RLS is enforced on every query as a second line of defence behind the explicit `user_id` filters in the services. An ORM connecting with a privileged database role would bypass RLS.

### REST API

All endpoints require auth (session cookie, or `Authorization: Bearer <access_token>`), validate input with Zod, and return `{ error: { code, message } }` on failure. Another user's resource is always reported as `404`.

| Method | Endpoint | Function |
|---|---|---|
| GET | `/api/notes?view=&folder=&tag=&q=&sort=&page=&limit=` | List notes (`view`: all, favorites, recent, archived, trash) |
| POST | `/api/notes` | Create note |
| GET | `/api/notes/:id` | Get note |
| PATCH | `/api/notes/:id` | Update (send `expected_version` with title/content → `409 version_conflict` if stale) |
| DELETE | `/api/notes/:id` | Move to trash |
| POST | `/api/notes/:id/restore` | Restore from trash |
| DELETE | `/api/notes/:id/permanent` | Permanently delete (must be in trash) |
| POST | `/api/notes/:id/duplicate` | Duplicate |
| POST | `/api/notes/:id/open` | Record "recently opened" |
| DELETE | `/api/trash` | Empty trash |
| GET / POST | `/api/folders` | List (with counts) / create |
| PATCH / DELETE | `/api/folders/:id` | Rename or recolour / delete (notes kept) |
| GET | `/api/tags` | List tags with counts |
| GET | `/api/search?q=` | Full-text search (+ same filters as list) |
| GET / PATCH | `/api/profile` | Profile |
| POST / DELETE | `/api/profile/avatar` | Upload / remove avatar |
| GET / PATCH | `/api/settings` | Theme, language, preferences |
| POST | `/api/uploads` | Upload note image (multipart `file`) |
| GET | `/api/files?bucket=` | List own files |
| GET / DELETE | `/api/files/:bucket/:userId/:file` | Serve (redirect to signed URL) / delete own file |
| DELETE | `/api/account` | Delete account (`{ "confirm": "DELETE" }`) |
| GET | `/api/session/realtime-token` | Short-lived access token for the Realtime socket |

### Security

- RLS on every table (`user_id = auth.uid()`); composite foreign keys stop a note from referencing another user's folder or tag; triggers make `user_id` immutable.
- Private storage buckets with per-user folder policies; uploads checked by size and magic bytes server-side.
- Note HTML sanitised on the server (allow-list), links forced to `rel="noopener noreferrer nofollow"`, images restricted to our file route or https.
- HttpOnly + Secure + SameSite=Lax session cookies; Origin check on mutating requests; CSP and security headers ([`next.config.ts`](next.config.ts)).
- Rate limits on auth actions, uploads, writes and account deletion (in-memory per instance; see note in [`src/lib/rate-limit.ts`](src/lib/rate-limit.ts). Supabase Auth adds its own project-wide limits).
- The service-role key is only read server-side, and only for account deletion.

---

## Setup

### 1. Supabase project

1. Create a project at <https://supabase.com/dashboard>.
2. Apply the migration, using either option:
   - **CLI:** `npx supabase login` → `npx supabase link --project-ref <ref>` → `npm run db:push`
   - **Dashboard:** SQL Editor → paste [`supabase/migrations/20261010000000_init.sql`](supabase/migrations/20261010000000_init.sql) → Run.
3. **Authentication → URL Configuration**
   - Site URL: `http://localhost:3000` (later your production URL)
   - Redirect URLs: `http://localhost:3000/**` and `https://<your-domain>/**`
4. **Authentication → Providers → Email**: keep "Confirm email" on.
5. *(Recommended, cross-device links)* **Authentication → Email Templates**, replace the link in:
   - *Confirm signup*: `{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=email&next=/notes`
   - *Reset password*: `{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=recovery&next=/reset-password`

   The default templates also work (via `/auth/callback`), but only in the same browser that started the flow.
6. **Google sign-in**: create an OAuth client in Google Cloud Console (Web application). Set the authorised redirect URI to `https://<ref>.supabase.co/auth/v1/callback`. Then enable **Authentication → Providers → Google** with the client ID and secret.
7. Production email: configure custom SMTP (Authentication → SMTP); the built-in sender is heavily rate-limited.

### 2. Run locally

```bash
cp .env.example .env.local     # fill in URL, anon key, service-role key
npm install
npm run dev                    # http://localhost:3000
```

### 3. Checks

```bash
npm run check                  # typecheck + lint + unit tests + production build
npm run test:integration       # needs TEST_* env vars and `npm run dev` pointed at the TEST project
```

---

## Deploy to Vercel

1. Push the repo to GitHub.
2. Vercel → **Add New Project** → import the repo (framework auto-detected: Next.js).
3. Add environment variables (Production + Preview): `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `NEXT_PUBLIC_SITE_URL=https://<your-domain>`.
4. Deploy. Then in Supabase add `https://<your-domain>/**` to Redirect URLs and set Site URL to the production domain.
5. Optional: Supabase's Vercel integration can sync the env vars automatically.

### Production smoke test

1. Sign up → confirmation email → link lands on `/notes`.
2. Create a note, type, wait for **Saved**, refresh, and check the content is still there.
3. Open the same note in a second browser and edit it: the first browser updates live. Edit both at once and check the conflict banner appears.
4. Upload an image, then open its URL in a private window: you should get `401`.
5. Search, folders, tags, archive, trash/restore, permanent delete.
6. Settings: theme, font and language persist across devices; change password; Google login.
7. Log in as a second user and check none of the first user's data is visible.

---

## Known limits

- Rate limiting is per serverless instance; use Redis/Upstash for strict global limits.
- Note images are capped at 4 MB to stay under Vercel's 4.5 MB request-body limit.
- Deleting a note does not delete images it used (they may be shared by duplicates); manage them in **Settings → Uploaded Files**.
