# Implementation checklist

Maps each prototype screen and business rule to where it is implemented, and lists intentional changes.

## Screens

| Prototype screen | Implementation |
| --- | --- |
| Login (email) | `src/pages/Login.tsx`, `src/auth/AuthProvider.tsx` (email + password; the role comes from `profiles`) |
| Not authorised / loading / not configured | `src/components/Shell.tsx`, `src/components/Message.tsx`, `src/auth/access.ts` |
| Bottom navigation by role, pending badge | `src/components/BottomNav.tsx`, `src/hooks/usePendingCount.ts` |
| My Timesheet (KPIs, list, New timesheet) | `src/pages/Home.tsx`, `create_next_timesheet` in `supabase/migrations/20261022000003_rpc.sql` |
| Weekly timesheet | `src/pages/Weekly.tsx`, `src/domain/timesheet.ts` |
| Add / Edit entry | `src/pages/EntryForm.tsx`, `src/hours.ts` |
| Summary (this / last month) | `src/pages/Summary.tsx`, `my_month_summary` (migration 3) |
| Approvals list + review detail | `src/pages/Approvals.tsx`, `src/pages/ApprovalDetail.tsx`, `src/domain/review.ts` |
| Reports (filters, KPIs, charts, rows) | `src/pages/Reports.tsx`, `report_entries` (migration 3) |
| Toasts, empty states | `src/components/Toast.tsx`; empty states in each page |
| Offline / error / loading states | `src/components/Loadable.tsx`, `ErrorBoundary.tsx`, `src/lib/errors.ts`, offline banner in `Shell.tsx` |
| PWA | `vite.config.ts`, `public/icon-*.png`, `public/apple-touch-icon.png` |

## Business rules

| Rule | Where it is enforced |
| --- | --- |
| One Mon–Sun timesheet per user; statuses Draft → Submitted → Approved / Rejected | `timesheets` table: unique `(user_id, week_start)`, Monday check, `ts_status` enum (migration 1) |
| Hours 0.5–8.5 per entry; ≤ 8.5 per day excluding rejected entries | `entries_guard` trigger (migration 2), check constraint (migration 1), mirrored in `src/hours.ts` |
| Only the owner edits entries; approved days and approved timesheets are locked | `entries_guard`, RLS policies (migrations 1, 2) |
| New timesheet: next week, or reuse an empty editable latest one | `create_next_timesheet` |
| Submit / Resubmit: keeps Approved day reviews, clears Rejected ones and the comment | `submit_timesheet` |
| Per-day review; reject needs a comment; no self-review; reports only | `review_day` |
| Timesheet finishes when every day with entries is decided; joined "Day: comment" | `review_day` |
| Rejected entries stay visible, excluded from totals/cap, cannot be deleted | `is_rejected` flag set by `review_day`; `entries_guard`; UI in `Weekly.tsx` |
| Clients never write status / review fields | Column-level grants + `security definer` RPCs (migrations 1, 3) |
| RLS on every table | Migration 1; proven by `supabase/tests/rls_and_rules.test.sql` |
| Time-zone safe dates | `date` columns; `src/domain/dates.ts` uses `YYYY-MM-DD` strings |

## Tests

- Unit: `src/hours.test.ts`, `src/domain/*.test.ts`, `src/auth/access.test.ts`, `src/lib/errors.test.ts`
- Database (pgTAP): `supabase/tests/rls_and_rules.test.sql`
- Golden path + accessibility (Playwright + axe): `e2e/golden-path.spec.ts`
- CI: `.github/workflows/ci.yml` (app, database, e2e)

## Intentional changes from the prototype

- Real auth (email + password, accounts created by an administrator) replaces the email dropdown; managers are promoted by SQL.
- Managers see their direct reports (`manager_id`) instead of everyone; `app_settings.managers_see_all` restores the prototype behaviour.
- The rejected state is a stored `entries.is_rejected` flag (prompt requirement) rather than derived from the day review.
- Rejected entries cannot be edited either (the prototype allowed opening them); employees add corrected entries.
- Submitting an empty timesheet is refused.
- The Summary and totals exclude rejected hours.
- "Week N" is the ISO week number; dates follow the real calendar instead of a fixed October 2026.
- Project and task dropdowns are alphabetical.
- Reports are computed from `report_entries` rows; corrections added to a Rejected timesheet are hidden from reports until resubmitted (as in the prototype).

## Not done / still to do

- Cloudflare is deployed as a Worker with static assets (`wrangler.jsonc`) rather than Pages, because that is how the project was created; the SPA fallback therefore lives in `wrangler.jsonc`, not `_redirects`.
- Branch protection on `main` is not enabled yet.
- Contrast and install behaviour have not been checked on a physical phone. Axe WCAG A/AA checks pass in CI.
- `managers_see_all` and `timezone` are changed by SQL only.
