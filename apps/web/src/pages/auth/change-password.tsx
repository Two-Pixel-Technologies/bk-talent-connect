import { useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { LIMITS } from '@bktc/shared';
import { api, ApiError } from '../../lib/api-client.js';
import { useAuth, HOME_FOR_ROLE } from '../../features/auth/auth-context.js';
import { AuthShell } from './auth-shell.js';
import { Alert, Button, Field, Input } from '../../components/ui/index.js';

export function ChangePasswordPage() {
  const navigate = useNavigate();
  const { user, refresh } = useAuth();

  const [currentPassword, setCurrent] = useState('');
  const [newPassword, setNew] = useState('');
  const [error, setError] = useState<ApiError | null>(null);
  const [busy, setBusy] = useState(false);

  const forced = user?.mustChangePassword ?? false;

  async function submit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await api.post('/auth/change-password', { currentPassword, newPassword });
      await refresh();
      navigate(user ? HOME_FOR_ROLE[user.role] : '/', { replace: true });
    } catch (err) {
      setError(err instanceof ApiError ? err : null);
    } finally {
      setBusy(false);
    }
  }

  return (
    <AuthShell
      title={forced ? 'Set a new password' : 'Change your password'}
      subtitle={
        forced
          ? 'Your password was reset by the BK Talent Connect team. Choose your own before continuing.'
          : undefined
      }
    >
      <form onSubmit={submit} className="space-y-5" noValidate>
        {error && <Alert tone="error">{error.message}</Alert>}

        <Field
          label={forced ? 'Temporary password' : 'Current password'}
          htmlFor="currentPassword"
          required
          error={error?.fieldError('currentPassword')}
        >
          <Input
            id="currentPassword"
            type="password"
            autoComplete="current-password"
            required
            value={currentPassword}
            onChange={(e) => setCurrent(e.target.value)}
            invalid={Boolean(error?.fieldError('currentPassword'))}
          />
        </Field>

        <Field
          label="New password"
          htmlFor="newPassword"
          required
          hint={`At least ${LIMITS.password.min} characters.`}
          error={error?.fieldError('newPassword')}
        >
          <Input
            id="newPassword"
            type="password"
            autoComplete="new-password"
            required
            value={newPassword}
            onChange={(e) => setNew(e.target.value)}
            invalid={Boolean(error?.fieldError('newPassword'))}
          />
        </Field>

        <Alert tone="info">
          Changing your password signs you out everywhere else.
        </Alert>

        <Button type="submit" loading={busy} className="w-full">
          Update password
        </Button>
      </form>
    </AuthShell>
  );
}
