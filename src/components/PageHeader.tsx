import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../auth/AuthProvider';
import { BackIcon } from './Icons';

interface Props {
  title: string;
  subtitle?: string;
  backTo?: string;
  right?: React.ReactNode;
}

const initialsOf = (name: string): string => name.trim().charAt(0).toUpperCase() || '?';

function ProfileMenu() {
  const { profile, signOut } = useAuth();
  const [open, setOpen] = useState(false);
  if (!profile) return null;
  return (
    <div className="profile-menu">
      <button type="button" className="avatar-btn" aria-label="Account menu" aria-expanded={open}
        onClick={() => setOpen((v) => !v)}>
        {initialsOf(profile.full_name)}
      </button>
      {open && (
        <div className="menu-pop" role="menu">
          <div className="menu-who">
            <strong>{profile.full_name}</strong>
            <span>{profile.email}</span>
            <span className="muted">{profile.role === 'manager' ? 'Manager' : 'Employee'}</span>
          </div>
          <button type="button" role="menuitem" className="btn btn-secondary" onClick={() => void signOut()}>
            Sign out
          </button>
        </div>
      )}
    </div>
  );
}

export function PageHeader({ title, subtitle, backTo, right }: Props) {
  const navigate = useNavigate();
  useEffect(() => {
    document.title = `${title} · TimeTrack`;
  }, [title]);
  return (
    <header className="page-header">
      {backTo && (
        <button type="button" className="icon-btn" aria-label="Back" onClick={() => navigate(backTo)}>
          <BackIcon />
        </button>
      )}
      <div className="page-title">
        <h1>{title}</h1>
        {subtitle && <div className="muted">{subtitle}</div>}
      </div>
      {right}
      <ProfileMenu />
    </header>
  );
}
