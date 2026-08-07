/**
 * "Your data" — the DPDP page.
 *
 * Available to candidates and employers alike. Two things it has to do: say
 * plainly what we hold and who sees it, and give a working route to erasure.
 * A privacy policy that describes rights the product does not implement is
 * worse than none, because it is a promise on the record.
 */

import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { formatDateTime } from '@bktc/shared';
import { api, ApiError } from '../../lib/api-client.js';
import { useAuth } from '../../features/auth/auth-context.js';
import { Alert, Badge, Button, Card, Field, Textarea } from '../../components/ui/index.js';
import { QueryState } from '../../components/query-state.js';

type ErasureRequest = {
  id: string;
  status: 'OPEN' | 'COMPLETED' | 'REJECTED';
  reason: string | null;
  decisionNote: string | null;
  requestedAt: string;
  handledAt: string | null;
};

export function PrivacyPage() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [reason, setReason] = useState('');
  const [confirming, setConfirming] = useState(false);

  const requests = useQuery({
    queryKey: ['privacy', 'erasure-requests'],
    queryFn: () => api.get<{ items: ErasureRequest[] }>('/privacy/erasure-requests'),
  });

  const ask = useMutation({
    mutationFn: () =>
      api.post<ErasureRequest>('/privacy/erasure-requests', reason.trim() ? { reason: reason.trim() } : {}),
    onSuccess: () => {
      setConfirming(false);
      setReason('');
      void queryClient.invalidateQueries({ queryKey: ['privacy'] });
    },
  });

  const error = ask.error instanceof ApiError ? ask.error : null;
  const open = requests.data?.items.find((r) => r.status === 'OPEN');
  const isCandidate = user?.role === 'CANDIDATE';

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-brand-900">Your data</h1>
        <p className="mt-1 text-sm text-slate-600">
          What we hold, who sees it, and how to have it removed.
        </p>
      </div>

      <Card>
        <h2 className="font-semibold text-brand-900">Who sees what</h2>
        {isCandidate ? (
          <ul className="mt-3 space-y-2 text-sm text-slate-700">
            <li>
              <span className="font-medium">Employers never see</span> your email address, your
              mobile number, or anything about your salary — current or expected. All contact goes
              through our team.
            </li>
            <li>
              <span className="font-medium">Employers do see</span> your profile and your CV, once
              our team has approved your profile and you have applied to their role or we have put
              you forward for it.
            </li>
            <li>
              <span className="font-medium">Our team sees</span> everything on your profile,
              including your salary details, so we can match you sensibly.
            </li>
            <li>
              Roles are shown to you anonymously. The company is revealed once you are shortlisted.
            </li>
          </ul>
        ) : (
          <ul className="mt-3 space-y-2 text-sm text-slate-700">
            <li>
              <span className="font-medium">Candidates never see</span> the salary band on your
              postings, and your postings are shown to them without your company name until they are
              shortlisted.
            </li>
            <li>
              <span className="font-medium">You see</span> the profile and CV of anyone who applies
              to your roles or whom we put forward — never their contact details.
            </li>
            <li>Our team sees your company profile, your postings and your pipeline activity.</li>
          </ul>
        )}
      </Card>

      <Card>
        <h2 className="font-semibold text-brand-900">Ask us to erase your account</h2>
        <p className="mt-2 text-sm text-slate-600">
          You can ask us to delete everything personal we hold about you: your profile, your CV, and
          your contact details. We review the request first — if you are mid-process with an
          employer we will tell you rather than pulling you out of it without warning.
        </p>
        <p className="mt-2 text-sm text-slate-600">
          Records of the hiring processes you took part in are kept without you attached to them,
          which is what lets us and our clients account for decisions that were made.
        </p>

        <QueryState
          isPending={requests.isPending}
          error={requests.error}
          onRetry={() => void requests.refetch()}
        >
          {error && (
            <div className="mt-4">
              <Alert tone="error">{error.message}</Alert>
            </div>
          )}

          {open ? (
            <div className="mt-4">
              <Alert tone="info" title="We have your request">
                Asked on {formatDateTime(open.requestedAt)}. Our team will action it and confirm.
              </Alert>
            </div>
          ) : confirming ? (
            <div className="mt-4 rounded-lg border border-accent-200 bg-accent-50 p-4">
              <p className="text-sm font-medium text-accent-900">
                This cannot be undone once we action it.
              </p>
              <div className="mt-3">
                <Field label="Anything you want to tell us?" htmlFor="reason" hint="Optional.">
                  <Textarea
                    id="reason"
                    rows={3}
                    value={reason}
                    onChange={(e) => setReason(e.target.value)}
                  />
                </Field>
              </div>
              <div className="mt-3 flex flex-col gap-2 sm:flex-row">
                <Button variant="danger" loading={ask.isPending} onClick={() => ask.mutate()}>
                  Send the request
                </Button>
                <Button variant="secondary" onClick={() => setConfirming(false)}>
                  Cancel
                </Button>
              </div>
            </div>
          ) : (
            <Button variant="secondary" className="mt-4" onClick={() => setConfirming(true)}>
              Request erasure
            </Button>
          )}

          {requests.data && requests.data.items.length > 0 && (
            <ul className="mt-5 space-y-2 border-t border-slate-100 pt-4">
              {requests.data.items.map((r) => (
                <li key={r.id} className="flex flex-wrap items-start justify-between gap-2 text-sm">
                  <div className="min-w-0">
                    <p className="text-slate-700">Asked {formatDateTime(r.requestedAt)}</p>
                    {r.decisionNote && (
                      <p className="mt-0.5 text-slate-600">{r.decisionNote}</p>
                    )}
                  </div>
                  <Badge
                    tone={r.status === 'COMPLETED' ? 'green' : r.status === 'REJECTED' ? 'red' : 'amber'}
                  >
                    {r.status === 'COMPLETED' ? 'Done' : r.status === 'REJECTED' ? 'Not actioned' : 'Open'}
                  </Badge>
                </li>
              ))}
            </ul>
          )}
        </QueryState>
      </Card>
    </div>
  );
}
