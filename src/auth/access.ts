import type { Role } from '../types';

const MANAGER_ONLY = ['/approvals', '/reports'];
const EMPLOYEE_ONLY = ['/summary'];

const under = (pathname: string, base: string): boolean =>
  pathname === base || pathname.startsWith(base + '/');

export function canAccess(role: Role, pathname: string): boolean {
  if (MANAGER_ONLY.some((p) => under(pathname, p))) return role === 'manager';
  if (EMPLOYEE_ONLY.some((p) => under(pathname, p))) return role === 'employee';
  return true;
}

/** Managers land on Approvals, employees on their timesheets. */
export function homePath(role: Role): string {
  return role === 'manager' ? '/approvals' : '/';
}
