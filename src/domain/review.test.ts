import { describe, expect, it } from 'vitest';
import {
  barsBy, entriesToReview, reportTotal, reviewableDays, reviewProgress, type ReportRow, type ReviewEntry, type ReviewRow,
} from './review';

const entry = (over: Partial<ReviewEntry>): ReviewEntry => ({
  id: 'e', entry_date: '2026-10-12', project_id: 'p', task_id: 't', hours: 1, is_rejected: false, rejected_at: null, ...over,
});
const review = (over: Partial<ReviewRow>): ReviewRow => ({
  entry_date: '2026-10-12', status: 'Approved', comment: '', reviewed_at: 'T1', ...over,
});

describe('review days', () => {
  const entries = [
    entry({ id: '1', entry_date: '2026-10-13' }),
    entry({ id: '2', entry_date: '2026-10-12', is_rejected: true, rejected_at: 'T0' }),
    entry({ id: '3', entry_date: '2026-10-14' }),
  ];
  it('lists counted days and already-decided days, ignoring days with only old rejected entries', () => {
    expect(reviewableDays(entries, [])).toEqual(['2026-10-13', '2026-10-14']);
    expect(reviewableDays(entries, [review({ entry_date: '2026-10-12', status: 'Rejected' })])).toEqual([
      '2026-10-12', '2026-10-13', '2026-10-14',
    ]);
  });
  it('counts progress against reviewable days', () => {
    expect(reviewProgress(entries, [review({ entry_date: '2026-10-13' })])).toEqual({ done: 1, total: 2 });
  });
  it('shows only the current rejection\'s entries besides counted ones', () => {
    const day = [
      entry({ id: 'old', is_rejected: true, rejected_at: 'T0' }),
      entry({ id: 'now', is_rejected: true, rejected_at: 'T1' }),
      entry({ id: 'new' }),
    ];
    const rejected = review({ status: 'Rejected', reviewed_at: 'T1' });
    expect(entriesToReview(day, rejected, '2026-10-12').map((e) => e.id)).toEqual(['now', 'new']);
    expect(entriesToReview(day, undefined, '2026-10-12').map((e) => e.id)).toEqual(['new']);
  });
});

describe('report aggregates', () => {
  const row = (over: Partial<ReportRow>): ReportRow => ({
    entry_id: 'x', user_id: 'u', employee: 'Alex', week_start: '2026-10-05', entry_date: '2026-10-05',
    project: 'A', task: 'Dev', hours: 1, status: 'Approved', ...over,
  });
  const rows = [row({ hours: 8 }), row({ hours: 4, project: 'B' }), row({ hours: 2, project: 'B', employee: 'Sam', status: 'Rejected' })];
  it('groups, sorts and scales', () => {
    expect(barsBy(rows, 'project')).toEqual([
      { name: 'A', hours: 8, pct: 100 },
      { name: 'B', hours: 6, pct: 75 },
    ]);
    expect(barsBy(rows, 'status').map((b) => b.name)).toEqual(['Approved', 'Rejected']);
    expect(barsBy([], 'employee')).toEqual([]);
  });
  it('totals hours', () => expect(reportTotal(rows)).toBe(14));
});
