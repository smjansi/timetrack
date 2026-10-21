-- Workflow RPCs. security definer + explicit checks: clients never write
-- timesheet status, day reviews or the is_rejected flag directly.

create function public.create_next_timesheet() returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  v_uid uuid := auth.uid();
  v_latest public.timesheets;
  v_tz text;
  v_id uuid;
begin
  if v_uid is null then
    raise exception 'Not signed in.' using errcode = '42501';
  end if;
  select * into v_latest from public.timesheets where user_id = v_uid order by week_start desc limit 1;

  if not found then
    select value #>> '{}' into v_tz from public.app_settings where key = 'timezone';
    insert into public.timesheets (user_id, week_start)
    values (v_uid, date_trunc('week', (now() at time zone coalesce(v_tz, 'UTC')))::date)
    on conflict (user_id, week_start) do nothing
    returning id into v_id;
    if v_id is null then
      select id into v_id from public.timesheets
      where user_id = v_uid order by week_start desc limit 1;
    end if;
    return v_id;
  end if;

  -- reuse an empty, still-editable latest week instead of creating another
  if v_latest.status <> 'Approved'
     and not exists (select 1 from public.entries where timesheet_id = v_latest.id) then
    return v_latest.id;
  end if;

  insert into public.timesheets (user_id, week_start)
  values (v_uid, v_latest.week_start + 7)
  on conflict (user_id, week_start) do nothing
  returning id into v_id;
  if v_id is null then
    select id into v_id from public.timesheets
    where user_id = v_uid and week_start = v_latest.week_start + 7;
  end if;
  return v_id;
end;
$$;

create function public.submit_timesheet(p_timesheet uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare
  v_uid uuid := auth.uid();
  v_ts public.timesheets;
begin
  select * into v_ts from public.timesheets where id = p_timesheet for update;
  if not found or v_ts.user_id is distinct from v_uid then
    raise exception 'Timesheet not found.' using errcode = '42501';
  end if;
  if v_ts.status not in ('Draft', 'Rejected') then
    raise exception 'Only draft or rejected timesheets can be submitted.';
  end if;
  if not exists (select 1 from public.entries where timesheet_id = p_timesheet and not is_rejected) then
    raise exception 'Add at least one entry before submitting.';
  end if;

  delete from public.day_reviews where timesheet_id = p_timesheet and status = 'Rejected';
  update public.timesheets set status = 'Submitted', comment = '' where id = p_timesheet;
end;
$$;

create function public.review_day(
  p_timesheet uuid,
  p_date date,
  p_status public.review_status,
  p_comment text default ''
) returns public.ts_status
language plpgsql security definer set search_path = '' as $$
declare
  v_uid uuid := auth.uid();
  v_ts public.timesheets;
  v_prev public.day_reviews;
  v_comment text := trim(coalesce(p_comment, ''));
  v_now timestamptz := clock_timestamp();
  v_open int;
  v_rej int;
  v_result public.ts_status;
begin
  if not exists (select 1 from public.profiles where id = v_uid and role = 'manager') then
    raise exception 'Only managers can review timesheets.' using errcode = '42501';
  end if;
  select * into v_ts from public.timesheets where id = p_timesheet for update;
  if not found then
    raise exception 'Timesheet not found.' using errcode = '42501';
  end if;
  if v_ts.user_id = v_uid then
    raise exception 'You cannot review your own timesheet.' using errcode = '42501';
  end if;
  if not public.can_review(v_ts.user_id) then
    raise exception 'You can only review timesheets of your own team.' using errcode = '42501';
  end if;
  if v_ts.status <> 'Submitted' then
    raise exception 'Only submitted timesheets can be reviewed.';
  end if;
  if p_status = 'Rejected' and v_comment = '' then
    raise exception 'Add a comment to reject this day.';
  end if;
  if char_length(v_comment) > 500 then
    raise exception 'Comment is too long (500 characters at most).';
  end if;

  select * into v_prev from public.day_reviews where timesheet_id = p_timesheet and entry_date = p_date;
  if not found and not exists (
    select 1 from public.entries where timesheet_id = p_timesheet and entry_date = p_date and not is_rejected
  ) then
    raise exception 'That day has no entries to review.';
  end if;

  if p_status = 'Rejected' then
    update public.entries set is_rejected = true, rejected_at = v_now
    where timesheet_id = p_timesheet and entry_date = p_date
      and (not is_rejected or rejected_at = v_prev.reviewed_at);
  elsif v_prev.status = 'Rejected' then
    -- decision changed within the same round: release what that rejection flagged
    update public.entries set is_rejected = false, rejected_at = null
    where timesheet_id = p_timesheet and entry_date = p_date and rejected_at = v_prev.reviewed_at;
  end if;

  insert into public.day_reviews (timesheet_id, entry_date, status, comment, reviewer_id, reviewed_at)
  values (p_timesheet, p_date, p_status, case when p_status = 'Rejected' then v_comment else '' end, v_uid, v_now)
  on conflict (timesheet_id, entry_date) do update
    set status = excluded.status, comment = excluded.comment,
        reviewer_id = excluded.reviewer_id, reviewed_at = excluded.reviewed_at;

  -- days to decide: days with counted entries, plus days that already have a decision
  with days as (
    select entry_date from public.entries where timesheet_id = p_timesheet and not is_rejected
    union
    select entry_date from public.day_reviews where timesheet_id = p_timesheet
  )
  select count(*) filter (where dr.entry_date is null), count(*) filter (where dr.status = 'Rejected')
  into v_open, v_rej
  from days d
  left join public.day_reviews dr on dr.timesheet_id = p_timesheet and dr.entry_date = d.entry_date;

  if v_open > 0 then
    return 'Submitted';
  end if;

  v_result := case when v_rej > 0 then 'Rejected' else 'Approved' end;
  update public.timesheets
  set status = v_result,
      comment = coalesce((
        select string_agg(to_char(entry_date, 'Dy FMDD Mon') || ': ' || comment, ' · ' order by entry_date)
        from public.day_reviews where timesheet_id = p_timesheet and status = 'Rejected'
      ), '')
  where id = p_timesheet;
  return v_result;
end;
$$;

-- Report rows for managers (RLS limits them to their team and themselves).
-- Status per row: Rejected entries, Approved days, otherwise the timesheet status;
-- corrections added to a Rejected timesheet are not reported until resubmitted.
create function public.report_entries(p_user uuid default null, p_status text default null)
returns table (
  entry_id uuid, user_id uuid, employee text, week_start date, entry_date date,
  project text, task text, hours numeric, status text
)
language sql stable security invoker set search_path = '' as $$
  select x.entry_id, x.user_id, x.employee, x.week_start, x.entry_date, x.project, x.task, x.hours, x.st
  from (
    select e.id as entry_id, t.user_id, p.full_name as employee, t.week_start, e.entry_date,
           pr.name as project, ta.name as task, e.hours,
           case when e.is_rejected then 'Rejected'
                when dr.status = 'Approved' then 'Approved'
                when t.status = 'Rejected' then null
                else t.status::text end as st
    from public.entries e
    join public.timesheets t on t.id = e.timesheet_id
    join public.profiles p on p.id = t.user_id
    join public.projects pr on pr.id = e.project_id
    join public.tasks ta on ta.id = e.task_id
    left join public.day_reviews dr on dr.timesheet_id = t.id and dr.entry_date = e.entry_date
    where t.status <> 'Draft'
      and exists (select 1 from public.profiles m where m.id = auth.uid() and m.role = 'manager')
  ) x
  where x.st is not null
    and (p_user is null or x.user_id = p_user)
    and (p_status is null or x.st = p_status)
  order by x.week_start desc, x.employee, x.entry_date, x.project;
$$;

-- Hours by project for the signed-in user in the month containing p_month.
create function public.my_month_summary(p_month date)
returns table (project text, hours numeric)
language sql stable security invoker set search_path = '' as $$
  select pr.name, sum(e.hours)
  from public.entries e
  join public.timesheets t on t.id = e.timesheet_id
  join public.projects pr on pr.id = e.project_id
  where t.user_id = auth.uid()
    and not e.is_rejected
    and e.entry_date >= date_trunc('month', p_month)::date
    and e.entry_date < (date_trunc('month', p_month) + interval '1 month')::date
  group by pr.name
  order by sum(e.hours) desc, pr.name;
$$;

-- functions are executable by PUBLIC by default; only signed-in users may call the RPCs
revoke execute on function
  public.create_next_timesheet(),
  public.submit_timesheet(uuid),
  public.review_day(uuid, date, public.review_status, text),
  public.report_entries(uuid, text),
  public.my_month_summary(date),
  public.entries_guard()
from public, anon;

grant execute on function
  public.create_next_timesheet(),
  public.submit_timesheet(uuid),
  public.review_day(uuid, date, public.review_status, text),
  public.report_entries(uuid, text),
  public.my_month_summary(date)
to authenticated;
