/**
 * The approve / request-changes / reject control.
 *
 * Shared by all three queues so the review experience is identical whatever is
 * being reviewed. Two decisions embedded here:
 *
 *   - The reason box is REQUIRED for anything other than approval, and it says
 *     the person will read it. The API enforces this too; this is just where it
 *     is made obvious.
 *   - expectedStatus carries the status shown on screen. If someone else has
 *     already decided, the server answers 409 and we tell the reviewer to
 *     refresh rather than silently overwriting a colleague.
 */

import { useState } from 'react';
import { ApiError } from '../lib/api-client.js';
import type { ReviewDecision } from '../features/admin/use-admin.js';
import { Alert, Button, Field, Textarea } from './ui/index.js';

export function ReviewPanel({
  currentStatus,
  onReview,
  isPending,
  error,
  noun,
}: {
  currentStatus: string;
  onReview: (decision: ReviewDecision, note: string) => void;
  isPending: boolean;
  error: unknown;
  noun: string;
}) {
  const [decision, setDecision] = useState<ReviewDecision | null>(null);
  const [note, setNote] = useState('');

  const apiError = error instanceof ApiError ? error : null;
  const stale = apiError?.status === 409;
  const needsNote = decision === 'REQUEST_CHANGES' || decision === 'REJECT';

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 sm:p-6">
      <h2 className="font-semibold text-brand-900">Your decision</h2>

      {stale ? (
        <div className="mt-4">
          <Alert tone="warning" title="Someone else got there first">
            {apiError.message}
            <div className="mt-3">
              <Button variant="secondary" onClick={() => window.location.reload()}>
                Refresh
              </Button>
            </div>
          </Alert>
        </div>
      ) : (
        <>
          {apiError && (
            <div className="mt-4">
              <Alert tone="error">{apiError.message}</Alert>
            </div>
          )}

          <div className="mt-4 flex flex-col gap-2 sm:flex-row">
            <Button
              variant={decision === 'APPROVE' ? 'primary' : 'secondary'}
              onClick={() => setDecision('APPROVE')}
            >
              Approve
            </Button>
            <Button
              variant={decision === 'REQUEST_CHANGES' ? 'primary' : 'secondary'}
              onClick={() => setDecision('REQUEST_CHANGES')}
            >
              Request changes
            </Button>
            <Button
              variant={decision === 'REJECT' ? 'danger' : 'secondary'}
              onClick={() => setDecision('REJECT')}
            >
              Reject
            </Button>
          </div>

          {decision && (
            <div className="mt-5 space-y-4">
              <Field
                label={needsNote ? 'What needs to change?' : 'Internal note (optional)'}
                htmlFor="reviewNote"
                required={needsNote}
                hint={
                  needsNote
                    ? `This is shown to the ${noun} word for word, so write it to them.`
                    : undefined
                }
              >
                <Textarea
                  id="reviewNote"
                  rows={4}
                  value={note}
                  autoFocus
                  onChange={(e) => setNote(e.target.value)}
                  placeholder={
                    needsNote
                      ? 'e.g. Could you add your two most recent roles and expand the summary?'
                      : ''
                  }
                />
              </Field>

              <div className="flex flex-col gap-2 sm:flex-row">
                <Button
                  variant={decision === 'REJECT' ? 'danger' : 'primary'}
                  loading={isPending}
                  disabled={needsNote && note.trim().length < 5}
                  onClick={() => onReview(decision, note.trim())}
                >
                  {decision === 'APPROVE'
                    ? 'Approve'
                    : decision === 'REQUEST_CHANGES'
                      ? 'Send back for changes'
                      : 'Reject'}
                </Button>
                <Button variant="ghost" onClick={() => setDecision(null)}>
                  Cancel
                </Button>
              </div>

              <p className="text-xs text-slate-400">
                Reviewing a record currently marked “{currentStatus.replace('_', ' ').toLowerCase()}”.
              </p>
            </div>
          )}
        </>
      )}
    </div>
  );
}
