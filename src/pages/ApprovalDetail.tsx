import { useState } from 'react';
import { Navigate, useNavigate, useParams } from 'react-router-dom';
import { useLookups } from '../api/timesheets';
import { useReviewDay, useReviewTimesheet, type PendingItem } from '../api/manager';
import { dayLabelFor, weekRange } from '../domain/dates';
import { entriesToReview, reviewableDays } from '../domain/review';
import { countedHours, type ReviewStatus } from '../domain/timesheet';
import { Loadable } from '../components/Loadable';
import { PageHeader } from '../components/PageHeader';
import { StatusBadge } from '../components/StatusBadge';
import { useToast } from '../components/Toast';

function DayCard({ ts, date }: { ts: PendingItem; date: string }) {
  const navigate = useNavigate();
  const toast = useToast();
  const lookups = useLookups();
  const review = useReviewDay();
  const existing = ts.reviews.find((r) => r.entry_date === date);
  const [comment, setComment] = useState(existing?.comment ?? '');
  const [error, setError] = useState('');

  const entries = entriesToReview(ts.entries, existing, date);
  const status = existing ? existing.status : 'Pending';
  const label = dayLabelFor(ts.week_start, date);

  function decide(next: ReviewStatus) {
    if (next === 'Rejected' && !comment.trim()) {
      setError('Add a comment to reject this day.');
      return;
    }
    setError('');
    review.mutate(
      { timesheetId: ts.id, date, status: next, comment },
      {
        onSuccess: (result) => {
          if (result === 'Submitted') {
            toast(`${label} ${next === 'Approved' ? 'approved' : 'rejected'} · ${ts.employee}`);
          } else {
            toast(`Timesheet ${result === 'Rejected' ? 'rejected' : 'approved'} · ${ts.employee}`);
            navigate('/approvals');
          }
        },
        onError: (e) => setError(e.message),
      },
    );
  }

  const name = (list: { id: string; name: string }[] | undefined, id: string) => list?.find((x) => x.id === id)?.name ?? '';
  const inputId = `comment-${date}`;

  return (
    <section className="card review-day" aria-label={label}>
      <div className="split">
        <strong className="day-name">{label}</strong>
        <span className="day-meta">
          <span className="muted">{countedHours(entries)} hrs</span>
          <StatusBadge status={status} />
        </span>
      </div>
      {entries.map((e) => (
        <div key={e.id} className="split review-entry">
          <span>
            <strong>{name(lookups.data?.projects, e.project_id)}</strong>{' '}
            <span className="muted">· {name(lookups.data?.tasks, e.task_id)}</span>
          </span>
          <span>{e.hours} h</span>
        </div>
      ))}
      <label htmlFor={inputId} className="sr-only">Comment (to reject)</label>
      <input id={inputId} className="input" type="text" placeholder="Comment (to reject)" value={comment}
        maxLength={500} onChange={(e) => { setComment(e.target.value); setError(''); }} />
      {error && <div role="alert" className="field-error">{error}</div>}
      <div className="review-actions">
        <button type="button" className="btn btn-reject" disabled={review.isPending} onClick={() => decide('Rejected')}>
          Reject
        </button>
        <button type="button" className="btn btn-approve" disabled={review.isPending} onClick={() => decide('Approved')}>
          Approve
        </button>
      </div>
    </section>
  );
}

export function ApprovalDetail() {
  const { id } = useParams();
  const query = useReviewTimesheet(id);

  return (
    <Loadable query={query} title="Review timesheet" backTo="/approvals">
      {(ts) => {
        if (!ts) return <Navigate to="/approvals" replace />;
        const days = reviewableDays(ts.entries, ts.reviews);
        return (
          <>
            <PageHeader title={ts.employee} subtitle={`${weekRange(ts.week_start)} · ${countedHours(ts.entries)} hrs`}
              backTo="/approvals" />
            <div className="content">
              <p className="muted">
                Review each day: approve it, or reject it with a comment. The timesheet is finished once every day has a decision.
              </p>
              {days.map((d) => <DayCard key={d + (ts.reviews.find((r) => r.entry_date === d)?.reviewed_at ?? '')} ts={ts} date={d} />)}
            </div>
          </>
        );
      }}
    </Loadable>
  );
}
