import { useState, type FormEvent } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../auth/AuthProvider';
import { homePath } from '../auth/access';
import { ClockIcon } from '../components/Icons';
import { Message } from '../components/Message';
import { useOnline } from '../hooks/useOnline';

export function Login() {
  const { status, profile, signInWithPassword } = useAuth();
  const online = useOnline();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
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
    if (!value || !password) {
      setError('Enter your work email and password.');
      return;
    }
    setBusy(true);
    setError('');
    const failure = await signInWithPassword(value, password);
    setBusy(false);
    if (failure) setError(failure);
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

      <form className="stack" onSubmit={(e) => void submit(e)} noValidate>
        <label htmlFor="login-email" className="label-lg">Email</label>
        <input id="login-email" type="email" autoComplete="username" inputMode="email" className="input input-lg"
          value={email} onChange={(e) => setEmail(e.target.value)} aria-invalid={!!error}
          aria-describedby={error ? 'login-error' : undefined} />

        <label htmlFor="login-password" className="label-lg">Password</label>
        <input id="login-password" type={showPassword ? 'text' : 'password'} autoComplete="current-password"
          className="input input-lg" value={password} onChange={(e) => setPassword(e.target.value)}
          aria-invalid={!!error} aria-describedby={error ? 'login-error' : undefined} />
        <label className="check-row">
          <input type="checkbox" checked={showPassword} onChange={(e) => setShowPassword(e.target.checked)} />
          Show password
        </label>

        {error && <div id="login-error" role="alert" className="error-box">{error}</div>}
        {!online && <div role="status" className="muted">You are offline. Connect to sign in.</div>}
        <button type="submit" className="btn btn-primary btn-lg" disabled={busy || !online}>
          {busy ? 'Signing in…' : 'Sign in'}
        </button>
        <p className="muted">Accounts are created by your administrator. Forgot your password? Ask them to reset it.</p>
      </form>
    </main>
  );
}
