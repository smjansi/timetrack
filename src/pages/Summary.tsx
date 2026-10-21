import { useState } from 'react';
import { useAuth } from '../auth/AuthProvider';
import { useMonthSummary } from '../api/timesheets';
import { monthName, monthStart, monthTitle, todayIso } from '../domain/dates';
import { summarise } from '../domain/timesheet';
import { Loadable } from '../components/Loadable';
import { PageHeader } from '../components/PageHeader';

export function Summary() {
  const { profile } = useAuth();
  const [back, setBack] = useState(0);
  const month = monthStart(todayIso(), back);
  const query = useMonthSummary(month);

  const toggle = (
    <div className="segmented" role="group" aria-label="Period">
      <button type="button" aria-pressed={back === 0} onClick={() => setBack(0)}>This month</button>
      <button type="button" aria-pressed={back === 1} onClick={() => setBack(1)}>Last month</button>
    </div>
  );

  return (
    <>
      <PageHeader title="My summary" subtitle={`${profile?.full_name ?? ''} · hours by project`} />
      <div className="content">
        {toggle}
        <Loadable query={query} title="My summary" bare>
          {(rows) => {
            const s = summarise(rows);
            return (
              <>
                <div className="kpi-row kpi-2">
                  <div className="card kpi"><div className="muted">{monthName(month)} total</div><div className="kpi-value">{s.total} hrs</div></div>
                  <div className="card kpi"><div className="muted">Projects</div><div className="kpi-value">{s.projectCount}</div></div>
                </div>
                <div className="card">
                  <div className="muted">Most hours</div>
                  <div className="summary-day">{s.top?.name ?? '–'}</div>
                  <div className="muted">{s.top?.hours ?? 0} hrs</div>
                </div>
                <section className="card stack" aria-label="Hours by project">
                  <strong>Hours by project · {monthTitle(month)}</strong>
                  {s.bars.length === 0 && <div className="muted">No hours logged in this month.</div>}
                  {s.bars.map((b) => (
                    <div key={b.name} className="bar-row">
                      <span className="bar-name">{b.name}</span>
                      <div className="bar-track"><div className="bar-fill" style={{ width: `${b.pct}%` }} /></div>
                      <span className="bar-value">{b.hours} h</span>
                    </div>
                  ))}
                </section>
              </>
            );
          }}
        </Loadable>
      </div>
    </>
  );
}
