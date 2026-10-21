import { describe, expect, it } from 'vitest';
import {
  countedHours, dayReviewLabel, isDayOpen, isEditable, loggedOnDay, remainingOnDay, submitState, summarise,
  type DayReview, type Entry,
} from './timesheet';

const entry = (over: Partial<Entry>): Entry => ({
  id: 'e', entry_date: '2026-10-12', project_id: 'p', task_id: 't', hours: 1, notes: '',
  is_rejected: false, created_at: '', ...over,
});

describe('hours', () => {
  const entries = [
    entry({ id: '1', hours: 6 }),
    entry({ id: '2', hours: 2.5 }),
    entry({ id: '3', hours: 8, is_rejected: true }),
    entry({ id: '4', hours: 3, entry_date: '2026-10-13' }),
  ];
  it('excludes rejected entries from totals', () => expect(countedHours(entries)).toBe(11.5));
  it('sums one day, optionally leaving out the entry being edited', () => {
    expect(loggedOnDay(entries, '2026-10-12')).toBe(8.5);
    expect(loggedOnDay(entries, '2026-10-12', '2')).toBe(6);
  });
  it('never reports negative remaining hours', () => {
    expect(remainingOnDay(6)).toBe(2.5);
    expect(remainingOnDay(9)).toBe(0);
  });
});

describe('status transitions', () => {
  it('lets the owner edit everything except Approved', () => {
    expect(isEditable('Draft')).toBe(true);
    expect(isEditable('Submitted')).toBe(true);
    expect(isEditable('Rejected')).toBe(true);
    expect(isEditable('Approved')).toBe(false);
  });
  it('locks approved days only', () => {
    const reviews: DayReview[] = [
      { entry_date: '2026-10-12', status: 'Approved', comment: '' },
      { entry_date: '2026-10-13', status: 'Rejected', comment: 'x' },
    ];
    expect(isDayOpen(reviews, '2026-10-12')).toBe(false);
    expect(isDayOpen(reviews, '2026-10-13')).toBe(true);
    expect(isDayOpen(reviews, '2026-10-14')).toBe(true);
  });
  it('labels day reviews', () => {
    const reviews: DayReview[] = [{ entry_date: '2026-10-13', status: 'Rejected', comment: 'x' }];
    expect(dayReviewLabel('Draft', reviews, '2026-10-13')).toBeNull();
    expect(dayReviewLabel('Submitted', reviews, '2026-10-12')).toBe('Pending');
    expect(dayReviewLabel('Submitted', reviews, '2026-10-13')).toBe('Rejected');
    expect(dayReviewLabel('Approved', [], '2026-10-12')).toBe('Approved');
    expect(dayReviewLabel('Rejected', [], '2026-10-12')).toBeNull();
  });
  it('drives the submit button', () => {
    expect(submitState('Draft')).toMatchObject({ label: 'Submit', disabled: false });
    expect(submitState('Rejected')).toMatchObject({ label: 'Resubmit', disabled: false });
    expect(submitState('Submitted')).toMatchObject({ label: 'Submitted', disabled: true });
    expect(submitState('Approved').disabled).toBe(true);
  });
});

describe('summarise', () => {
  it('totals, ranks and scales the bars', () => {
    const s = summarise([
      { name: 'B', hours: 10 },
      { name: 'A', hours: 20.04 },
    ]);
    expect(s.total).toBe(30);
    expect(s.projectCount).toBe(2);
    expect(s.top).toEqual({ name: 'A', hours: 20 });
    expect(s.bars.map((b) => b.pct)).toEqual([100, 50]);
  });
  it('copes with no data', () => {
    expect(summarise([])).toMatchObject({ total: 0, projectCount: 0, top: null, bars: [] });
  });
});
