import { useNavigate } from 'react-router-dom';
import { useAuth } from '../auth/AuthProvider';
import { useCreateTimesheet, useTimesheetList, type TimesheetListItem } from '../api/timesheets';
import { isoWeekNumber, mondayOf, todayIso, weekRange } from '../domain/dates';
import { countedHours } from '../domain/timesheet';
import { Loadable } from '../components/Loadable';
import { PageHeader } from '../components/PageHeader';
import { StatusBadge } from '../components/StatusBadge';
import { useToast } from '../components/Toast';

function Kpi({ label, value }: { label: string; value: string }) {
  return (
    <div className="card kpi">
      <div className="muted">{label}</div>
      <div className="kpi-value">{value}</div>
    </div>
  );
}

function List({ items }: { items: TimesheetListItem[] }) {
  const { profile } = useAuth();
  const navigate = useNavigate();
  const toast = useToast();
  const create = useCreateTimesheet();

  const thisMonday = mondayOf(todayIso());
  const thisWeek = items.find((t) => t.week_start === thisMonday);

  function newTimesheet() {
    create.mutate(undefined, {
      onSuccess: (id) => {
        if (!items.some((t) => t.id === id)) toast('New timesheet created');
        navigate(`/timesheets/${id}`);
      },
      onError: (e) => toast(e.message),
    });
  }

  return (
    <>
    <PageHeader title="My Timesheet" subtitle={profile ? `${profile.full_name} · ${profile.role === 'manager' ? 'Manager' : 'Employee'}` : ''} />
    <div className="content">
      <div className="kpi-row">
        <Kpi label="This week" value={`${thisWeek ? countedHours(thisWeek.entries) : 0} hrs`} />
        <Kpi label="Submitted" value={String(items.filter((t) => t.status === 'Submitted').length)} />
        <Kpi label="Rejected" value={String(items.filter((t) => t.status === 'Rejected').length)} />
      </div>
      <button type="button" className="btn btn-primary" onClick={newTimesheet} disabled={create.isPending}>
        + New timesheet
      </button>
      {items.length === 0 && <div className="card empty">No timesheets yet. Tap “New timesheet” to start.</div>}
      {items.map((t) => (
        <button key={t.id} type="button" className="card list-card" onClick={() => navigate(`/timesheets/${t.id}`)}>
          <span className="list-main">
            <span className="list-title">{weekRange(t.week_start)}</span>
            {t.status === 'Rejected' && t.comment ? (
              <span className="list-sub danger">Manager: {t.comment}</span>
            ) : (
              <span className="list-sub">Week {isoWeekNumber(t.week_start)}</span>
            )}
          </span>
          <span className="list-side">
            <span className="list-title">{countedHours(t.entries)} hrs</span>
            <StatusBadge status={t.status} />
          </span>
        </button>
      ))}
    </div>
    </>
  );
}

export function Home() {
  const { profile } = useAuth();
  const query = useTimesheetList(profile?.id ?? '');
  return <Loadable query={query} title="My Timesheet">{(items) => <List items={items} />}</Loadable>;
}
