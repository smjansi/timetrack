import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '../auth/AuthProvider';
import { canAccess, homePath } from '../auth/access';
import { useOnline } from '../hooks/useOnline';
import { BottomNav } from './BottomNav';
import { Message } from './Message';

/** Guards every signed-in screen and frames it with the bottom navigation. */
export function Shell() {
  const { status, profile, retry, signOut } = useAuth();
  const { pathname } = useLocation();
  const online = useOnline();

  if (status === 'unconfigured') {
    return (
      <Message title="App not configured">
        Set <code>VITE_SUPABASE_URL</code> and <code>VITE_SUPABASE_ANON_KEY</code> in <code>.env.local</code>
        (see <code>.env.example</code>), then restart.
      </Message>
    );
  }
  if (status === 'loading') return <Message title="Loading…" busy />;
  if (status === 'signedOut') return <Navigate to="/login" replace />;
  if (status === 'error') {
    return (
      <Message title="Could not load your account"
        actions={[{ label: 'Try again', onClick: retry }, { label: 'Sign out', onClick: () => void signOut(), secondary: true }]}>
        Check your connection and try again.
      </Message>
    );
  }
  if (status === 'noProfile' || !profile) {
    return (
      <Message title="Not authorised"
        actions={[{ label: 'Sign out', onClick: () => void signOut() }]}>
        Your account has no TimeTrack profile yet. Ask your administrator for access.
      </Message>
    );
  }
  if (!canAccess(profile.role, pathname)) {
    return (
      <div className="app">
        <Message title="Not authorised" inline
          actions={[{ label: 'Go to my start page', href: homePath(profile.role) }]}>
          Your role does not have access to this screen.
        </Message>
        <BottomNav />
      </div>
    );
  }

  return (
    <div className="app">
      {!online && (
        <div className="offline-banner" role="status">
          You are offline. You can browse the app, but saving changes needs a connection.
        </div>
      )}
      <main className="screen"><Outlet /></main>
      <BottomNav />
    </div>
  );
}
