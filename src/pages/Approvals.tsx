import { useNavigate } from 'react-router-dom';
import { useAuth } from '../auth/AuthProvider';
import { usePendingTimesheets } from '../api/manager';
import { weekRange } from '../domain/dates';
import { reviewProgress } from '../domain/review';
import { countedHours } from '../domain/timesheet';
import { Loadable } from '../components/Loadable';
import { PageHeader } from '../components/PageHeader';

export function Approvals() {
  const { profile } = useAuth();
  const navigate = useNavigate();
  const query = usePendingTimesheets(profile?.id ?? '');

  return (
    <Loadable query={query} title="Approvals">
      {(items) => (
        <>
          <PageHeader title="Approvals" subtitle={`${profile?.full_name ?? ''} · submitted timesheets from your team`} />
          <div className="content">
            {items.length === 0 && <div className="card empty">Nothing waiting for review.</div>}
            {items.map((t) => {
              const progress = reviewProgress(t.entries, t.reviews);
              return (
                <button key={t.id} type="button" className="card list-card" onClick={() => navigate(`/approvals/${t.id}`)}>
                  <span className="list-main">
                    <span className="list-title approvals-name">{t.employee}</span>
                    <span className="list-sub">{weekRange(t.week_start)}</span>
                    <span className="list-sub">{progress.done} of {progress.total} days reviewed</span>
                  </span>
                  <span className="list-title">{countedHours(t.entries)} hrs</span>
                </button>
              );
            })}
          </div>
        </>
      )}
    </Loadable>
  );
}
