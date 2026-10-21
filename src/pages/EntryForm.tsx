import { useState } from 'react';
import { Navigate, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { useAuth } from '../auth/AuthProvider';
import { useLookups, useSaveEntry, useTimesheet, type TimesheetDetail } from '../api/timesheets';
import { DAY_NAMES, addDays, dayLabel, weekRange } from '../domain/dates';
import { isDayOpen, isEditable, loggedOnDay, remainingOnDay } from '../domain/timesheet';
import { MAX_DAY_HOURS, checkHours, round1 } from '../hours';
import { Loadable } from '../components/Loadable';
import { PageHeader } from '../components/PageHeader';
import { useToast } from '../components/Toast';

interface FormProps {
  ts: TimesheetDetail;
  entryId: string | null;
  initialDate: string;
}

function Form({ ts, entryId, initialDate }: FormProps) {
  const navigate = useNavigate();
  const toast = useToast();
  const save = useSaveEntry();
  const lookups = useLookups();
  const existing = entryId ? ts.entries.find((e) => e.id === entryId) : undefined;

  const [date, setDate] = useState(existing?.entry_date ?? initialDate);
  const [projectId, setProjectId] = useState(existing?.project_id ?? '');
  const [taskId, setTaskId] = useState(existing?.task_id ?? '');
  const [hours, setHours] = useState(existing ? String(existing.hours) : '');
  const [notes, setNotes] = useState(existing?.notes ?? '');
  const [error, setError] = useState('');

  const projects = lookups.data?.projects ?? [];
  const tasks = lookups.data?.tasks ?? [];
  const project = projectId || projects[0]?.id || '';
  const task = taskId || tasks[0]?.id || '';
  const back = `/timesheets/${ts.id}`;

  const logged = loggedOnDay(ts.entries, date, entryId ?? undefined);
  const parsed = Number(hours.trim());
  const previewOk = hours.trim() !== '' && !Number.isNaN(parsed) && parsed >= 0.5 && parsed <= MAX_DAY_HOURS;
  const dayText = dayLabel(ts.week_start, Math.max(0, DAY_NAMES.findIndex((_, i) => addDays(ts.week_start, i) === date)));
  const hoursInvalid = error.startsWith('Hours') || error.startsWith('Total');

  function onSave() {
    if (!isDayOpen(ts.day_reviews, date)) {
      setError('That day is already approved and locked.');
      return;
    }
    const check = checkHours(hours, logged);
    if (!check.ok) {
      setError(check.error);
      return;
    }
    setError('');
    save.mutate(
      { entryId, input: { timesheet_id: ts.id, entry_date: date, project_id: project, task_id: task, hours: parsed, notes } },
      {
        onSuccess: () => {
          toast('Entry saved');
          navigate(back);
        },
        onError: (e) => setError(e.message),
      },
    );
  }

  return (
    <>
      <PageHeader title={entryId ? 'Edit Entry' : 'Add Entry'} subtitle={weekRange(ts.week_start)} backTo={back} />
      <div className="content">
        <div className="field">
          <label htmlFor="f-date">Date</label>
          <select id="f-date" className="input" value={date}
            onChange={(e) => { setDate(e.target.value); setError(''); }}>
            {DAY_NAMES.map((_, i) => (
              <option key={i} value={addDays(ts.week_start, i)}>{dayLabel(ts.week_start, i)}</option>
            ))}
          </select>
        </div>
        <div className="field">
          <label htmlFor="f-project">Project</label>
          <select id="f-project" className="input" value={project} onChange={(e) => setProjectId(e.target.value)}>
            {projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
        </div>
        <div className="field-row">
          <div className="field">
            <label htmlFor="f-task">Task</label>
            <select id="f-task" className="input" value={task} onChange={(e) => setTaskId(e.target.value)}>
              {tasks.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
            </select>
          </div>
          <div className="field">
            <label htmlFor="f-hours">Hours (0.5 to {MAX_DAY_HOURS})</label>
            <input id="f-hours" className="input" type="text" inputMode="decimal" placeholder="e.g. 7.5"
              value={hours} aria-invalid={hoursInvalid}
              onChange={(e) => { setHours(e.target.value); setError(''); }} />
          </div>
        </div>
        <div className="field">
          <label htmlFor="f-notes">Notes</label>
          <textarea id="f-notes" className="input textarea" placeholder="Optional" value={notes}
            maxLength={1000} onChange={(e) => setNotes(e.target.value)} />
        </div>

        <div className="card summary-card" aria-live="polite">
          <div className="muted">Day summary</div>
          <div className="summary-day">{dayText}</div>
          <div className="progress" role="progressbar" aria-valuemin={0} aria-valuemax={MAX_DAY_HOURS}
            aria-valuenow={logged} aria-label="Hours already logged">
            <div style={{ width: `${Math.min(100, Math.round((logged / MAX_DAY_HOURS) * 100))}%` }} />
          </div>
          <div className="split"><span className="muted">Already logged</span><strong>{logged} hrs</strong></div>
          <div className="split"><span className="muted">Remaining (of {MAX_DAY_HOURS})</span><strong>{remainingOnDay(logged)} hrs</strong></div>
          <div className="muted summary-after">
            {previewOk ? `With this entry: ${round1(logged + parsed)} hrs on ${dayText}.` : 'Enter hours to preview the day total.'}
          </div>
        </div>

        {error && <div role="alert" className="error-box">{error}</div>}
      </div>
      <footer className="footer-bar footer-row">
        <button type="button" className="btn btn-secondary" onClick={() => navigate(back)}>Cancel</button>
        <button type="button" className="btn btn-primary" onClick={onSave} disabled={save.isPending || !project || !task}>
          {save.isPending ? 'Saving…' : 'Save entry'}
        </button>
      </footer>
    </>
  );
}

export function EntryForm() {
  const { id, entryId } = useParams();
  const [params] = useSearchParams();
  const { profile } = useAuth();
  const query = useTimesheet(id);
  const title = entryId ? 'Edit Entry' : 'Add Entry';

  return (
    <Loadable query={query} title={title} backTo={`/timesheets/${id}`}>
      {(ts) => {
        if (!ts || ts.user_id !== profile?.id || !isEditable(ts.status)) return <Navigate to="/" replace />;
        const existing = entryId ? ts.entries.find((e) => e.id === entryId) : undefined;
        if (entryId && (!existing || existing.is_rejected || !isDayOpen(ts.day_reviews, existing.entry_date))) {
          return <Navigate to={`/timesheets/${ts.id}`} replace />;
        }
        const asked = params.get('date') ?? '';
        const days = DAY_NAMES.map((_, i) => addDays(ts.week_start, i));
        const initialDate = days.includes(asked) ? asked : ts.week_start;
        return <Form ts={ts} entryId={entryId ?? null} initialDate={initialDate} />;
      }}
    </Loadable>
  );
}
