export const MAX_DAY_HOURS = 8.5;
export const MIN_ENTRY_HOURS = 0.5;

export const round1 = (n: number): number => Math.round(n * 10) / 10;

export interface HoursCheck {
  ok: boolean;
  error: string;
}

/** Mirrors the database rule: entry 0.5–8.5 h and the day total (excluding rejected entries) at most 8.5 h. */
export function checkHours(raw: string, alreadyLogged: number): HoursCheck {
  const text = raw.trim();
  if (!text) return { ok: false, error: 'Hours are required.' };
  const n = Number(text);
  if (Number.isNaN(n) || n < MIN_ENTRY_HOURS || n > MAX_DAY_HOURS) {
    return { ok: false, error: `Hours must be between ${MIN_ENTRY_HOURS} and ${MAX_DAY_HOURS}.` };
  }
  if (alreadyLogged + n > MAX_DAY_HOURS) {
    return {
      ok: false,
      error: `Total for this day cannot exceed ${MAX_DAY_HOURS} hours (${round1(alreadyLogged)} already logged).`,
    };
  }
  return { ok: true, error: '' };
}
