# TimeTrack

Mobile-first weekly timesheets with per-day manager approval. Installable PWA.
Based on the prototype in [`docs/timetrack-prototype.html`](docs/timetrack-prototype.html).

## Architecture

```
 Browser (React + Vite PWA)                Cloudflare Pages
 ─ React Router, TanStack Query   ◄──────  static build (dist), SPA fallback, security headers
        │
        │ supabase-js (anon key + user JWT)
        ▼
 Supabase
 ├─ Auth            email magic link
 ├─ PostgREST       reads + entry writes, filtered by Row Level Security
 ├─ RPC functions   create_next_timesheet · submit_timesheet · review_day (security definer, role checks)
 │                  report_entries · my_month_summary (security invoker)
 └─ Postgres        profiles · projects · tasks · timesheets · entries · day_reviews · app_settings
                    trigger entries_guard enforces the hour rules
```

Business rules live in the database, not only in the UI:

- Clients can **only** read, and insert/update/delete **entries** (column-level grants). Timesheet status, day reviews and the `is_rejected` flag are written only by the RPC functions.
- `entries_guard` (trigger): 0.5–8.5 h per entry, ≤ 8.5 h per day excluding rejected entries, date inside the week, approved days locked, rejected entries cannot be edited or deleted.
- RLS: employees see only their rows; managers see their direct reports (`profiles.manager_id`) and act only through `review_day`.

| Folder | What |
| --- | --- |
| `src/` | App. `domain/` is pure logic with unit tests; `api/` is the Supabase layer; `pages/`, `components/` the screens |
| `supabase/migrations/` | Schema, RLS, rules trigger, RPCs |
| `supabase/seed.sql` | **Dev only** sample users and sheets |
| `supabase/tests/` | pgTAP tests (RLS and business rules) |
| `e2e/` | Playwright golden path + axe accessibility checks |
| `public/_headers`, `public/_redirects` | Cloudflare security headers and SPA fallback |
| `docs/` | Prototype, original build prompt, [implementation checklist](docs/checklist.md) |

## Local setup

Requirements: Node 22+, and Docker for the local Supabase stack.

```bash
npm ci
npx supabase start            # local Postgres/Auth; applies migrations + seed.sql
cp .env.example .env.local    # fill with the URL and anon key printed by `supabase start`
npm run dev                   # http://localhost:5173
```

Sign-in is a magic link. Locally, read the email in Inbucket at http://127.0.0.1:54324.
Seed users: `alex@`, `jordan@`, `sam@`, `riya@` (employees) and `priya@contoso.test` (manager).

### Environment variables

| Variable | Where | Notes |
| --- | --- | --- |
| `VITE_SUPABASE_URL` | `.env.local`, Cloudflare Pages | Project URL |
| `VITE_SUPABASE_ANON_KEY` | `.env.local`, Cloudflare Pages | The **anon** (public) key. Never put the service-role key here |

`.env.local` is git-ignored; `.env.example` is committed. If the variables are missing the app shows a "not configured" screen.

### Checks

```bash
npm run typecheck && npm run lint && npm test && npm run build   # app
npx supabase test db                                              # pgTAP (needs Docker)
npm run build && npm run e2e                                      # Playwright, see below
```

`npm run e2e` needs `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY` of a **local or throw-away** project (it creates users), and `npm run build` must have used the same URL/anon key. CI does all of this against `supabase start`.

## Create a manager

Every new user starts as an `employee`. Promote with SQL (Supabase dashboard → SQL editor, or `psql`). There is deliberately no UI or client path for this.

```sql
update public.profiles set role = 'manager' where email = 'priya@example.com';

-- assign reports
update public.profiles
set manager_id = (select id from public.profiles where email = 'priya@example.com')
where email in ('alex@example.com', 'jordan@example.com');
```

Managers see only direct reports. To let every manager see every user:

```sql
update public.app_settings set value = 'true'::jsonb where key = 'managers_see_all';
```

## Deploy

Costs stay on free tiers: Supabase free plan, Cloudflare Pages free plan, GitHub Actions.

### 1. Supabase (production project)

1. Create a project in region **South Asia (Mumbai) `ap-south-1`**. Use a separate project for production and for development/preview.
2. Link and push the schema (the seed is **not** applied by `db push`):
   ```bash
   npx supabase login
   npx supabase link --project-ref <project-ref>
   npx supabase db push
   ```
3. Dashboard → Authentication → URL configuration: set **Site URL** to the Pages URL and add it (and `http://localhost:5173`) to **Redirect URLs**. Wildcard `https://*.pages.dev` is useful for PR previews.
4. **Control who can sign up.** Magic links create an account for any email address. Either turn off "Allow new users to sign up" and invite staff (Authentication → Users → Invite), or restrict to your company's domain, before sharing the URL.
5. Promote your first manager with the SQL above.

### 2. Cloudflare Pages

1. Dashboard → Workers & Pages → Create → Pages → Connect to Git → pick this repo.
2. Build settings: framework **None**, build command `npm run build`, output directory `dist`.
3. Environment variables (Production and Preview): `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, and `NODE_VERSION=22`.
4. Every PR gets a preview deployment automatically; `main` deploys to production.

`public/_redirects` provides the single-page-app fallback; `public/_headers` sets the CSP (only your Supabase origin: `https://*.supabase.co`), `X-Content-Type-Options`, `Referrer-Policy` and frame protection. If you use a custom Supabase domain, add it to `connect-src` in `_headers`. `style-src 'unsafe-inline'` is needed because React sets inline `style` attributes for the progress and chart bars.

## Roll back

- **App:** Cloudflare Pages → Deployments → pick the previous good deployment → *Rollback to this deployment*.
- **Database:** migrations are forward-only. Write a new migration that reverses the change (for example `supabase migration new revert_xyz`), test it locally with `supabase db reset`, then `supabase db push`. For data loss use the project's backups (Supabase dashboard → Database → Backups).

## Notes and limits

- Offline: the app shell loads offline, but viewing and saving data needs a connection (the UI says so).
- A manager's own timesheet is not approved by anyone unless another manager is set as their `manager_id`.
- Weeks start on Monday and are stored as `date`. The first timesheet of a new user starts in the `timezone` set in `app_settings` (default `Asia/Kolkata`).
