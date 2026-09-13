-- =====================================================================
-- DU Korean Program — database schema + Row Level Security
-- Run this once in Supabase Dashboard → SQL Editor (safe to re-run).
-- =====================================================================

-- ---------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------

-- Public profile that extends auth.users (1:1).
create table if not exists public.users (
  id           uuid primary key references auth.users (id) on delete cascade,
  name         text not null default '',
  email        text not null,
  role         text not null default 'student' check (role in ('student', 'admin')),
  korean_level text not null default '' check (char_length(korean_level) <= 200),
  goals        text not null default '' check (char_length(goals) <= 2000),
  created_at   timestamptz not null default now()
);

-- Profile photo + one-line bio (added later, so ALTER keeps existing databases working).
-- avatar_url stores the object path inside the "avatars" Storage bucket
-- (e.g. "<user id>/1726000000000.jpg"), not a full URL, and may only point
-- at the user's own folder.
alter table public.users add column if not exists avatar_url text;
alter table public.users add column if not exists bio text not null default '';

alter table public.users drop constraint if exists users_avatar_url_check;
alter table public.users add constraint users_avatar_url_check
  check (avatar_url is null or avatar_url ~ ('^' || id::text || '/[A-Za-z0-9_.-]{1,100}$'));

alter table public.users drop constraint if exists users_bio_check;
alter table public.users add constraint users_bio_check check (char_length(bio) <= 160);

-- One row per user per week. week_start is the Monday (America/Denver calendar).
-- available_slots: [{"day": "monday", "time": "10:00"}, ...] in Denver wall-clock time.
create table if not exists public.availability (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null references public.users (id) on delete cascade,
  week_start      date not null check (extract(isodow from week_start) = 1),
  available_slots jsonb not null default '[]'::jsonb
                  check (jsonb_typeof(available_slots) = 'array' and jsonb_array_length(available_slots) <= 182),
  updated_at      timestamptz not null default now(),
  unique (user_id, week_start)
);

-- One editable lesson request per student.
create table if not exists public.topic_requests (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null unique references public.users (id) on delete cascade,
  content    text not null default '' check (char_length(content) <= 5000),
  updated_at timestamptz not null default now()
);

create index if not exists availability_week_start_idx on public.availability (week_start);

-- ---------------------------------------------------------------------
-- updated_at maintenance
-- ---------------------------------------------------------------------
create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists availability_set_updated_at on public.availability;
create trigger availability_set_updated_at
  before update on public.availability
  for each row execute function public.set_updated_at();

drop trigger if exists topic_requests_set_updated_at on public.topic_requests;
create trigger topic_requests_set_updated_at
  before update on public.topic_requests
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------
-- Auto-create a profile on sign-up. Jay's email becomes admin automatically.
-- ---------------------------------------------------------------------
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.users (id, name, email, role)
  values (
    new.id,
    coalesce(nullif(trim(new.raw_user_meta_data ->> 'name'), ''), split_part(new.email, '@', 1)),
    new.email,
    case when lower(new.email) = 'blackskirtariel@gmail.com' then 'admin' else 'student' end
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Backfill profiles for accounts created before this script ran.
insert into public.users (id, name, email, role)
select
  u.id,
  coalesce(nullif(trim(u.raw_user_meta_data ->> 'name'), ''), split_part(u.email, '@', 1)),
  u.email,
  case when lower(u.email) = 'blackskirtariel@gmail.com' then 'admin' else 'student' end
from auth.users u
on conflict (id) do nothing;

-- ---------------------------------------------------------------------
-- Role helper. SECURITY DEFINER so policies on public.users can call it
-- without recursing into their own RLS.
-- ---------------------------------------------------------------------
create or replace function public.is_admin(uid uuid default auth.uid())
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (select 1 from public.users where id = uid and role = 'admin');
$$;

-- ---------------------------------------------------------------------
-- Privileges: nothing for anonymous visitors; signed-in users may only
-- edit their own name / level / goals / photo / bio (never role or email).
-- ---------------------------------------------------------------------
revoke all on public.users, public.availability, public.topic_requests from anon;

revoke insert, update, delete on public.users from authenticated;
grant select on public.users to authenticated;
grant update (name, korean_level, goals, avatar_url, bio) on public.users to authenticated;

grant select, insert, update, delete on public.availability to authenticated;
grant select, insert, update, delete on public.topic_requests to authenticated;

-- ---------------------------------------------------------------------
-- Row Level Security
-- ---------------------------------------------------------------------
alter table public.users          enable row level security;
alter table public.availability   enable row level security;
alter table public.topic_requests enable row level security;

-- users: read yourself; admin reads everyone. Update only yourself.
drop policy if exists "users_select_self_or_admin" on public.users;
create policy "users_select_self_or_admin" on public.users
  for select to authenticated
  using (id = (select auth.uid()) or (select public.is_admin()));

drop policy if exists "users_update_self" on public.users;
create policy "users_update_self" on public.users
  for update to authenticated
  using (id = (select auth.uid()))
  with check (id = (select auth.uid()));

-- availability: read your own rows + the admin's rows (so students can see
-- recommended times); admin reads everything. Write only your own rows.
drop policy if exists "availability_select" on public.availability;
create policy "availability_select" on public.availability
  for select to authenticated
  using (
    user_id = (select auth.uid())
    or (select public.is_admin())
    or public.is_admin(user_id)
  );

drop policy if exists "availability_insert_own" on public.availability;
create policy "availability_insert_own" on public.availability
  for insert to authenticated
  with check (user_id = (select auth.uid()));

drop policy if exists "availability_update_own" on public.availability;
create policy "availability_update_own" on public.availability
  for update to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

drop policy if exists "availability_delete_own" on public.availability;
create policy "availability_delete_own" on public.availability
  for delete to authenticated
  using (user_id = (select auth.uid()));

-- topic_requests: read/write your own; admin reads everything.
drop policy if exists "topic_requests_select" on public.topic_requests;
create policy "topic_requests_select" on public.topic_requests
  for select to authenticated
  using (user_id = (select auth.uid()) or (select public.is_admin()));

drop policy if exists "topic_requests_insert_own" on public.topic_requests;
create policy "topic_requests_insert_own" on public.topic_requests
  for insert to authenticated
  with check (user_id = (select auth.uid()));

drop policy if exists "topic_requests_update_own" on public.topic_requests;
create policy "topic_requests_update_own" on public.topic_requests
  for update to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

drop policy if exists "topic_requests_delete_own" on public.topic_requests;
create policy "topic_requests_delete_own" on public.topic_requests
  for delete to authenticated
  using (user_id = (select auth.uid()));

-- ---------------------------------------------------------------------
-- Storage: profile photos ("avatars" bucket)
-- Public bucket, so <img> tags can load photos without signed URLs. Files live
-- at "<user id>/<timestamp>.jpg" and users can only write inside their own
-- folder. Listing/API reads: yourself or the admin.
-- ---------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('avatars', 'avatars', true, 2097152, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do update
  set public = excluded.public,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "avatars_select_own_or_admin" on storage.objects;
create policy "avatars_select_own_or_admin" on storage.objects
  for select to authenticated
  using (
    bucket_id = 'avatars'
    and ((storage.foldername(name))[1] = (select auth.uid())::text or (select public.is_admin()))
  );

drop policy if exists "avatars_insert_own" on storage.objects;
create policy "avatars_insert_own" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'avatars' and (storage.foldername(name))[1] = (select auth.uid())::text);

drop policy if exists "avatars_update_own" on storage.objects;
create policy "avatars_update_own" on storage.objects
  for update to authenticated
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = (select auth.uid())::text)
  with check (bucket_id = 'avatars' and (storage.foldername(name))[1] = (select auth.uid())::text);

drop policy if exists "avatars_delete_own" on storage.objects;
create policy "avatars_delete_own" on storage.objects
  for delete to authenticated
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = (select auth.uid())::text);
