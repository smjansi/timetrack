-- pgTAP: RLS and business rules. Self-contained; rolled back at the end.
begin;
select plan(22);

-- fixtures (as the table owner) -------------------------------------------------
insert into auth.users (id, aud, role, email, raw_app_meta_data, raw_user_meta_data, created_at, updated_at) values
  ('a0000000-0000-4000-8000-000000000001', 'authenticated', 'authenticated', 'm1@t.test',    '{}', '{"full_name":"M1"}',    now(), now()),
  ('a0000000-0000-4000-8000-000000000002', 'authenticated', 'authenticated', 'm2@t.test',    '{}', '{"full_name":"M2"}',    now(), now()),
  ('a0000000-0000-4000-8000-000000000003', 'authenticated', 'authenticated', 'alice@t.test', '{}', '{"full_name":"Alice"}', now(), now()),
  ('a0000000-0000-4000-8000-000000000004', 'authenticated', 'authenticated', 'bob@t.test',   '{}', '{"full_name":"Bob"}',   now(), now()),
  ('a0000000-0000-4000-8000-000000000005', 'authenticated', 'authenticated', 'carol@t.test', '{}', '{"full_name":"Carol"}', now(), now());
update public.profiles set role = 'manager' where email in ('m1@t.test', 'm2@t.test');
update public.profiles set manager_id = 'a0000000-0000-4000-8000-000000000001' where email in ('alice@t.test', 'bob@t.test');
update public.profiles set manager_id = 'a0000000-0000-4000-8000-000000000002' where email = 'carol@t.test';

-- week of Mon 2026-10-05; Alice's is Submitted with Mon (6h) and Tue (4h), Bob's and Carol's are Draft
insert into public.timesheets (id, user_id, week_start, status) values
  ('b0000000-0000-4000-8000-000000000001', 'a0000000-0000-4000-8000-000000000003', '2026-10-05', 'Submitted'),
  ('b0000000-0000-4000-8000-000000000002', 'a0000000-0000-4000-8000-000000000004', '2026-10-05', 'Draft'),
  ('b0000000-0000-4000-8000-000000000003', 'a0000000-0000-4000-8000-000000000005', '2026-10-05', 'Submitted');
insert into public.entries (timesheet_id, entry_date, project_id, task_id, hours)
select 'b0000000-0000-4000-8000-000000000001', d, (select id from public.projects limit 1), (select id from public.tasks limit 1), h
from (values ('2026-10-05'::date, 6), ('2026-10-06'::date, 4)) v(d, h);
insert into public.entries (timesheet_id, entry_date, project_id, task_id, hours)
values ('b0000000-0000-4000-8000-000000000003', '2026-10-05', (select id from public.projects limit 1), (select id from public.tasks limit 1), 5);

create function pg_temp.act_as(p_uid text) returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims', json_build_object('sub', p_uid, 'role', 'authenticated')::text, true);
  set local role authenticated;
end;
$$;
grant execute on function pg_temp.act_as(text) to public;

-- employee isolation -------------------------------------------------------------
select pg_temp.act_as('a0000000-0000-4000-8000-000000000004');   -- Bob
select is((select count(*)::int from public.timesheets where user_id = 'a0000000-0000-4000-8000-000000000003'), 0,
  'employee cannot read another employee''s timesheet');
select is((select count(*)::int from public.entries where timesheet_id = 'b0000000-0000-4000-8000-000000000001'), 0,
  'employee cannot read another employee''s entries');
select throws_ok(
  $$insert into public.entries (timesheet_id, entry_date, project_id, task_id, hours)
    values ('b0000000-0000-4000-8000-000000000001', '2026-10-07', (select id from public.projects limit 1), (select id from public.tasks limit 1), 1)$$,
  'P0001', 'Timesheet not found.', 'employee cannot add an entry to another employee''s timesheet');
select throws_ok($$update public.timesheets set status = 'Approved' where id = 'b0000000-0000-4000-8000-000000000002'$$,
  '42501', null, 'employee cannot write timesheet status directly');
select throws_ok($$insert into public.day_reviews (timesheet_id, entry_date, status, reviewer_id)
  values ('b0000000-0000-4000-8000-000000000002', '2026-10-05', 'Approved', 'a0000000-0000-4000-8000-000000000004')$$,
  '42501', null, 'employee cannot write day reviews directly');
select throws_ok($$update public.profiles set role = 'manager' where id = 'a0000000-0000-4000-8000-000000000004'$$,
  '42501', null, 'employee cannot promote themselves');
select throws_ok($$select public.review_day('b0000000-0000-4000-8000-000000000001', '2026-10-05', 'Approved', '')$$,
  '42501', 'Only managers can review timesheets.', 'employee cannot call review_day');

-- entry rules (Bob, own Draft timesheet) --------------------------------------------
select lives_ok(
  $$insert into public.entries (timesheet_id, entry_date, project_id, task_id, hours)
    values ('b0000000-0000-4000-8000-000000000002', '2026-10-05', (select id from public.projects limit 1), (select id from public.tasks limit 1), 6)$$,
  'employee can add an entry to their own timesheet');
select throws_ok(
  $$insert into public.entries (timesheet_id, entry_date, project_id, task_id, hours)
    values ('b0000000-0000-4000-8000-000000000002', '2026-10-05', (select id from public.projects limit 1), (select id from public.tasks limit 1), 3)$$,
  'P0001', 'Total for this day cannot exceed 8.5 hours (6 already logged).', 'daily cap of 8.5 is enforced');
select throws_ok(
  $$insert into public.entries (timesheet_id, entry_date, project_id, task_id, hours)
    values ('b0000000-0000-4000-8000-000000000002', '2026-10-06', (select id from public.projects limit 1), (select id from public.tasks limit 1), 0.25)$$,
  'P0001', 'Hours must be between 0.5 and 8.5.', 'entry below 0.5 hours is refused');
select throws_ok(
  $$insert into public.entries (timesheet_id, entry_date, project_id, task_id, hours)
    values ('b0000000-0000-4000-8000-000000000002', '2026-10-13', (select id from public.projects limit 1), (select id from public.tasks limit 1), 1)$$,
  'P0001', 'Date must fall within the timesheet week.', 'entry outside the week is refused');
select throws_ok($$select public.submit_timesheet('b0000000-0000-4000-8000-000000000001')$$,
  '42501', 'Timesheet not found.', 'employee cannot submit someone else''s timesheet');

-- manager scope and review rules ------------------------------------------------------
select pg_temp.act_as('a0000000-0000-4000-8000-000000000001');   -- M1 (manages Alice and Bob)
select is((select count(*)::int from public.timesheets where user_id = 'a0000000-0000-4000-8000-000000000005'), 0,
  'manager cannot read timesheets of another team');
select is((select count(*)::int from public.timesheets where user_id = 'a0000000-0000-4000-8000-000000000003'), 1,
  'manager can read a report''s timesheet');
select throws_ok($$select public.review_day('b0000000-0000-4000-8000-000000000003', '2026-10-05', 'Approved', '')$$,
  '42501', 'You can only review timesheets of your own team.', 'manager cannot review another team');
select throws_ok($$select public.review_day('b0000000-0000-4000-8000-000000000001', '2026-10-05', 'Rejected', '  ')$$,
  'P0001', 'Add a comment to reject this day.', 'reject requires a comment');
select is(public.review_day('b0000000-0000-4000-8000-000000000001', '2026-10-05', 'Rejected', 'Split the hours'), 'Submitted'::public.ts_status,
  'one decision leaves the timesheet Submitted');
select is(public.review_day('b0000000-0000-4000-8000-000000000001', '2026-10-06', 'Approved', ''), 'Rejected'::public.ts_status,
  'timesheet becomes Rejected once every day is decided and one is rejected');

-- employee fixes and resubmits; approved day is locked ---------------------------------
select pg_temp.act_as('a0000000-0000-4000-8000-000000000003');   -- Alice
select throws_ok($$delete from public.entries where timesheet_id = 'b0000000-0000-4000-8000-000000000001' and entry_date = '2026-10-05'$$,
  'P0001', 'Rejected entries cannot be deleted. Add a corrected entry instead.', 'rejected entries cannot be deleted');
select throws_ok(
  $$insert into public.entries (timesheet_id, entry_date, project_id, task_id, hours)
    values ('b0000000-0000-4000-8000-000000000001', '2026-10-06', (select id from public.projects limit 1), (select id from public.tasks limit 1), 1)$$,
  'P0001', 'That day is already approved and locked.', 'approved day cannot get new entries');

select lives_ok(
  $$insert into public.entries (timesheet_id, entry_date, project_id, task_id, hours)
    values ('b0000000-0000-4000-8000-000000000001', '2026-10-05', (select id from public.projects limit 1), (select id from public.tasks limit 1), 8)$$,
  'corrected entry counts towards a day whose old entry is rejected');

select pg_temp.act_as('a0000000-0000-4000-8000-000000000003');
select public.submit_timesheet('b0000000-0000-4000-8000-000000000001');
select pg_temp.act_as('a0000000-0000-4000-8000-000000000001');
select is(public.review_day('b0000000-0000-4000-8000-000000000001', '2026-10-05', 'Approved', ''), 'Approved'::public.ts_status,
  'resubmitted timesheet is Approved once the fixed day is approved');

select * from finish();
rollback;
