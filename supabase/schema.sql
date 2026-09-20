-- =====================================================================
-- DU Korean Program — database schema + Row Level Security
-- Run this in Supabase Dashboard → SQL Editor. Safe to re-run: it also
-- upgrades databases created by earlier versions of this file.
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

-- Lesson requests: one per student per week (week_start = Monday, Denver calendar).
create table if not exists public.topic_requests (
  id                 uuid primary key default gen_random_uuid(),
  user_id            uuid not null references public.users (id) on delete cascade,
  week_start         date not null,
  main_topic         text not null,
  additional_details text not null default '',
  updated_at         timestamptz not null default now()
);

-- Upgrade from the original shape (a single free-text "content" per student):
-- the first line becomes main_topic, the rest additional_details, and the week
-- is the one the request was last edited in. Empty requests are dropped.
do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'topic_requests' and column_name = 'content'
  ) then
    alter table public.topic_requests add column if not exists week_start date;
    alter table public.topic_requests add column if not exists main_topic text;
    alter table public.topic_requests add column if not exists additional_details text not null default '';
    alter table public.topic_requests disable trigger user; -- keep original updated_at

    delete from public.topic_requests where btrim(content, E' \t\r\n') = '';

    update public.topic_requests t
    set week_start = (date_trunc('week', t.updated_at at time zone 'America/Denver'))::date,
        main_topic = case when char_length(m.first_line) <= 300 then m.first_line
                          else left(m.first_line, 299) || '…' end,
        additional_details = case when char_length(m.first_line) <= 300 then m.rest else m.body end
    from (
      select id,
             body,
             btrim(split_part(body, E'\n', 1), E' \t\r') as first_line,
             case when strpos(body, E'\n') > 0
                  then btrim(substr(body, strpos(body, E'\n') + 1), E' \t\r\n')
                  else '' end as rest
      from (select id, btrim(content, E' \t\r\n') as body from public.topic_requests) b
    ) m
    where m.id = t.id;

    alter table public.topic_requests enable trigger user;
    alter table public.topic_requests alter column week_start set not null;
    alter table public.topic_requests alter column main_topic set not null;
    alter table public.topic_requests drop constraint if exists topic_requests_user_id_key;
    alter table public.topic_requests drop column content;
  end if;
end;
$$;

alter table public.topic_requests drop constraint if exists topic_requests_week_monday_check;
alter table public.topic_requests add constraint topic_requests_week_monday_check
  check (extract(isodow from week_start) = 1);
alter table public.topic_requests drop constraint if exists topic_requests_main_topic_check;
alter table public.topic_requests add constraint topic_requests_main_topic_check
  check (char_length(btrim(main_topic)) between 1 and 300);
alter table public.topic_requests drop constraint if exists topic_requests_details_check;
alter table public.topic_requests add constraint topic_requests_details_check
  check (char_length(additional_details) <= 5000);
alter table public.topic_requests drop constraint if exists topic_requests_user_week_key;
alter table public.topic_requests add constraint topic_requests_user_week_key unique (user_id, week_start);

-- When the admin last looked at each area; drives the red dots in the admin navbar.
create table if not exists public.admin_seen (
  admin_id uuid not null references public.users (id) on delete cascade,
  area     text not null check (area in ('schedule', 'requests')),
  seen_at  timestamptz not null default now(),
  primary key (admin_id, area)
);

create index if not exists availability_week_start_idx on public.availability (week_start);
create index if not exists availability_updated_at_idx on public.availability (updated_at desc);
create index if not exists topic_requests_week_start_idx on public.topic_requests (week_start);
create index if not exists topic_requests_updated_at_idx on public.topic_requests (updated_at desc);

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
  for each row
  -- Only the student's text counts as an edit; ticking "read" must not look like one.
  when (old.main_topic is distinct from new.main_topic
        or old.additional_details is distinct from new.additional_details)
  execute function public.set_updated_at();

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
-- Helpers
-- ---------------------------------------------------------------------

-- Role check. SECURITY DEFINER so policies on public.users can call it
-- without recursing into their own RLS.
create or replace function public.is_admin(uid uuid default auth.uid())
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (select 1 from public.users where id = uid and role = 'admin');
$$;

-- Lesson requests can only be written for the current or next week (Denver calendar).
create or replace function public.is_editable_request_week(week date)
returns boolean
language sql
stable
set search_path = ''
as $$
  select week between (date_trunc('week', now() at time zone 'America/Denver'))::date
                  and (date_trunc('week', now() at time zone 'America/Denver'))::date + 7;
$$;

-- Admin marks an area as seen (uses the database clock, like updated_at).
create or replace function public.mark_admin_seen(seen_area text)
returns void
language sql
set search_path = ''
as $$
  insert into public.admin_seen (admin_id, area, seen_at)
  values (auth.uid(), seen_area, now())
  on conflict (admin_id, area) do update set seen_at = excluded.seen_at;
$$;

revoke all on function public.mark_admin_seen(text) from public, anon;
grant execute on function public.mark_admin_seen(text) to authenticated;

-- ---------------------------------------------------------------------
-- Privileges: nothing for anonymous visitors; signed-in users may only
-- edit their own name / level / goals / photo / bio (never role or email).
-- ---------------------------------------------------------------------
revoke all on public.users, public.availability, public.topic_requests, public.admin_seen from anon;

revoke insert, update, delete on public.users from authenticated;
grant select on public.users to authenticated;
grant update (name, korean_level, goals, avatar_url, bio) on public.users to authenticated;

grant select, insert, update, delete on public.availability to authenticated;
grant select, insert, update, delete on public.topic_requests to authenticated;
revoke delete on public.admin_seen from authenticated;
grant select, insert, update on public.admin_seen to authenticated;

-- ---------------------------------------------------------------------
-- Row Level Security
-- ---------------------------------------------------------------------
alter table public.users          enable row level security;
alter table public.availability   enable row level security;
alter table public.topic_requests enable row level security;
alter table public.admin_seen     enable row level security;

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

-- topic_requests: read all your own weeks; admin reads everything.
-- Write only your own rows, and only for the current or next week.
drop policy if exists "topic_requests_select" on public.topic_requests;
create policy "topic_requests_select" on public.topic_requests
  for select to authenticated
  using (user_id = (select auth.uid()) or (select public.is_admin()));

drop policy if exists "topic_requests_insert_own" on public.topic_requests;
create policy "topic_requests_insert_own" on public.topic_requests
  for insert to authenticated
  with check (user_id = (select auth.uid()) and public.is_editable_request_week(week_start));

drop policy if exists "topic_requests_update_own" on public.topic_requests;
create policy "topic_requests_update_own" on public.topic_requests
  for update to authenticated
  using (user_id = (select auth.uid()) and public.is_editable_request_week(week_start))
  with check (user_id = (select auth.uid()) and public.is_editable_request_week(week_start));

drop policy if exists "topic_requests_delete_own" on public.topic_requests;
create policy "topic_requests_delete_own" on public.topic_requests
  for delete to authenticated
  using (user_id = (select auth.uid()) and public.is_editable_request_week(week_start));

-- admin_seen: only the admin, only their own rows.
drop policy if exists "admin_seen_select" on public.admin_seen;
create policy "admin_seen_select" on public.admin_seen
  for select to authenticated
  using (admin_id = (select auth.uid()) and (select public.is_admin()));

drop policy if exists "admin_seen_insert" on public.admin_seen;
create policy "admin_seen_insert" on public.admin_seen
  for insert to authenticated
  with check (admin_id = (select auth.uid()) and (select public.is_admin()));

drop policy if exists "admin_seen_update" on public.admin_seen;
create policy "admin_seen_update" on public.admin_seen
  for update to authenticated
  using (admin_id = (select auth.uid()) and (select public.is_admin()))
  with check (admin_id = (select auth.uid()) and (select public.is_admin()));

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

-- =====================================================================
-- Fixed lessons, request read receipts, student deletion
-- =====================================================================

-- A lesson the admin pinned by hand from an overlapping slot. Students see
-- only the lessons they are part of.
create table if not exists public.fixed_lessons (
  id          uuid primary key default gen_random_uuid(),
  week_start  date not null,
  day         text not null,
  start_time  text not null,
  end_time    text not null,
  student_ids uuid[] not null default '{}',
  note        text not null default '',
  created_at  timestamptz not null default now()
);

alter table public.fixed_lessons drop constraint if exists fixed_lessons_week_monday_check;
alter table public.fixed_lessons add constraint fixed_lessons_week_monday_check
  check (extract(isodow from week_start) = 1);
alter table public.fixed_lessons drop constraint if exists fixed_lessons_day_check;
alter table public.fixed_lessons add constraint fixed_lessons_day_check
  check (day in ('monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'));
alter table public.fixed_lessons drop constraint if exists fixed_lessons_time_check;
alter table public.fixed_lessons add constraint fixed_lessons_time_check
  check (start_time ~ '^[0-2][0-9]:[0-5][0-9]$' and end_time ~ '^[0-2][0-9]:[0-5][0-9]$' and end_time > start_time);
alter table public.fixed_lessons drop constraint if exists fixed_lessons_note_check;
alter table public.fixed_lessons add constraint fixed_lessons_note_check check (char_length(note) <= 300);
alter table public.fixed_lessons drop constraint if exists fixed_lessons_slot_key;
alter table public.fixed_lessons add constraint fixed_lessons_slot_key unique (week_start, day, start_time);

create index if not exists fixed_lessons_week_idx on public.fixed_lessons (week_start);

-- When the admin ticked a lesson request as read (null = unread).
alter table public.topic_requests add column if not exists read_at timestamptz;

-- Admin-only: tick / untick a request. SECURITY DEFINER so students keep no
-- write access to read_at at all.
create or replace function public.set_request_read(request_id uuid, is_read boolean)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.is_admin() then
    raise exception 'Only the admin can mark requests as read';
  end if;
  update public.topic_requests
     set read_at = case when is_read then now() else null end
   where id = request_id;
end;
$$;

revoke all on function public.set_request_read(uuid, boolean) from public, anon;
grant execute on function public.set_request_read(uuid, boolean) to authenticated;

-- Admin-only: delete a student account. public.users, availability, requests and
-- fixed-lesson membership go with it; avatar files are removed by the app first.
create or replace function public.delete_student(student_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.is_admin() then
    raise exception 'Only the admin can delete students';
  end if;
  if not exists (select 1 from public.users where id = student_id and role = 'student') then
    raise exception 'Only student accounts can be deleted';
  end if;

  update public.fixed_lessons
     set student_ids = array_remove(student_ids, student_id)
   where student_id = any (student_ids);
  delete from auth.users where id = student_id;
end;
$$;

revoke all on function public.delete_student(uuid) from public, anon;
grant execute on function public.delete_student(uuid) to authenticated;

revoke all on public.fixed_lessons from anon;
grant select, insert, update, delete on public.fixed_lessons to authenticated;

alter table public.fixed_lessons enable row level security;

drop policy if exists "fixed_lessons_select" on public.fixed_lessons;
create policy "fixed_lessons_select" on public.fixed_lessons
  for select to authenticated
  using ((select public.is_admin()) or (select auth.uid()) = any (student_ids));

drop policy if exists "fixed_lessons_admin_write" on public.fixed_lessons;
create policy "fixed_lessons_admin_write" on public.fixed_lessons
  for all to authenticated
  using ((select public.is_admin()))
  with check ((select public.is_admin()));

-- The admin can clear a deleted student's photo.
drop policy if exists "avatars_admin_delete" on storage.objects;
create policy "avatars_admin_delete" on storage.objects
  for delete to authenticated
  using (bucket_id = 'avatars' and (select public.is_admin()));
