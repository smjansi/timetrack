import { useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '../auth/AuthProvider';
import {
  useDeleteEntry, useLookups, useSubmitTimesheet, useTimesheet, type Option, type TimesheetDetail,
} from '../api/timesheets';
import { DAY_NAMES, addDays, formatShort, todayIso, weekRange } from '../domain/dates';
import {
  countedHours, dayReviewLabel, isDayOpen, isEditable, submitState, type Entry,
} from '../domain/timesheet';
import { Loadable } from '../components/Loadable';
import { Message } from '../components/Message';
import { PageHeader } from '../components/PageHeader';
import { StatusBadge } from '../components/StatusBadge';
import { useToast } from '../components/Toast';

function EntryRow({ entry, projects, tasks, canEdit, canDelete, onEdit, onDelete }: {
  entry: Entry; projects: Option[]; tasks: Option[]; canEdit: boolean; canDelete: boolean;
  onEdit: () => void; onDelete: () => void;
}) {
  const project = projects.find((p) => p.id === entry.project_id)?.name ?? '';
  const task = tasks.find((t) => t.id === entry.task_id)?.name ?? '';
  const body = (
    <>
      <span className="entry-text">
        <span className="entry-project">{project}</span>
        <span className="muted">{task}</span>
        {entry.is_rejected && <span className="chip-rej">Rejected</span>}
      </span>
      <span className="entry-hours">{entry.hours} hrs</span>
    </>
  );
  return (
    <div className="entry-row">
      {canEdit ? (
        <button type="button" className="entry-main" onClick={onEdit}
          aria-label={`Edit ${project}, ${task}, ${entry.hours} hours`}>
          {body}
        </button>
      ) : (
        <div className="entry-main">{body}</div>
      )}
      {canDelete && (
        <button type="button" className="icon-btn danger" aria-label={`Delete ${project} entry`} onClick={onDelete}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
            strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M3 6h18M8 6V4h8v2M6 6l1 14h10l1-14M10 11v5M14 11v5" />
          </svg>
        </button>
      )}
    </div>
  );
}

function Week({ ts }: { ts: TimesheetDetail }) {
  const navigate = useNavigate();
  const toast = useToast();
  const lookups = useLookups();
  const submit = useSubmitTimesheet();
  const remove = useDeleteEntry();

  const editable = isEditable(ts.status);
  const state = submitState(ts.status);
  const today = todayIso();
  const projects = lookups.data?.projects ?? [];
  const tasks = lookups.data?.tasks ?? [];

  function doSubmit() {
    submit.mutate(ts.id, {
      onSuccess: () => toast('Timesheet submitted for approval'),
      onError: (e) => toast(e.message),
    });
  }
  function doDelete(id: string) {
    remove.mutate(id, { onError: (e) => toast(e.message) });
  }

  return (
    <>
      <PageHeader title="Weekly timesheet" subtitle={weekRange(ts.week_start)} backTo="/"
        right={<StatusBadge status={ts.status} />} />
      <div className="content">
        <div className="week-total">
          <span className="muted">Week total</span>
          <span className="week-total-value">{countedHours(ts.entries)} hrs</span>
        </div>
        {ts.status === 'Rejected' && ts.comment && (
          <div role="status" className="error-box">Manager comment: {ts.comment}</div>
        )}
        {DAY_NAMES.map((name, i) => {
          const date = addDays(ts.week_start, i);
          const entries = ts.entries.filter((e) => e.entry_date === date);
          const review = entries.length > 0 ? dayReviewLabel(ts.status, ts.day_reviews, date) : null;
          const open = editable && isDayOpen(ts.day_reviews, date);
          return (
            <section key={date} className="card day" aria-label={`${name} ${formatShort(date)}`}>
              <header className={'day-head' + (date === today ? ' today' : '')}>
                <span className="day-name">{name} <span className="muted">{formatShort(date)}</span></span>
                <span className="day-meta">
                  {review && <StatusBadge status={review} />}
                  <strong>{countedHours(entries)} hrs</strong>
                </span>
              </header>
              <div className="day-body">
                {entries.map((e) => (
                  <EntryRow key={e.id} entry={e} projects={projects} tasks={tasks}
                    canEdit={open && !e.is_rejected} canDelete={open && !e.is_rejected}
                    onEdit={() => navigate(`/timesheets/${ts.id}/entries/${e.id}`)}
                    onDelete={() => doDelete(e.id)} />
                ))}
                {entries.length === 0 && <div className="muted">No entries</div>}
                {open && (
                  <button type="button" className="btn-add"
                    onClick={() => navigate(`/timesheets/${ts.id}/entries/new?date=${date}`)}>
                    + Add entry <span className="sr-only">for {name} {formatShort(date)}</span>
                  </button>
                )}
              </div>
            </section>
          );
        })}
      </div>
      <footer className="footer-bar">
        <span className="muted">{state.note}</span>
        <button type="button" className="btn btn-primary" onClick={doSubmit}
          disabled={state.disabled || submit.isPending}>
          {state.label}
        </button>
      </footer>
    </>
  );
}

export function Weekly() {
  const { id } = useParams();
  const { profile } = useAuth();
  const query = useTimesheet(id);
  return (
    <Loadable query={query} title="Weekly timesheet" backTo="/">
      {(ts) =>
        ts && ts.user_id === profile?.id ? (
          <Week ts={ts} />
        ) : (
          <Message title="Timesheet not found" inline actions={[{ label: 'Back to my timesheets', href: '/' }]}>
            It may have been removed, or it belongs to someone else.
          </Message>
        )
      }
    </Loadable>
  );
}
