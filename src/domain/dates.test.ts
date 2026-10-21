import { describe, expect, it } from 'vitest';
import {
  addDays, dayLabel, isoWeekNumber, mondayOf, monthStart, monthTitle, todayIso, weekRange,
} from './dates';

describe('dates', () => {
  it('adds days across month and year ends', () => {
    expect(addDays('2026-10-30', 3)).toBe('2026-11-02');
    expect(addDays('2026-12-30', 3)).toBe('2027-01-02');
    expect(addDays('2026-03-01', -1)).toBe('2026-02-28');
  });
  it('finds the Monday of a week', () => {
    expect(mondayOf('2026-10-18')).toBe('2026-10-12');
    expect(mondayOf('2026-10-12')).toBe('2026-10-12');
    expect(mondayOf('2026-10-22')).toBe('2026-10-19');
  });
  it('formats labels', () => {
    expect(dayLabel('2026-10-12', 2)).toBe('Wed 14 Oct');
    expect(weekRange('2026-10-12')).toBe('12 Oct – 18 Oct 2026');
    expect(weekRange('2026-12-28')).toBe('28 Dec – 3 Jan 2027');
  });
  it('numbers ISO weeks', () => {
    expect(isoWeekNumber('2026-10-12')).toBe(42);
    expect(isoWeekNumber('2025-12-29')).toBe(1);
    expect(isoWeekNumber('2026-01-05')).toBe(2);
  });
  it('handles months', () => {
    expect(monthStart('2026-10-22')).toBe('2026-10-01');
    expect(monthStart('2026-01-15', 1)).toBe('2025-12-01');
    expect(monthTitle('2026-09-01')).toBe('September 2026');
  });
  it('uses the local calendar date', () => {
    expect(todayIso(new Date(2026, 9, 5, 23, 59))).toBe('2026-10-05');
  });
});
