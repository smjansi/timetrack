-- DEV ONLY. Applied by `supabase start` / `supabase db reset`, never by `supabase db push`.
-- Sample users mirror the prototype. Sign in with a magic link (local Inbucket: http://127.0.0.1:54324).

insert into auth.users (id, aud, role, email, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
values
  ('00000000-0000-4000-8000-000000000001', 'authenticated', 'authenticated', 'alex@contoso.test',   now(), '{"provider":"email","providers":["email"]}', '{"full_name":"Alex"}',   now(), now()),
  ('00000000-0000-4000-8000-000000000002', 'authenticated', 'authenticated', 'jordan@contoso.test', now(), '{"provider":"email","providers":["email"]}', '{"full_name":"Jordan"}', now(), now()),
  ('00000000-0000-4000-8000-000000000003', 'authenticated', 'authenticated', 'sam@contoso.test',    now(), '{"provider":"email","providers":["email"]}', '{"full_name":"Sam"}',    now(), now()),
  ('00000000-0000-4000-8000-000000000004', 'authenticated', 'authenticated', 'riya@contoso.test',   now(), '{"provider":"email","providers":["email"]}', '{"full_name":"Riya"}',   now(), now()),
  ('00000000-0000-4000-8000-000000000005', 'authenticated', 'authenticated', 'priya@contoso.test',  now(), '{"provider":"email","providers":["email"]}', '{"full_name":"Priya"}',  now(), now());

update public.profiles set role = 'manager' where email = 'priya@contoso.test';
update public.profiles set manager_id = (select id from public.profiles where email = 'priya@contoso.test')
where email in ('alex@contoso.test', 'jordan@contoso.test', 'sam@contoso.test', 'riya@contoso.test');

-- p_rows: [[day 0-4, project, task, hours], ...]; p_weeks_ago 0 = current week.
-- Approved/Rejected sheets also get day reviews; p_reject_day (0-based) is the rejected day.
create function pg_temp.seed_sheet(
  p_email text, p_weeks_ago int, p_status public.ts_status, p_rows jsonb,
  p_reject_day int default null, p_reject_comment text default ''
) returns void language plpgsql as $$
declare
  v_user uuid;
  v_mgr uuid;
  v_week date := (date_trunc('week', now() at time zone 'Asia/Kolkata'))::date - 7 * p_weeks_ago;
  v_ts uuid;
  v_row jsonb;
  v_day date;
begin
  select id, manager_id into v_user, v_mgr from public.profiles where email = p_email;
  insert into public.timesheets (user_id, week_start, status, comment)
  values (v_user, v_week, p_status,
          case when p_status = 'Rejected' then 'Please split Wednesday hours by project.' else '' end)
  returning id into v_ts;

  for v_row in select * from jsonb_array_elements(p_rows) loop
    v_day := v_week + (v_row ->> 0)::int;
    insert into public.entries (timesheet_id, entry_date, project_id, task_id, hours, is_rejected, rejected_at)
    values (v_ts, v_day,
            (select id from public.projects where name = v_row ->> 1),
            (select id from public.tasks where name = v_row ->> 2),
            (v_row ->> 3)::numeric,
            coalesce((v_row ->> 0)::int = p_reject_day, false), case when (v_row ->> 0)::int = p_reject_day then now() end);
  end loop;

  if p_status in ('Approved', 'Rejected') then
    insert into public.day_reviews (timesheet_id, entry_date, status, comment, reviewer_id, reviewed_at)
    select v_ts, d.entry_date,
           case when d.entry_date = v_week + p_reject_day then 'Rejected'::public.review_status
                else 'Approved'::public.review_status end,
           case when d.entry_date = v_week + p_reject_day then p_reject_comment else '' end,
           coalesce(v_mgr, v_user), now()
    from (select distinct entry_date from public.entries where timesheet_id = v_ts) d;
  end if;
end;
$$;

select pg_temp.seed_sheet('alex@contoso.test', 0, 'Draft', '[[0,"Website Redesign","Development",6],[0,"Internal Training","Admin",2],[1,"Mobile App","Testing",8],[2,"CRM Migration","Meeting",3],[2,"CRM Migration","Development",5],[3,"Support Ops","Support",7.5],[4,"Website Redesign","Development",8]]');
select pg_temp.seed_sheet('alex@contoso.test', 1, 'Submitted', '[[0,"Website Redesign","Development",8],[1,"Website Redesign","Development",8],[2,"CRM Migration","Development",8],[3,"Mobile App","Testing",8],[4,"Support Ops","Support",8]]');
select pg_temp.seed_sheet('alex@contoso.test', 2, 'Approved', '[[0,"CRM Migration","Development",8],[1,"CRM Migration","Development",8],[2,"Mobile App","Testing",8],[3,"Support Ops","Support",7.5],[4,"Internal Training","Admin",7]]');
select pg_temp.seed_sheet('alex@contoso.test', 3, 'Rejected', '[[0,"Website Redesign","Development",7],[1,"Website Redesign","Development",7],[2,"CRM Migration","Development",8],[3,"Mobile App","Testing",7],[4,"Support Ops","Support",7]]', 2, 'Please split Wednesday hours by project.');
select pg_temp.seed_sheet('alex@contoso.test', 4, 'Approved', '[[0,"Mobile App","Development",8],[1,"Mobile App","Development",8],[2,"Mobile App","Testing",8],[3,"Website Redesign","Development",8],[4,"Internal Training","Admin",8]]');

select pg_temp.seed_sheet('jordan@contoso.test', 0, 'Draft', '[[0,"Website Redesign","Development",8],[1,"Website Redesign","Development",8],[2,"Mobile App","Meeting",3]]');
select pg_temp.seed_sheet('jordan@contoso.test', 1, 'Submitted', '[[0,"Website Redesign","Development",8],[1,"Website Redesign","Development",8],[2,"CRM Migration","Meeting",2],[2,"CRM Migration","Development",6],[3,"Mobile App","Testing",8],[4,"Mobile App","Testing",8]]');
select pg_temp.seed_sheet('jordan@contoso.test', 2, 'Approved', '[[0,"Mobile App","Development",8],[1,"Mobile App","Development",8],[2,"Mobile App","Testing",8],[3,"Mobile App","Testing",8],[4,"Internal Training","Admin",8]]');

select pg_temp.seed_sheet('sam@contoso.test', 1, 'Submitted', '[[0,"Support Ops","Support",7.5],[1,"Support Ops","Support",8],[2,"Internal Training","Admin",4],[2,"Support Ops","Support",4],[3,"Support Ops","Support",7],[4,"Mobile App","Testing",7]]');
select pg_temp.seed_sheet('sam@contoso.test', 2, 'Approved', '[[0,"Support Ops","Support",8],[1,"Support Ops","Support",8],[2,"Support Ops","Support",8],[3,"CRM Migration","Meeting",4],[3,"Support Ops","Support",4],[4,"Support Ops","Support",8]]');

select pg_temp.seed_sheet('riya@contoso.test', 1, 'Submitted', '[[0,"CRM Migration","Development",8],[1,"CRM Migration","Development",8],[2,"CRM Migration","Development",8],[3,"CRM Migration","Testing",8],[4,"Internal Training","Admin",8]]');

select pg_temp.seed_sheet('priya@contoso.test', 0, 'Draft', '[[0,"Internal Training","Admin",3],[1,"CRM Migration","Meeting",4],[2,"Support Ops","Support",5]]');
select pg_temp.seed_sheet('priya@contoso.test', 1, 'Submitted', '[[0,"Internal Training","Admin",4],[1,"CRM Migration","Meeting",6],[2,"Website Redesign","Meeting",5],[3,"Mobile App","Meeting",6],[4,"Support Ops","Admin",5]]');
select pg_temp.seed_sheet('priya@contoso.test', 2, 'Approved', '[[0,"CRM Migration","Meeting",6],[1,"Website Redesign","Meeting",6],[2,"Internal Training","Admin",5],[3,"Mobile App","Meeting",6],[4,"Support Ops","Admin",5]]');
