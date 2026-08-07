/**
 * Suspending and reactivating an account.
 *
 * The endpoints existed, were tested, and had no UI anywhere — `grep suspend
 * apps/web/src` returned nothing. So did the cascade that takes an employer's
 * live postings down with them, and the guard that stops the last active admin
 * being suspended: careful behaviour behind an action nobody could perform.
 *
 * It sits on the review screens rather than a separate "users" page, because
 * the moment you want to suspend someone is the moment you are reading their
 * record.
 */

import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../lib/api-client.js';
import { Alert, Badge, Button } from './ui/index.js';
import { MutationFeedback } from './mutation-feedback.js';

export function AccountControls({
  userId,
  userStatus,
  name,
  kind,
}: {
  userId: string;
  userStatus: string;
  name: string;
  kind: 'candidate' | 'company';
}) {
  const queryClient = useQueryClient();
  const [confirming, setConfirming] = useState(false);
  const [issued, setIssued] = useState<string | null>(null);

  const invalidate = () => {
    void queryClient.invalidateQueries({ queryKey: ['admin'] });
  };

  const resetPassword = useMutation({
    mutationFn: () =>
      api.post<{ temporaryPassword: string }>(`/admin/users/${userId}/reset-password`),
    onSuccess: (result) => setIssued(result.temporaryPassword),
  });

  const suspend = useMutation({
    mutationFn: () => api.post<void>(`/admin/users/${userId}/suspend`),
    onSuccess: () => {
      setConfirming(false);
      invalidate();
    },
  });

  const reactivate = useMutation({
    mutationFn: () => api.post<{ restoredApplications: number }>(`/admin/users/${userId}/reactivate`),
    onSuccess: invalidate,
  });

  const suspended = userStatus === 'SUSPENDED';

  return (
    <div className="border-t border-slate-100 pt-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-xs font-semibold tracking-wide text-slate-500 uppercase">Account</p>
          <p className="mt-1 text-sm text-slate-600">
            {suspended
              ? 'Signed out and blocked from signing in.'
              : 'Active — they can sign in and use the portal.'}
          </p>
        </div>
        <Badge tone={suspended ? 'red' : 'green'}>{suspended ? 'Suspended' : 'Active'}</Badge>
      </div>

      {/*
        * Password reset.
        *
        * There is no self-serve reset in Phase 1 and there was no admin one
        * either — every forgotten password meant an SSH session. The password
        * is generated server-side, shown once, and must be changed at next
        * sign-in.
        */}
      <div className="mt-3 border-t border-slate-100 pt-3">
        {issued ? (
          <Alert tone="success" title="Temporary password issued">
            <p>Read this to them. It will not be shown again, and they must change it when they sign in.</p>
            <p className="mt-2 font-mono text-base tracking-wide text-slate-900">{issued}</p>
          </Alert>
        ) : (
          <Button
            variant="ghost"
            className="px-3 text-xs"
            loading={resetPassword.isPending}
            onClick={() => {
              if (
                window.confirm(
                  `Issue ${name} a new temporary password? Their current password stops working and they are signed out everywhere.`,
                )
              ) {
                resetPassword.mutate();
              }
            }}
          >
            Reset password
          </Button>
        )}
        <MutationFeedback error={resetPassword.error} />
      </div>

      {suspended ? (
        <div className="mt-3">
          <Button
            variant="secondary"
            className="px-3 text-xs"
            loading={reactivate.isPending}
            onClick={() => reactivate.mutate()}
          >
            Reactivate
          </Button>
          <MutationFeedback
            error={reactivate.error}
            isSuccess={reactivate.isSuccess}
            successMessage={
              kind === 'company'
                ? `Reactivated. ${reactivate.data?.restoredApplications ?? 0} application(s) closed by the suspension have been restored.`
                : 'Reactivated. They can sign in again.'
            }
          />
        </div>
      ) : confirming ? (
        <div className="mt-3">
          <Alert tone="warning" title={`Suspend ${name}?`}>
            <p>
              They are signed out immediately and cannot sign back in.
              {kind === 'company'
                ? ' Their live postings come down and pending applicants are closed — reactivating puts both back.'
                : ' Their applications stay where they are.'}
            </p>
            <div className="mt-3 flex flex-col gap-2 sm:flex-row">
              <Button variant="danger" loading={suspend.isPending} onClick={() => suspend.mutate()}>
                Suspend
              </Button>
              <Button variant="secondary" onClick={() => setConfirming(false)}>
                Cancel
              </Button>
            </div>
            <MutationFeedback error={suspend.error} />
          </Alert>
        </div>
      ) : (
        <Button
          variant="ghost"
          className="mt-3 px-3 text-xs text-accent-600"
          onClick={() => setConfirming(true)}
        >
          Suspend account
        </Button>
      )}
    </div>
  );
}
