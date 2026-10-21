import { describe, expect, it } from 'vitest';
import { checkHours } from './hours';

describe('checkHours', () => {
  it('requires a value', () => expect(checkHours(' ', 0).ok).toBe(false));
  it('rejects below 0.5 and above 8.5', () => {
    expect(checkHours('0.4', 0).ok).toBe(false);
    expect(checkHours('8.6', 0).ok).toBe(false);
  });
  it('accepts the bounds', () => {
    expect(checkHours('0.5', 0).ok).toBe(true);
    expect(checkHours('8.5', 0).ok).toBe(true);
  });
  it('enforces the daily cap', () => {
    expect(checkHours('3', 6).ok).toBe(false);
    expect(checkHours('2.5', 6).ok).toBe(true);
  });
});
