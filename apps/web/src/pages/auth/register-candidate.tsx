import { useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { LIMITS } from '@bktc/shared';
import { api, ApiError } from '../../lib/api-client.js';
import { useAuth } from '../../features/auth/auth-context.js';
import { AuthShell } from './auth-shell.js';
import { Alert, Button, Field, Input } from '../../components/ui/index.js';

export function RegisterCandidatePage() {
  const navigate = useNavigate();
  const { refresh } = useAuth();

  const [form, setForm] = useState({ fullName: '', email: '', mobile: '', password: '' });
  const [consent, setConsent] = useState(false);
  const [error, setError] = useState<ApiError | null>(null);
  const [busy, setBusy] = useState(false);

  const set = (key: keyof typeof form) => (e: { target: { value: string } }) =>
    setForm((f) => ({ ...f, [key]: e.target.value }));

  async function submit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await api.post('/auth/register/candidate', { ...form, consentToShare: consent });
      await refresh();
      navigate('/candidate', { replace: true });
    } catch (err) {
      setError(err instanceof ApiError ? err : null);
    } finally {
      setBusy(false);
    }
  }

  return (
    <AuthShell title="Create your candidate account" subtitle="Your profile is reviewed by our team before you can browse roles.">
      <form onSubmit={submit} className="space-y-5" noValidate>
        {error && <Alert tone="error">{error.message}</Alert>}

        <Field label="Full name" htmlFor="fullName" required error={error?.fieldError('fullName')}>
          <Input id="fullName" required autoComplete="name" value={form.fullName} onChange={set('fullName')} invalid={Boolean(error?.fieldError('fullName'))} />
        </Field>

        <Field label="Email" htmlFor="email" required error={error?.fieldError('email')}>
          <Input id="email" type="email" required autoComplete="email" value={form.email} onChange={set('email')} invalid={Boolean(error?.fieldError('email'))} />
        </Field>

        <Field label="Mobile number" htmlFor="mobile" required error={error?.fieldError('mobile')}>
          <Input id="mobile" type="tel" required autoComplete="tel" value={form.mobile} onChange={set('mobile')} invalid={Boolean(error?.fieldError('mobile'))} />
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

        {/*
          Explicit consent, stored with a version stamp. Admins can put a
          candidate forward to an employer they never applied to — under the
          DPDP Act that needs notice, and being surfaced to one's current
          employer is a serious incident in narrow industrial sectors.
        */}
        <label className="flex gap-3 rounded-lg border border-slate-200 bg-slate-50 p-4">
          <input
            type="checkbox"
            checked={consent}
            onChange={(e) => setConsent(e.target.checked)}
            className="mt-0.5 size-4 shrink-0 rounded border-slate-300"
            required
          />
          <span className="text-sm text-slate-700">
            I consent to BK Talent Connect sharing my profile and CV with relevant employers on my
            behalf, including roles I have not applied to directly.
            {error?.fieldError('consentToShare') && (
              <span className="mt-1 block text-accent-600">{error.fieldError('consentToShare')}</span>
            )}
          </span>
        </label>

        <Button type="submit" loading={busy} className="w-full">
          Create account
        </Button>
      </form>

      <p className="mt-6 text-center text-sm text-slate-600">
        Already registered?{' '}
        <Link to="/login" className="font-medium text-brand-600 hover:underline">
          Sign in
        </Link>
      </p>
    </AuthShell>
  );
}
