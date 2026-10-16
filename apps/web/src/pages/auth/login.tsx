import { useState, type FormEvent } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { api, ApiError } from '../../lib/api-client.js';
import { useAuth, HOME_FOR_ROLE, type CurrentUser } from '../../features/auth/auth-context.js';
import { AuthShell } from './auth-shell.js';
import { Alert, Button, Field, Input } from '../../components/ui/index.js';

export function LoginPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { refresh } = useAuth();
  const queryClient = useQueryClient();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<ApiError | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const user = await api.post<CurrentUser>('/auth/login', { email, password });
      // refresh() first and unchanged, exactly as it ran before this
      // defense-in-depth was added: it invalidates and refetches
      // ['auth', 'me'] itself, so it needs that query to still be in the
      // cache when it runs.
      await refresh();
      // Defense-in-depth: signOut() already clears the rest of the cache,
      // but this page is reachable without it too (an expired session, a
      // direct /login visit). Clearing again here — everything except the
      // 'auth' entry refresh() just populated — means a second account
      // logging in on this tab can never inherit whatever the first left
      // behind.
      queryClient.removeQueries({ predicate: (query) => query.queryKey[0] !== 'auth' });
      const from = (location.state as { from?: string } | null)?.from;
      navigate(from ?? HOME_FOR_ROLE[user.role], { replace: true });
    } catch (err) {
      setError(err instanceof ApiError ? err : null);
    } finally {
      setBusy(false);
    }
  }

  return (
    <AuthShell title="Sign in" subtitle="Candidates and employers use the same sign-in.">
      <form onSubmit={submit} className="space-y-5" noValidate>
        {error && <Alert tone="error">{error.message}</Alert>}

        <Field label="Email" htmlFor="email" required error={error?.fieldError('email')}>
          <Input
            id="email"
            type="email"
            autoComplete="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            invalid={Boolean(error?.fieldError('email'))}
          />
        </Field>

        <Field label="Password" htmlFor="password" required error={error?.fieldError('password')}>
          <Input
            id="password"
            type="password"
            autoComplete="current-password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            invalid={Boolean(error?.fieldError('password'))}
          />
        </Field>

        <Button type="submit" loading={busy} className="w-full">
          Sign in
        </Button>
      </form>

      {/*
        No "forgot password" link: email is Phase 2, so resets are admin-initiated.
        Saying so plainly beats a link that goes nowhere.
      */}
      <p className="mt-6 text-center text-sm text-slate-500">
        Forgotten your password? Contact BK Talent Connect and the team will reset it for you.
      </p>

      <div className="mt-6 border-t border-slate-200 pt-6 text-center text-sm">
        <p className="text-slate-600">
          New here?{' '}
          <Link to="/register/candidate" className="font-medium text-brand-600 hover:underline">
            Register as a candidate
          </Link>{' '}
          or{' '}
          <Link to="/register/employer" className="font-medium text-brand-600 hover:underline">
            as an employer
          </Link>
          .
        </p>
      </div>
    </AuthShell>
  );
}
