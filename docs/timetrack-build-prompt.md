# Build prompt: TimeTrack (Cloudflare + Supabase + GitHub)

Paste everything below the line into Claude Code (or another coding agent) from an empty working folder. Put `timetrack-prototype.html` in that folder first, so the agent can read it.

---

## Goal

Build **TimeTrack**, a production-ready, mobile-first weekly timesheet web app (installable PWA), based on the attached prototype `timetrack-prototype.html`. Treat the prototype as the source of truth for screens, flows, business rules, wording and visual style. Replace its in-memory sample data with a real backend.

Stack (fixed):
- **Frontend:** Vite + React + TypeScript, React Router, TanStack Query, plain CSS modules or Tailwind (your choice, keep it light). PWA via `vite-plugin-pwa`.
- **Backend:** **Supabase** (Postgres, Auth, Row Level Security, SQL migrations via Supabase CLI). Business rules are enforced in the database, not only in the UI.
- **Hosting:** **Cloudflare Pages** (static build, SPA fallback, deployed from GitHub). A Cloudflare Worker is not needed unless you find a concrete reason; if you add one, justify it first.
- **Repository:** **GitHub**, with CI in GitHub Actions.
- Keep running cost at or near zero (free tiers). Prefer the Supabase region closest to India (Mumbai, `ap-south-1`) if available.

## Before you write code

1. Read `timetrack-prototype.html` fully. Summarise the screens, roles, states and rules you found in 10 lines so I can confirm you understood it.
2. Ask me only for things you cannot decide yourself: GitHub repo name/owner, Supabase project URL + anon key, Cloudflare account/project name. Never ask for or store service-role keys, passwords or tokens in chat or in the repo.
3. Produce a short plan (folder layout, tables, migration order), then proceed without waiting unless something is ambiguous.

## Roles and auth

- Two roles: `employee` and `manager`. A manager also enters their own timesheet (they cannot approve their own).
- Auth: Supabase Auth with email magic link (or email + password if magic links are impractical). This replaces the prototype's email dropdown login. The role comes from a `profiles` table keyed by `auth.users.id`, created by a trigger on signup, default role `employee`.
- Managers are assigned by an admin (me) via SQL/seed; document how. Add `manager_id` on `profiles` so a manager sees only their direct reports (the prototype shows all employees; make "all employees" a documented option controlled by one flag if simpler).
- Sign out, session persistence, and a clean "not authorised" screen.

## Screens (match the prototype, 390px mobile layout, scales up gracefully on desktop)

Bottom navigation, hidden on login. Tabs by role:
- **Employee:** My Timesheet, Summary.
- **Manager:** My Timesheet, Approvals (with pending-count badge), Reports.

1. **Login** – email entry, role badge/description not needed once real auth is in.
2. **My Timesheet (home)** – KPI cards (This week hrs, Submitted count, Rejected count), "New timesheet" button, list of weeks (range, "Week N" or manager comment in red when rejected, hours, status badge).
3. **Weekly timesheet** – Mon–Sun cards with date, per-day total, per-day review badge (Pending / Approved / Rejected), entries (project, task, hours, Rejected chip), edit and delete, "Add entry" per day, week total, red manager-comment banner when rejected, footer note, Submit / Resubmit / Submitted button.
4. **Add / Edit entry** – date (day of that week), project, task, hours, notes, live day-total preview ("X already logged, Y remaining"), validation errors inline.
5. **Summary (employee)** – This month / Last month toggle, total hours, project count, top project, hours-by-project bars.
6. **Approvals (manager)** – list of submitted timesheets from the team with "N of M days reviewed"; detail screen with one card per day (entries, hours, status badge, comment input, Reject / Approve buttons).
7. **Reports (manager)** – filters (employee, status), KPIs (entries shown, total hours), bar charts by project / employee / status, and the entry rows list.
8. Toasts for save/submit/approve/reject; empty states ("Nothing waiting for review", "No entries match these filters").

Visual style: copy the prototype's tokens (Segoe UI/system font, primary `#0078D4`, success `#107C10`, danger `#D13438`/`#A4262C`, neutral `#605e5c`, borders `#e1dfdd`, page background `#f3f2f1`, 44–52px touch targets, visible focus rings, status badge colours Draft `#605e5c`, Submitted `#0078D4`, Approved `#107C10`, Rejected `#D13438`). Meet WCAG AA contrast and use real labels/aria for accessibility.

## Business rules (extract from the prototype and enforce in Postgres)

- A timesheet is one Mon–Sun week per user; unique `(user_id, week_start)`. Statuses: `Draft → Submitted → Approved | Rejected`.
- Entry: project, task, hours, notes (optional), belongs to one day of the week.
- Hours per entry between **0.5 and 8.5**; total per day **≤ 8.5** (excluding rejected entries). Reject violations in a DB trigger/constraint with a clear message the UI shows.
- Only the owner can add/edit/delete entries, and only while the timesheet is Draft, Rejected or Submitted, and only on days that are **not Approved** (approved days are locked).
- **New timesheet:** creates the week after the user's latest timesheet; if the latest one is empty and still editable, open it instead of creating another.
- **Submit / Resubmit:** sets status `Submitted`, clears the overall comment, keeps day reviews that are Approved, clears Rejected ones. While Submitted, unapproved days stay editable.
- **Per-day review (manager):** approve or reject each day that has entries. **Reject requires a comment.** Managers cannot review their own timesheet and can only review `Submitted` timesheets of their reports.
- When every day with entries has a decision, the timesheet becomes `Rejected` if any day is rejected (overall comment = joined "Day: comment" lines), otherwise `Approved`.
- Rejected entries stay visible with a Rejected chip, are excluded from totals and the daily cap, and cannot be deleted; the employee adds corrected entries (these count). Implement with an `is_rejected` flag set when a day is rejected.
- Implement review/submit/approve as **Postgres functions (RPC)** with `security definer` and explicit role checks, so the client never writes status or review fields directly.

## Data model (propose, then migrate)

`profiles`, `projects` (seeded: Website Redesign, Mobile App, CRM Migration, Internal Training, Support Ops), `tasks` (Development, Meeting, Testing, Support, Admin), `timesheets`, `entries`, `day_reviews`. Add `created_at/updated_at`, sensible indexes, and a view or RPC for report aggregates (by project, employee, status) and the monthly summary. Seed script with the prototype's sample users (Alex, Jordan, Sam, Riya as employees; Priya as manager) for local/dev only.

**RLS (mandatory):** enabled on every table. Employees read/write only their own rows; managers read their reports' rows and may act only through the RPCs. Write RLS tests (SQL or pgTAP) that prove an employee cannot read someone else's timesheet, edit an approved day, or self-approve.

## Repository, CI and deployment

- Initialise git, create the GitHub repo (`gh repo create`, private unless I say otherwise), `main` protected, work on feature branches with small conventional commits and PRs.
- Layout: `/src` (app), `/supabase/migrations`, `/supabase/seed.sql`, `/docs` (prototype + architecture notes), `README.md`.
- GitHub Actions: on PR run typecheck, lint, unit tests, build; run Supabase migrations against a local/ephemeral DB and the RLS tests.
- Cloudflare Pages: connect the GitHub repo, build command `npm run build`, output `dist`, SPA fallback (`_redirects` or equivalent), preview deployments per PR. Environment variables `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` set in Cloudflare and in a git-ignored `.env.local`; commit a `.env.example`. Secrets never enter the repo.
- Supabase: migrations applied with the Supabase CLI (`supabase db push`); document dev vs production projects.
- Add security headers via `_headers` (CSP that allows only your Supabase origin, `X-Content-Type-Options`, `Referrer-Policy`).

## Quality bar

- Unit tests for the hour/day-cap and status-transition logic; a few Playwright tests for the golden paths (employee submits → manager rejects one day → employee fixes and resubmits → manager approves).
- Loading, error and offline states everywhere; optimistic updates only where safe.
- PWA: installable, app icon, theme colour, works as a shell offline (data editing needs connectivity; say so in the UI).
- Time zone safe: store `week_start` and entry dates as `date`, never as timestamps; weeks start Monday.
- No `any`, no secrets, no dead code. Keep dependencies few.

## Deliverables

1. Working app deployed on a Cloudflare Pages URL, backed by a Supabase project, with the repo on GitHub.
2. `README.md`: architecture diagram (text is fine), local setup, env vars, how to create a manager, how to deploy, how to roll back a migration.
3. A final checklist mapping each prototype screen and business rule above to the file/migration that implements it, plus anything you intentionally changed or could not do.

Work in this order and report briefly after each step: (1) repo + CI skeleton, (2) Supabase schema, RLS, RPCs and tests, (3) auth + app shell + routing, (4) employee screens, (5) manager screens, (6) PWA, polish, accessibility, (7) Cloudflare deploy and README.
