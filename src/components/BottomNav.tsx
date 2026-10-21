import { NavLink, useLocation } from 'react-router-dom';
import { useAuth } from '../auth/AuthProvider';
import { usePendingCount } from '../hooks/usePendingCount';
import { CalendarIcon, ChartIcon, CheckCircleIcon, ReportIcon } from './Icons';

export function BottomNav() {
  const { profile } = useAuth();
  const { pathname } = useLocation();
  const pending = usePendingCount();
  if (!profile) return null;

  const timesheetsActive = pathname === '/' || pathname.startsWith('/timesheets');
  const link = ({ isActive }: { isActive: boolean }) => 'nav-item' + (isActive ? ' active' : '');

  return (
    <nav className="bottom-nav" aria-label="Main">
      <NavLink to="/" className={() => link({ isActive: timesheetsActive })}
        aria-current={timesheetsActive ? 'page' : undefined}>
        <CalendarIcon /><span>My Timesheet</span>
      </NavLink>
      {profile.role === 'employee' && (
        <NavLink to="/summary" className={link}><ChartIcon /><span>Summary</span></NavLink>
      )}
      {profile.role === 'manager' && (
        <>
          <NavLink to="/approvals" className={link}>
            <CheckCircleIcon /><span>Approvals</span>
            {pending > 0 && <span className="nav-badge" aria-label={`${pending} waiting`}>{pending}</span>}
          </NavLink>
          <NavLink to="/reports" className={link}><ReportIcon /><span>Reports</span></NavLink>
        </>
      )}
    </nav>
  );
}
