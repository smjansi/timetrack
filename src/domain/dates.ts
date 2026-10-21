// All dates are 'YYYY-MM-DD' strings (Postgres `date`), never timestamps, so time zones cannot shift them.

export const DAY_NAMES = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'] as const;
const MONTH_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const MONTH_LONG = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

const pad = (n: number): string => String(n).padStart(2, '0');

function toUtc(iso: string): Date {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d));
}
const toIso = (d: Date): string => d.toISOString().slice(0, 10);

export function addDays(iso: string, n: number): string {
  const d = toUtc(iso);
  d.setUTCDate(d.getUTCDate() + n);
  return toIso(d);
}

/** Today in the viewer's local calendar. */
export function todayIso(now: Date = new Date()): string {
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
}

export function mondayOf(iso: string): string {
  return addDays(iso, -((toUtc(iso).getUTCDay() + 6) % 7));
}

export function formatShort(iso: string): string {
  const d = toUtc(iso);
  return `${d.getUTCDate()} ${MONTH_SHORT[d.getUTCMonth()]}`;
}

export function dayLabel(weekStart: string, index: number): string {
  return `${DAY_NAMES[index]} ${formatShort(addDays(weekStart, index))}`;
}

/** "Wed 14 Oct" for a date inside the week starting `weekStart`. */
export function dayLabelFor(weekStart: string, date: string): string {
  const index = Math.round((toUtc(date).getTime() - toUtc(weekStart).getTime()) / 86400000);
  return dayLabel(weekStart, index);
}

/** "12 Oct – 18 Oct 2026" */
export function weekRange(weekStart: string): string {
  const end = addDays(weekStart, 6);
  return `${formatShort(weekStart)} – ${formatShort(end)} ${end.slice(0, 4)}`;
}

export function isoWeekNumber(iso: string): number {
  const d = toUtc(iso);
  d.setUTCDate(d.getUTCDate() - ((d.getUTCDay() + 6) % 7) + 3); // Thursday of this ISO week
  const firstThursday = new Date(Date.UTC(d.getUTCFullYear(), 0, 4));
  const offset = (firstThursday.getUTCDay() + 6) % 7;
  return 1 + Math.round(((d.getTime() - firstThursday.getTime()) / 86400000 - 3 + offset) / 7);
}

/** First day of the month `monthsBack` months before the month containing `iso`. */
export function monthStart(iso: string, monthsBack = 0): string {
  const d = toUtc(iso);
  return toIso(new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() - monthsBack, 1)));
}

/** "October 2026" */
export function monthTitle(iso: string): string {
  const d = toUtc(iso);
  return `${MONTH_LONG[d.getUTCMonth()]} ${d.getUTCFullYear()}`;
}

export function monthName(iso: string): string {
  return MONTH_LONG[toUtc(iso).getUTCMonth()];
}
