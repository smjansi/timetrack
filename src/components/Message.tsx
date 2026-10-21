import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';

interface Action {
  label: string;
  onClick?: () => void;
  href?: string;
  secondary?: boolean;
}

interface Props {
  title: string;
  children?: ReactNode;
  actions?: Action[];
  busy?: boolean;
  inline?: boolean;
}

/** Full-screen (or inline) status message: loading, errors, not authorised. */
export function Message({ title, children, actions = [], busy = false, inline = false }: Props) {
  return (
    <main className={inline ? 'screen message' : 'message message-full'} aria-busy={busy}>
      <h1>{title}</h1>
      {children && <p className="muted">{children}</p>}
      {actions.map((a) =>
        a.href ? (
          <Link key={a.label} to={a.href} className="btn btn-primary">{a.label}</Link>
        ) : (
          <button key={a.label} type="button" className={'btn ' + (a.secondary ? 'btn-secondary' : 'btn-primary')}
            onClick={a.onClick}>
            {a.label}
          </button>
        ),
      )}
    </main>
  );
}
