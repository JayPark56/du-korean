# DU Korean Program

A scheduling and lesson-management site for the University of Denver Korean Program. Jay is the admin, and students use it to share their availability, level, goals, and lesson requests.

**Stack:** Next.js 16 (App Router) · Supabase (Auth + Postgres + RLS) · Tailwind CSS v4 · TypeScript · Vercel

## 1. Supabase setup

1. Create a project at [supabase.com](https://supabase.com).
2. **SQL Editor → New query**, paste all of [`supabase/schema.sql`](supabase/schema.sql), and run it. It creates:
   - the `users`, `availability`, and `topic_requests` tables
   - a trigger that creates a profile on sign-up. `blackskirtariel@gmail.com` gets the **admin** role automatically, and everyone else is a **student**.
   - the Row Level Security policies (see "Permissions" below)
   - the `avatars` Storage bucket for profile photos, plus its access policies
   - If you've already run it before, just run the whole file again. That adds the new columns (`avatar_url`, `bio`) and the bucket.
3. **Authentication → Sign In / Providers → Email.** For a class of 3, the simplest setup is to turn **"Confirm email" off**, which lets students log in right after signing up.
   If you keep confirmation on, set **Authentication → URL Configuration → Site URL** to your deployed URL and add `https://<your-domain>/auth/confirm` to Redirect URLs.

To make someone admin manually, run:
```sql
update public.users set role = 'admin' where email = 'someone@example.com';
```

## 2. Local development

```bash
cp .env.local.example .env.local   # then fill in the values from Project Settings → API
npm install
npm run dev                         # http://localhost:3000
```

## 3. Deploy to Vercel

1. Push this folder to GitHub and import it in Vercel. The framework preset is Next.js.
2. Add the environment variables `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`.
3. Once deployed, enter the Vercel URL as the Site URL in Supabase.

## Features

| Route | Who | What |
|---|---|---|
| `/login`, `/signup` | everyone | Email + password auth. Sign-up collects a name. |
| `/dashboard` | students (English UI) | When2Meet-style availability grid (drag to paint; press and hold then drag on phones), with times Jay is free outlined in blue and ★ for overlaps. Also Korean level and goals, and the lesson request. |
| `/admin` | Jay (Korean UI) | Student cards: level, goals, latest request, this week's hours, and **delete student** |
| `/admin/schedule` | Jay | Jay's own grid, a heatmap of all students (hover or tap for names, or click a name to see just that student), recommended times (Jay + N students), and a **픽스** button that confirms a lesson |
| `/admin/requests` | Jay | All lesson requests, filterable by week and student, with a manual **읽음 표시** tick |

- The grid runs **Mon–Sun, 8:00 AM–9:00 PM, in 30-minute slots**. Every time is **America/Denver** wall-clock time (MDT/MST is labeled for each week).
- `week_start` is the Monday of the week in Denver. You can look up to 8 weeks ahead.

## Permissions (RLS)

| Table | Student | Admin |
|---|---|---|
| `users` | Can read only their own row. Can update only `name`, `korean_level`, and `goals`. Changing `role`/`email` is blocked by column privileges. | Can read everyone |
| `availability` | Can read and write their own rows, plus **read Jay's rows** (for recommended times) | Can read everyone. Can write only their own rows. |
| Storage `avatars` | Can upload, replace, and delete only in their own folder (`<user id>/…`). `users.avatar_url` also stores only paths inside their own folder (DB constraint). | Can list everyone's photos |
| `topic_requests` | Can read all of their own weekly requests, but can write **only this week and next week** (DB policy). The read tick is visible but not writable. | Can read everyone; ticks "read" via `set_request_read()` |
| `fixed_lessons` | Can read only the lessons they are part of; cannot create or change any | Full control (the "픽스" button) |
| `admin_seen` | No access | Can read and write only their own row (the "last seen" time behind the navbar red dots) |

Anonymous (not logged-in) access is blocked on every table.

Beyond RLS, there are two more layers. `src/proxy.ts` refreshes the session and redirects signed-out users, and the server layouts (`requireStudent` / `requireAdmin`) enforce roles.

## Font

Freesentation is already first in the `--font-sans` stack in `src/app/globals.css`. Put the font files in `public/fonts/` and uncomment the `@font-face` block.

## Structure

```
supabase/schema.sql            DB schema + RLS
src/proxy.ts                   session refresh + auth redirects (Next 16 "proxy" = middleware)
src/lib/supabase/*             browser / server / proxy clients
src/lib/auth.ts                getProfile / requireStudent / requireAdmin
src/lib/schedule.ts            days, slots, Denver-time week math, block grouping
src/components/AvailabilityGrid.tsx   the drag-select grid
src/app/dashboard/*            student dashboard
src/app/admin/*                admin pages (students, schedule + heatmap, requests)
```
