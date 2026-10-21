import { round1 } from '../hours';
import type { ReviewStatus } from './timesheet';

export interface ReviewEntry {
  id: string;
  entry_date: string;
  project_id: string;
  task_id: string;
  hours: number;
  is_rejected: boolean;
  rejected_at: string | null;
}

export interface ReviewRow {
  entry_date: string;
  status: ReviewStatus;
  comment: string;
  reviewed_at: string;
}

/** Days a manager has to decide: days with counted entries, plus days that already have a decision. */
export function reviewableDays(entries: ReviewEntry[], reviews: ReviewRow[]): string[] {
  const days = new Set<string>();
  entries.filter((e) => !e.is_rejected).forEach((e) => days.add(e.entry_date));
  reviews.forEach((r) => days.add(r.entry_date));
  return [...days].sort();
}

/**
 * Entries shown to the manager for one day: the counted ones, plus those flagged
 * by this day's current rejection (older rejections from earlier rounds stay hidden).
 */
export function entriesToReview(entries: ReviewEntry[], review: ReviewRow | undefined, date: string): ReviewEntry[] {
  return entries.filter(
    (e) =>
      e.entry_date === date &&
      (!e.is_rejected || (review?.status === 'Rejected' && e.rejected_at !== null && e.rejected_at === review.reviewed_at)),
  );
}

export function reviewProgress(entries: ReviewEntry[], reviews: ReviewRow[]): { done: number; total: number } {
  const days = reviewableDays(entries, reviews);
  return { done: days.filter((d) => reviews.some((r) => r.entry_date === d)).length, total: days.length };
}

export interface ReportRow {
  entry_id: string;
  user_id: string;
  employee: string;
  week_start: string;
  entry_date: string;
  project: string;
  task: string;
  hours: number;
  status: string;
}

export interface Bar {
  name: string;
  hours: number;
  pct: number;
}

export function barsBy(rows: ReportRow[], key: 'project' | 'employee' | 'status'): Bar[] {
  const totals = new Map<string, number>();
  rows.forEach((r) => totals.set(r[key], (totals.get(r[key]) ?? 0) + r.hours));
  const sorted = [...totals.entries()]
    .map(([name, hours]) => ({ name, hours: round1(hours) }))
    .sort((a, b) => b.hours - a.hours || a.name.localeCompare(b.name));
  const max = sorted.length ? sorted[0].hours : 1;
  return sorted.map((b) => ({ ...b, pct: Math.max(2, Math.round((b.hours / max) * 100)) }));
}

export function reportTotal(rows: ReportRow[]): number {
  return round1(rows.reduce((sum, r) => sum + r.hours, 0));
}
