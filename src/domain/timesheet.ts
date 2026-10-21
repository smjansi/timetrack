import { MAX_DAY_HOURS, round1 } from '../hours';

export type TsStatus = 'Draft' | 'Submitted' | 'Approved' | 'Rejected';
export type ReviewStatus = 'Approved' | 'Rejected';
export type DayReviewLabel = ReviewStatus | 'Pending';

export interface Entry {
  id: string;
  entry_date: string;
  project_id: string;
  task_id: string;
  hours: number;
  notes: string;
  is_rejected: boolean;
  created_at: string;
}

export interface DayReview {
  entry_date: string;
  status: ReviewStatus;
  comment: string;
}

/** Hours that count: rejected entries are excluded from totals and the daily cap. */
export function countedHours(entries: Pick<Entry, 'hours' | 'is_rejected'>[]): number {
  return round1(entries.filter((e) => !e.is_rejected).reduce((sum, e) => sum + e.hours, 0));
}

export function loggedOnDay(entries: Entry[], date: string, excludeId?: string): number {
  return countedHours(entries.filter((e) => e.entry_date === date && e.id !== excludeId));
}

export function remainingOnDay(logged: number): number {
  return Math.max(0, round1(MAX_DAY_HOURS - logged));
}

/** The owner may change a timesheet unless it is Approved. */
export function isEditable(status: TsStatus): boolean {
  return status === 'Draft' || status === 'Rejected' || status === 'Submitted';
}

export function isDayOpen(reviews: DayReview[], date: string): boolean {
  return !reviews.some((r) => r.entry_date === date && r.status === 'Approved');
}

/** Review badge for a day; null while the timesheet is still a draft. */
export function dayReviewLabel(status: TsStatus, reviews: DayReview[], date: string): DayReviewLabel | null {
  if (status === 'Draft') return null;
  const review = reviews.find((r) => r.entry_date === date);
  if (review) return review.status;
  if (status === 'Approved') return 'Approved';
  if (status === 'Submitted') return 'Pending';
  return null;
}

export interface SubmitState {
  label: string;
  disabled: boolean;
  note: string;
}

export function submitState(status: TsStatus): SubmitState {
  const label = status === 'Rejected' ? 'Resubmit' : status === 'Submitted' ? 'Submitted' : 'Submit';
  const disabled = status === 'Submitted' || status === 'Approved';
  const note =
    status === 'Submitted'
      ? 'Days not yet approved can still be edited. Approved days are locked.'
      : status === 'Approved'
        ? 'Approved timesheets are read-only.'
        : `Hours per day cannot exceed ${MAX_DAY_HOURS}. Submit when your week is complete.`;
  return { label, disabled, note };
}

export interface ProjectHours {
  name: string;
  hours: number;
}

export interface MonthSummary {
  total: number;
  projectCount: number;
  top: ProjectHours | null;
  bars: (ProjectHours & { pct: number })[];
}

export function summarise(rows: ProjectHours[]): MonthSummary {
  const sorted = rows
    .map((r) => ({ name: r.name, hours: round1(r.hours) }))
    .sort((a, b) => b.hours - a.hours || a.name.localeCompare(b.name));
  const max = sorted.length ? sorted[0].hours : 1;
  return {
    total: round1(sorted.reduce((sum, r) => sum + r.hours, 0)),
    projectCount: sorted.length,
    top: sorted[0] ?? null,
    bars: sorted.map((r) => ({ ...r, pct: Math.max(2, Math.round((r.hours / max) * 100)) })),
  };
}
