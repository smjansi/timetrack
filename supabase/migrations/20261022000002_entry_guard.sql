-- Business rules for entries written directly by employees.
-- The RPCs run as the function owner and are exempt (current_user <> 'authenticated').

create function public.entries_guard() returns trigger
language plpgsql set search_path = '' as $$
declare
  v_ts public.timesheets;
  v_logged numeric;
begin
  if current_user <> 'authenticated' then
    if tg_op = 'DELETE' then return old; end if;
    return new;
  end if;

  select * into v_ts from public.timesheets
  where id = case when tg_op = 'INSERT' then new.timesheet_id else old.timesheet_id end;
  if not found then
    raise exception 'Timesheet not found.';
  end if;
  if v_ts.status = 'Approved' then
    raise exception 'This timesheet is approved and read-only.';
  end if;

  if tg_op in ('UPDATE', 'DELETE') then
    if old.is_rejected then
      raise exception 'Rejected entries cannot be %. Add a corrected entry instead.',
        case tg_op when 'DELETE' then 'deleted' else 'edited' end;
    end if;
    if exists (select 1 from public.day_reviews
               where timesheet_id = old.timesheet_id and entry_date = old.entry_date and status = 'Approved') then
      raise exception 'That day is already approved and locked.';
    end if;
  end if;
  if tg_op = 'DELETE' then return old; end if;

  if new.entry_date < v_ts.week_start or new.entry_date > v_ts.week_start + 6 then
    raise exception 'Date must fall within the timesheet week.';
  end if;
  if new.hours < 0.5 or new.hours > 8.5 then
    raise exception 'Hours must be between 0.5 and 8.5.';
  end if;
  if exists (select 1 from public.day_reviews
             where timesheet_id = new.timesheet_id and entry_date = new.entry_date and status = 'Approved') then
    raise exception 'That day is already approved and locked.';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(new.timesheet_id::text || new.entry_date::text, 0));
  select coalesce(sum(hours), 0) into v_logged from public.entries
  where timesheet_id = new.timesheet_id and entry_date = new.entry_date
    and not is_rejected and id <> new.id;
  if v_logged + new.hours > 8.5 then
    raise exception 'Total for this day cannot exceed 8.5 hours (% already logged).', trim_scale(v_logged);
  end if;
  return new;
end;
$$;

create trigger entries_guard_trg before insert or update or delete on public.entries
  for each row execute function public.entries_guard();
