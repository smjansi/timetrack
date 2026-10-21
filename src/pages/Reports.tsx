import { useState } from 'react';
import { useAuth } from '../auth/AuthProvider';
import { useReport, useTeam } from '../api/manager';
import { dayLabelFor } from '../domain/dates';
import { barsBy, reportTotal, type Bar } from '../domain/review';
import { Loadable } from '../components/Loadable';
import { PageHeader } from '../components/PageHeader';
import { StatusBadge } from '../components/StatusBadge';

const STATUS_COLOR: Record<string, string> = {
  Submitted: '#0078d4', Approved: '#107c10', Rejected: '#d13438',
};

function Chart({ title, bars, color }: { title: string; bars: Bar[]; color: (name: string) => string }) {
  return (
    <section className="card stack" aria-label={title}>
      <strong>{title}</strong>
      {bars.length === 0 && <div className="muted">No entries for this filter</div>}
      {bars.map((b) => (
        <div key={b.name} className="bar-row">
          <span className="bar-name">{b.name}</span>
          <div className="bar-track"><div className="bar-fill" style={{ width: `${b.pct}%`, background: color(b.name) }} /></div>
          <span className="bar-value">{b.hours} h</span>
        </div>
      ))}
    </section>
  );
}

export function Reports() {
  const { profile } = useAuth();
  const [userId, setUserId] = useState('All');
  const [status, setStatus] = useState('All');
  const team = useTeam();
  const report = useReport({ userId, status });

  return (
    <>
      <PageHeader title="Entries report" subtitle={`${profile?.full_name ?? ''} · your team`} />
      <div className="content">
        <div className="field-row">
          <div className="field">
            <label htmlFor="r-emp">Employee</label>
            <select id="r-emp" className="input" value={userId} onChange={(e) => setUserId(e.target.value)}>
              <option value="All">All employees</option>
              {(team.data ?? []).map((m) => <option key={m.id} value={m.id}>{m.full_name}</option>)}
            </select>
          </div>
          <div className="field">
            <label htmlFor="r-status">Status</label>
            <select id="r-status" className="input" value={status} onChange={(e) => setStatus(e.target.value)}>
              <option value="All">All statuses</option>
              {['Submitted', 'Approved', 'Rejected'].map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
        </div>
        <Loadable query={report} title="Entries report" bare>
          {(rows) => (
            <>
              <div className="kpi-row kpi-2">
                <div className="card kpi"><div className="muted">Entries shown</div><div className="kpi-value">{rows.length}</div></div>
                <div className="card kpi"><div className="muted">Total hours</div><div className="kpi-value">{reportTotal(rows)} hrs</div></div>
              </div>
              <Chart title="Hours by project" bars={barsBy(rows, 'project')} color={() => '#0078d4'} />
              <Chart title="Hours by employee" bars={barsBy(rows, 'employee')} color={() => '#5c2e91'} />
              <Chart title="Hours by status" bars={barsBy(rows, 'status')} color={(n) => STATUS_COLOR[n] ?? '#605e5c'} />
              {rows.map((r) => (
                <div key={r.entry_id} className="card report-row">
                  <span className="list-main">
                    <span className="entry-project">
                      {r.employee} <span className="muted">{dayLabelFor(r.week_start, r.entry_date)}</span>
                    </span>
                    <span>{r.project} <span className="muted">· {r.task}</span></span>
                  </span>
                  <span className="list-side">
                    <strong>{r.hours} h</strong>
                    <StatusBadge status={r.status} />
                  </span>
                </div>
              ))}
              {rows.length === 0 && <div className="card empty">No entries match these filters.</div>}
            </>
          )}
        </Loadable>
      </div>
    </>
  );
}
