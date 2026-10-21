# Supabase

- `migrations/` – schema + RLS (0001), entry rules trigger (0002), workflow RPCs (0003).
- `seed.sql` – **dev only** sample users (Alex, Jordan, Sam, Riya = employees, Priya = manager) and sheets.
- `tests/` – pgTAP tests, run with `supabase test db`.

## Make someone a manager
Every new auth user gets an `employee` profile. Promote with SQL (SQL editor or `psql`; there is no client path for this):

```sql
update public.profiles set role = 'manager' where email = 'priya@example.com';
-- assign reports
update public.profiles set manager_id = (select id from public.profiles where email = 'priya@example.com')
where email in ('alex@example.com', 'jordan@example.com');
```

By default a manager sees only direct reports. To let every manager see every user:

```sql
update public.app_settings set value = 'true'::jsonb where key = 'managers_see_all';
```

## Roll back
Migrations are forward-only. To undo one, add a new migration that reverses it, and apply with `supabase db push`.
