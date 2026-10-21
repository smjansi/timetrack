import { useState, type FormEvent } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../auth/AuthProvider';
import { homePath } from '../auth/access';
import { ClockIcon } from '../components/Icons';
import { Message } from '../components/Message';
import { useOnline } from '../hooks/useOnline';

export function Login() {
  const { status, profile, signInWithEmail } = useAuth();
  const online = useOnline();
  const [email, setEmail] = useState('');
  const [sentTo, setSentTo] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  if (status === 'unconfigured') {
    return (
      <Message title="App not configured">
        Set <code>VITE_SUPABASE_URL</code> and <code>VITE_SUPABASE_ANON_KEY</code> in <code>.env.local</code>, then restart.
      </Message>
    );
  }
  if (status === 'ready' && profile) return <Navigate to={homePath(profile.role)} replace />;
  if (status === 'loading') return <Message title="Loading…" busy />;

  async function submit(e: FormEvent) {
    e.preventDefault();
    const value = email.trim();
    if (!value) {
      setError('Enter your work email.');
      return;
    }
    setBusy(true);
    setError('');
    const failure = await signInWithEmail(value);
    setBusy(false);
    if (failure) setError(failure);
    else setSentTo(value);
  }

  return (
    <main className="login">
      <div className="login-brand">
        <div className="logo"><ClockIcon size={28} /></div>
        <div>
          <h1>TimeTrack</h1>
          <div className="muted">Sign in with your work email</div>
        </div>
      </div>

      {sentTo ? (
        <div className="stack" role="status">
          <p><strong>Check your email.</strong> We sent a sign-in link to <strong>{sentTo}</strong>. Open it on this device.</p>
          <button type="button" className="btn btn-secondary" onClick={() => setSentTo('')}>Use a different email</button>
        </div>
      ) : (
        <form className="stack" onSubmit={(e) => void submit(e)} noValidate>
          <label htmlFor="login-email" className="label-lg">Email</label>
          <input id="login-email" type="email" autoComplete="email" inputMode="email" className="input input-lg"
            value={email} onChange={(e) => setEmail(e.target.value)} aria-invalid={!!error}
            aria-describedby={error ? 'login-error' : undefined} />
          {error && <div id="login-error" role="alert" className="error-box">{error}</div>}
          {!online && <div role="status" className="muted">You are offline. Connect to sign in.</div>}
          <button type="submit" className="btn btn-primary btn-lg" disabled={busy || !online}>
            {busy ? 'Sending…' : 'Email me a sign-in link'}
          </button>
        </form>
      )}
    </main>
  );
}
