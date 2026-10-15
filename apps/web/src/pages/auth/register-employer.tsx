import { useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { LIMITS } from '@bktc/shared';
import { api, ApiError } from '../../lib/api-client.js';
import { useAuth } from '../../features/auth/auth-context.js';
import { AuthShell } from './auth-shell.js';
import { Alert, Button, Field, Input } from '../../components/ui/index.js';

export function RegisterEmployerPage() {
  const navigate = useNavigate();
  const { refresh } = useAuth();

  const [form, setForm] = useState({
    companyName: '',
    hrContactName: '',
    email: '',
    hrContactPhone: '',
    password: '',
  });
  const [error, setError] = useState<ApiError | null>(null);
  const [busy, setBusy] = useState(false);

  const set = (key: keyof typeof form) => (e: { target: { value: string } }) =>
    setForm((f) => ({ ...f, [key]: e.target.value }));

  async function submit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await api.post('/auth/register/employer', form);
      await refresh();
      navigate('/employer', { replace: true });
    } catch (err) {
      setError(err instanceof ApiError ? err : null);
    } finally {
      setBusy(false);
    }
  }

  return (
    <AuthShell
      title="Register your company"
      subtitle="Our team verifies every company before any job posting goes live."
    >
      <form onSubmit={submit} className="space-y-5" noValidate>
        {error && <Alert tone="error">{error.message}</Alert>}

        <Field label="Company name" htmlFor="companyName" required error={error?.fieldError('companyName')}>
          <Input id="companyName" required value={form.companyName} onChange={set('companyName')} invalid={Boolean(error?.fieldError('companyName'))} />
        </Field>

        <Field label="Your name" htmlFor="hrContactName" required error={error?.fieldError('hrContactName')}>
          <Input id="hrContactName" required autoComplete="name" value={form.hrContactName} onChange={set('hrContactName')} invalid={Boolean(error?.fieldError('hrContactName'))} />
        </Field>

        <Field label="Work email" htmlFor="email" required error={error?.fieldError('email')}>
          <Input id="email" type="email" required autoComplete="email" value={form.email} onChange={set('email')} invalid={Boolean(error?.fieldError('email'))} />
        </Field>

        <Field label="Phone" htmlFor="hrContactPhone" required error={error?.fieldError('hrContactPhone')}>
          <Input id="hrContactPhone" type="tel" required autoComplete="tel" value={form.hrContactPhone} onChange={set('hrContactPhone')} invalid={Boolean(error?.fieldError('hrContactPhone'))} />
        </Field>

        <Field
          label="Password"
          htmlFor="password"
          required
          hint={`At least ${LIMITS.password.min} characters.`}
          error={error?.fieldError('password')}
        >
          <Input id="password" type="password" required autoComplete="new-password" value={form.password} onChange={set('password')} invalid={Boolean(error?.fieldError('password'))} />
        </Field>

        <Button type="submit" loading={busy} className="w-full">
          Register company
        </Button>
      </form>

      <p className="mt-4 text-center text-xs text-slate-500">
        By registering, you agree to our{' '}
        <Link to="/terms-of-use" className="font-medium text-brand-600 hover:underline">
          Terms of Use
        </Link>{' '}
        and{' '}
        <Link to="/privacy-policy" className="font-medium text-brand-600 hover:underline">
          Privacy Policy
        </Link>
        .
      </p>

      <p className="mt-4 text-center text-sm text-slate-600">
        Already registered?{' '}
        <Link to="/login" className="font-medium text-brand-600 hover:underline">
          Sign in
        </Link>
      </p>
    </AuthShell>
  );
}
