import { describe, expect, it } from 'vitest';
import { canAccess, homePath } from './access';

describe('canAccess', () => {
  it('keeps manager screens away from employees', () => {
    expect(canAccess('employee', '/approvals')).toBe(false);
    expect(canAccess('employee', '/approvals/abc')).toBe(false);
    expect(canAccess('employee', '/reports')).toBe(false);
    expect(canAccess('manager', '/approvals')).toBe(true);
    expect(canAccess('manager', '/reports')).toBe(true);
  });
  it('keeps the summary for employees', () => {
    expect(canAccess('manager', '/summary')).toBe(false);
    expect(canAccess('employee', '/summary')).toBe(true);
  });
  it('lets both roles use their own timesheets', () => {
    expect(canAccess('employee', '/')).toBe(true);
    expect(canAccess('manager', '/timesheets/abc')).toBe(true);
  });
  it('does not match look-alike prefixes', () => {
    expect(canAccess('employee', '/approvals-help')).toBe(true);
  });
});

describe('homePath', () => {
  it('sends managers to approvals and employees to the timesheet list', () => {
    expect(homePath('manager')).toBe('/approvals');
    expect(homePath('employee')).toBe('/');
  });
});
