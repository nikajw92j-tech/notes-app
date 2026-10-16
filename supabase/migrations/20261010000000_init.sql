-- =====================================================================
-- Notes app — initial schema
-- Tables, constraints, indexes, triggers, RLS, storage buckets/policies,
-- realtime publication.
-- =====================================================================

-- ---------------------------------------------------------------------
-- Helpers
-- ---------------------------------------------------------------------
create or replace function public.touch_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

-- ---------------------------------------------------------------------
-- profiles
-- avatar_url holds the object path inside the private "avatars" bucket
-- (e.g. "<user_id>/<uuid>.png"); it is served through /api/files/avatars/…
-- ---------------------------------------------------------------------
create table public.profiles (
  id          uuid primary key references auth.users (id) on delete cascade,
  email       text not null,
  username    text unique
              check (username ~ '^[A-Za-z0-9_]{3,30}$'),
  avatar_url  text check (char_length(avatar_url) <= 300),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create trigger profiles_touch before update on public.profiles
  for each row execute function public.touch_updated_at();

-- ---------------------------------------------------------------------
-- user_settings
-- ---------------------------------------------------------------------
create table public.user_settings (
  user_id     uuid primary key references auth.users (id) on delete cascade,
  theme       text not null default 'system'
              check (theme in ('light', 'dark', 'system')),
  language    text not null default 'en'
              check (language in ('en', 'ka', 'ru')),
  preferences jsonb not null default '{}'::jsonb
              check (jsonb_typeof(preferences) = 'object'),
  updated_at  timestamptz not null default now()
);

create trigger user_settings_touch before update on public.user_settings
  for each row execute function public.touch_updated_at();

-- ---------------------------------------------------------------------
-- folders
-- ---------------------------------------------------------------------
create table public.folders (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null default auth.uid()
              references auth.users (id) on delete cascade,
  name        text not null check (char_length(btrim(name)) between 1 and 60),
  color       text not null default '#335CFF'
              check (color ~ '^#[0-9A-Fa-f]{6}$'),
  created_at  timestamptz not null default now(),
  -- lets child tables reference (id, user_id) so a row can only point at
  -- a folder owned by the same user
  unique (id, user_id)
);

create unique index folders_user_name_key on public.folders (user_id, lower(name));

-- ---------------------------------------------------------------------
-- notes
-- content       sanitized HTML produced by the TipTap editor
-- content_text  plain-text projection used for full-text search
-- version       optimistic-concurrency counter, bumped on title/content edits
-- ---------------------------------------------------------------------
create table public.notes (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null default auth.uid()
                  references auth.users (id) on delete cascade,
  folder_id       uuid,
  title           text not null default '' check (char_length(title) <= 200),
  content         text not null default '' check (char_length(content) <= 1000000),
  content_text    text not null default '' check (char_length(content_text) <= 1000000),
  is_pinned       boolean not null default false,
  is_favorite     boolean not null default false,
  is_archived     boolean not null default false,
  deleted_at      timestamptz,
  last_opened_at  timestamptz,
  version         integer not null default 1,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  excerpt         text generated always as (left(content_text, 160)) stored,
  search_vector   tsvector generated always as (
                    setweight(to_tsvector('simple', coalesce(title, '')), 'A') ||
                    setweight(to_tsvector('simple', coalesce(content_text, '')), 'B')
                  ) stored,
  unique (id, user_id),
  constraint notes_folder_fk foreign key (folder_id, user_id)
    references public.folders (id, user_id) on delete set null (folder_id)
);

create index notes_user_active_updated_idx
  on public.notes (user_id, is_pinned desc, updated_at desc)
  where deleted_at is null;
create index notes_user_deleted_idx
  on public.notes (user_id, deleted_at desc)
  where deleted_at is not null;
create index notes_user_opened_idx
  on public.notes (user_id, last_opened_at desc)
  where last_opened_at is not null and deleted_at is null;
create index notes_folder_idx on public.notes (folder_id) where folder_id is not null;
create index notes_search_idx on public.notes using gin (search_vector);

create or replace function public.notes_before_update()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  -- ownership and identity are immutable
  new.id := old.id;
  new.user_id := old.user_id;
  new.created_at := old.created_at;

  if new.title is distinct from old.title
     or new.content is distinct from old.content then
    new.version := old.version + 1;
    new.updated_at := now();
  elsif new.folder_id is distinct from old.folder_id then
    new.version := old.version;
    new.updated_at := now();
  else
    -- pin / favorite / archive / trash / open do not count as edits
    new.version := old.version;
    new.updated_at := old.updated_at;
  end if;
  return new;
end;
$$;

create trigger notes_before_update before update on public.notes
  for each row execute function public.notes_before_update();

-- ---------------------------------------------------------------------
-- tags + note_tags
-- note_tags carries user_id so both FKs can enforce same-owner rows and
-- RLS stays a cheap equality check.
-- ---------------------------------------------------------------------
create table public.tags (
  id       uuid primary key default gen_random_uuid(),
  user_id  uuid not null default auth.uid()
           references auth.users (id) on delete cascade,
  name     text not null check (char_length(btrim(name)) between 1 and 30),
  unique (id, user_id)
);

create unique index tags_user_name_key on public.tags (user_id, lower(name));

create table public.note_tags (
  note_id  uuid not null,
  tag_id   uuid not null,
  user_id  uuid not null default auth.uid()
           references auth.users (id) on delete cascade,
  primary key (note_id, tag_id),
  foreign key (note_id, user_id) references public.notes (id, user_id) on delete cascade,
  foreign key (tag_id, user_id) references public.tags (id, user_id) on delete cascade
);

create index note_tags_tag_idx on public.note_tags (tag_id);
create index note_tags_user_idx on public.note_tags (user_id);

-- Replace a note's tags atomically. Runs as the caller, so RLS applies.
create or replace function public.set_note_tags(p_note_id uuid, p_names text[])
returns void
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_names text[];
begin
  if v_uid is null then
    raise exception 'not authenticated' using errcode = '28000';
  end if;

  if not exists (select 1 from public.notes where id = p_note_id and user_id = v_uid) then
    raise exception 'note not found' using errcode = 'P0002';
  end if;

  select coalesce(array_agg(n), '{}') into v_names
  from (
    select distinct on (lower(btrim(x))) btrim(x) as n
    from unnest(coalesce(p_names, '{}')) as x
    where btrim(x) <> ''
  ) s;

  insert into public.tags (user_id, name)
  select v_uid, n from unnest(v_names) as n
  on conflict (user_id, lower(name)) do nothing;

  delete from public.note_tags nt
  where nt.note_id = p_note_id
    and nt.tag_id not in (
      select t.id from public.tags t
      where t.user_id = v_uid
        and lower(t.name) in (select lower(n) from unnest(v_names) as n)
    );

  insert into public.note_tags (note_id, tag_id, user_id)
  select p_note_id, t.id, v_uid
  from public.tags t
  where t.user_id = v_uid
    and lower(t.name) in (select lower(n) from unnest(v_names) as n)
  on conflict do nothing;

  perform public.cleanup_orphan_tags();
end;
$$;

create or replace function public.cleanup_orphan_tags()
returns void
language sql
security invoker
set search_path = ''
as $$
  delete from public.tags t
  where t.user_id = auth.uid()
    and not exists (select 1 from public.note_tags nt where nt.tag_id = t.id);
$$;

-- ---------------------------------------------------------------------
-- New user bootstrap: profile + settings rows
-- ---------------------------------------------------------------------
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, email)
  values (new.id, coalesce(new.email, ''))
  on conflict (id) do nothing;

  insert into public.user_settings (user_id)
  values (new.id)
  on conflict (user_id) do nothing;

  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- keep profile email in sync when the auth email changes
create or replace function public.handle_user_email_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.email is distinct from old.email then
    update public.profiles set email = coalesce(new.email, '') where id = new.id;
  end if;
  return new;
end;
$$;

create trigger on_auth_user_email_changed
  after update of email on auth.users
  for each row execute function public.handle_user_email_change();

-- ---------------------------------------------------------------------
-- Row Level Security
-- ---------------------------------------------------------------------
alter table public.profiles      enable row level security;
alter table public.user_settings enable row level security;
alter table public.folders       enable row level security;
alter table public.notes         enable row level security;
alter table public.tags          enable row level security;
alter table public.note_tags     enable row level security;

-- profiles: read/update own row; rows are created by trigger, deleted by cascade
create policy "profiles_select_own" on public.profiles
  for select to authenticated using (id = (select auth.uid()));
create policy "profiles_update_own" on public.profiles
  for update to authenticated
  using (id = (select auth.uid())) with check (id = (select auth.uid()));

-- user_settings
create policy "settings_select_own" on public.user_settings
  for select to authenticated using (user_id = (select auth.uid()));
create policy "settings_insert_own" on public.user_settings
  for insert to authenticated with check (user_id = (select auth.uid()));
create policy "settings_update_own" on public.user_settings
  for update to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

-- folders, notes, tags, note_tags: full CRUD on own rows only
do $$
declare
  t text;
begin
  foreach t in array array['folders', 'notes', 'tags', 'note_tags'] loop
    execute format(
      'create policy %I on public.%I for select to authenticated using (user_id = (select auth.uid()))',
      t || '_select_own', t);
    execute format(
      'create policy %I on public.%I for insert to authenticated with check (user_id = (select auth.uid()))',
      t || '_insert_own', t);
    execute format(
      'create policy %I on public.%I for update to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()))',
      t || '_update_own', t);
    execute format(
      'create policy %I on public.%I for delete to authenticated using (user_id = (select auth.uid()))',
      t || '_delete_own', t);
  end loop;
end;
$$;

-- anon gets nothing
revoke all on public.profiles, public.user_settings, public.folders,
              public.notes, public.tags, public.note_tags from anon;
revoke execute on function public.set_note_tags(uuid, text[]) from anon, public;
revoke execute on function public.cleanup_orphan_tags() from anon, public;
grant execute on function public.set_note_tags(uuid, text[]) to authenticated;
grant execute on function public.cleanup_orphan_tags() to authenticated;
revoke execute on function public.handle_new_user() from anon, authenticated, public;
revoke execute on function public.handle_user_email_change() from anon, authenticated, public;

-- ---------------------------------------------------------------------
-- Realtime: stream note changes (RLS is applied per subscriber)
-- ---------------------------------------------------------------------
alter publication supabase_realtime add table public.notes;

-- ---------------------------------------------------------------------
-- Storage: private buckets, objects namespaced by "<user_id>/…"
-- ---------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  ('note-images', 'note-images', false, 4194304,
   array['image/png', 'image/jpeg', 'image/gif', 'image/webp']),
  ('avatars', 'avatars', false, 2097152,
   array['image/png', 'image/jpeg', 'image/webp'])
on conflict (id) do update
  set public = excluded.public,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

create policy "own_files_select" on storage.objects
  for select to authenticated
  using (bucket_id in ('note-images', 'avatars')
         and (storage.foldername(name))[1] = (select auth.uid())::text);

create policy "own_files_insert" on storage.objects
  for insert to authenticated
  with check (bucket_id in ('note-images', 'avatars')
              and (storage.foldername(name))[1] = (select auth.uid())::text);

create policy "own_files_update" on storage.objects
  for update to authenticated
  using (bucket_id in ('note-images', 'avatars')
         and (storage.foldername(name))[1] = (select auth.uid())::text)
  with check (bucket_id in ('note-images', 'avatars')
              and (storage.foldername(name))[1] = (select auth.uid())::text);

create policy "own_files_delete" on storage.objects
  for delete to authenticated
  using (bucket_id in ('note-images', 'avatars')
         and (storage.foldername(name))[1] = (select auth.uid())::text);
