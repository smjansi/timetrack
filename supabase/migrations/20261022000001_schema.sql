-- TimeTrack core schema, grants and row level security.
-- Clients never write status/review fields: they only get column-level
-- insert/update on entries. Everything else goes through the RPCs in 0003.

create type public.user_role as enum ('employee', 'manager');
create type public.ts_status as enum ('Draft', 'Submitted', 'Approved', 'Rejected');
create type public.review_status as enum ('Approved', 'Rejected');

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  email text not null,
  full_name text not null,
  role public.user_role not null default 'employee',
  manager_id uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (manager_id is distinct from id)
);
create index profiles_manager_id_idx on public.profiles (manager_id);

create table public.app_settings (
  key text primary key,
  value jsonb not null
);
insert into public.app_settings (key, value) values
  ('managers_see_all', 'false'::jsonb),
  ('timezone', '"Asia/Kolkata"'::jsonb);

create table public.projects (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  active boolean not null default true
);
create table public.tasks (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  active boolean not null default true
);
insert into public.projects (name) values
  ('Website Redesign'), ('Mobile App'), ('CRM Migration'), ('Internal Training'), ('Support Ops');
insert into public.tasks (name) values
  ('Development'), ('Meeting'), ('Testing'), ('Support'), ('Admin');

create table public.timesheets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  week_start date not null check (extract(isodow from week_start) = 1),
  status public.ts_status not null default 'Draft',
  comment text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, week_start)
);
create index timesheets_user_week_idx on public.timesheets (user_id, week_start desc);
create index timesheets_submitted_idx on public.timesheets (user_id) where status = 'Submitted';

create table public.entries (
  id uuid primary key default gen_random_uuid(),
  timesheet_id uuid not null references public.timesheets (id) on delete cascade,
  entry_date date not null,
  project_id uuid not null references public.projects (id),
  task_id uuid not null references public.tasks (id),
  hours numeric(4, 2) not null check (hours between 0.5 and 8.5),
  notes text not null default '' check (char_length(notes) <= 1000),
  is_rejected boolean not null default false,
  rejected_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index entries_timesheet_date_idx on public.entries (timesheet_id, entry_date);

create table public.day_reviews (
  timesheet_id uuid not null references public.timesheets (id) on delete cascade,
  entry_date date not null,
  status public.review_status not null,
  comment text not null default '' check (char_length(comment) <= 500),
  reviewer_id uuid not null references public.profiles (id),
  reviewed_at timestamptz not null default now(),
  primary key (timesheet_id, entry_date)
);

create function public.touch_updated_at() returns trigger
language plpgsql set search_path = '' as $$
begin
  new.updated_at := now();
  return new;
end;
$$;
create trigger profiles_touch before update on public.profiles
  for each row execute function public.touch_updated_at();
create trigger timesheets_touch before update on public.timesheets
  for each row execute function public.touch_updated_at();
create trigger entries_touch before update on public.entries
  for each row execute function public.touch_updated_at();

-- A profile is created for every new auth user. The role is always 'employee';
-- promote managers with SQL (see supabase/README.md).
create function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  insert into public.profiles (id, email, full_name)
  values (
    new.id,
    coalesce(new.email, ''),
    coalesce(nullif(new.raw_user_meta_data ->> 'full_name', ''), split_part(coalesce(new.email, ''), '@', 1))
  );
  return new;
end;
$$;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

-- True when the signed-in user is a manager who may review `target`'s timesheets.
create function public.can_review(target uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select target <> auth.uid()
    and exists (select 1 from public.profiles me where me.id = auth.uid() and me.role = 'manager')
    and (
      exists (select 1 from public.profiles p where p.id = target and p.manager_id = auth.uid())
      or coalesce((select (value #>> '{}')::boolean from public.app_settings where key = 'managers_see_all'), false)
    );
$$;

-- Grants: nothing by default, then the minimum.
revoke all on all tables in schema public from anon, authenticated;
revoke execute on all functions in schema public from public, anon;

grant select on public.profiles, public.app_settings, public.projects, public.tasks,
  public.timesheets, public.entries, public.day_reviews to authenticated;
grant update (full_name) on public.profiles to authenticated;
grant insert (timesheet_id, entry_date, project_id, task_id, hours, notes) on public.entries to authenticated;
grant update (entry_date, project_id, task_id, hours, notes) on public.entries to authenticated;
grant delete on public.entries to authenticated;
grant execute on function public.can_review(uuid) to authenticated;

alter table public.profiles enable row level security;
alter table public.app_settings enable row level security;
alter table public.projects enable row level security;
alter table public.tasks enable row level security;
alter table public.timesheets enable row level security;
alter table public.entries enable row level security;
alter table public.day_reviews enable row level security;

create policy profiles_select on public.profiles for select to authenticated
  using (id = (select auth.uid()) or public.can_review(id));
create policy profiles_update_self on public.profiles for update to authenticated
  using (id = (select auth.uid())) with check (id = (select auth.uid()));

create policy settings_select on public.app_settings for select to authenticated using (true);
create policy projects_select on public.projects for select to authenticated using (true);
create policy tasks_select on public.tasks for select to authenticated using (true);

create policy timesheets_select on public.timesheets for select to authenticated
  using (user_id = (select auth.uid()) or public.can_review(user_id));

-- Visibility of entries and reviews follows the timesheet's own RLS.
create policy entries_select on public.entries for select to authenticated
  using (exists (select 1 from public.timesheets t where t.id = timesheet_id));
create policy entries_insert on public.entries for insert to authenticated
  with check (exists (select 1 from public.timesheets t where t.id = timesheet_id and t.user_id = (select auth.uid())));
create policy entries_update on public.entries for update to authenticated
  using (exists (select 1 from public.timesheets t where t.id = timesheet_id and t.user_id = (select auth.uid())))
  with check (exists (select 1 from public.timesheets t where t.id = timesheet_id and t.user_id = (select auth.uid())));
create policy entries_delete on public.entries for delete to authenticated
  using (exists (select 1 from public.timesheets t where t.id = timesheet_id and t.user_id = (select auth.uid())));

create policy day_reviews_select on public.day_reviews for select to authenticated
  using (exists (select 1 from public.timesheets t where t.id = timesheet_id));
