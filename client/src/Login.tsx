import { useState } from 'react';
import type { FormEvent } from 'react';
import { ApiError, enter } from './api.ts';
import type { User } from './api.ts';

export function Login({ onLogin }: { onLogin: (user: User) => void }) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      onLogin(await enter(username, password));
    } catch (err) {
      if (!(err instanceof ApiError)) setError('Could not reach the server. Is it running?');
      else if (err.status === 401) setError("That username already exists and the password doesn't match.");
      else setError(err.message);
      setBusy(false);
    }
  }

  return (
    <main className="login">
      <form className="panel" onSubmit={submit}>
        <h1>Pokédex</h1>
        <p className="notice">
          New here? Just pick a username and password. If the user doesn't exist yet, we'll create the account
          automatically.
        </p>
        <label>
          Username
          <input value={username} onChange={(e) => setUsername(e.target.value)} autoComplete="username" required autoFocus />
        </label>
        <label>
          Password
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="current-password"
            required
          />
        </label>
        {error && (
          <p className="error" role="alert">
            {error}
          </p>
        )}
        <button className="primary" disabled={busy}>
          {busy ? 'Entering…' : 'Enter'}
        </button>
        <p className="fineprint">Demo app: passwords are stored in plain text, so don't use a real one.</p>
      </form>
    </main>
  );
}
