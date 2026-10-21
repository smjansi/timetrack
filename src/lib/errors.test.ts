import { describe, expect, it } from 'vitest';
import { apiMessage } from './errors';

describe('apiMessage', () => {
  it('explains network failures', () => {
    expect(apiMessage('TypeError: Failed to fetch')).toMatch(/Check your connection/);
    expect(apiMessage('Load failed')).toMatch(/Check your connection/);
  });
  it('keeps database messages untouched', () => {
    const m = 'Total for this day cannot exceed 8.5 hours (6 already logged).';
    expect(apiMessage(m)).toBe(m);
  });
});
