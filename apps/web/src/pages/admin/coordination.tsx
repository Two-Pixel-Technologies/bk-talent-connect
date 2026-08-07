/**
 * Interview coordination — BK's daily work queue.
 *
 * The proposal has BK scheduling and confirming with both parties, and the API
 * for it landed in P6 with no screen, which made the whole feature unreachable:
 * employers could ask for an interview and nobody could see the request.
 *
 * Two lists, in the order the day runs: what an employer is waiting on, then
 * what is already booked and needs chasing for confirmation.
 */

import { useState } from 'react';
import { INTERVIEW_MODES, formatDateTime, formatRelative, type InterviewMode } from '@bktc/shared';
import { ApiError } from '../../lib/api-client.js';
import {
  useCoordination,
  useInterviewAction,
  useScheduleInterview,
  type AdminInterview,
  type InterviewRequest,
} from '../../features/admin/use-coordination.js';
import { Alert, Badge, Button, Card, EmptyState, Field, Input, Select, Textarea } from '../../components/ui/index.js';
import { QueryState } from '../../components/query-state.js';
import { Modal } from '../../components/modal.js';

const MODE_LABEL: Record<InterviewMode, string> = {
  PHONE: 'Phone',
  VIDEO: 'Video call',
  ONSITE: 'At the plant / office',
};

export function CoordinationPage() {
  const { data, isPending, error, refetch } = useCoordination();
  const [scheduling, setScheduling] = useState<{ applicationId: string; who: string } | null>(null);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-brand-900">Interviews</h1>
        <p className="mt-1 text-sm text-slate-600">
          Employers ask; you arrange. Both sides see exactly the same time and place.
        </p>
      </div>

      <QueryState isPending={isPending} error={error} onRetry={() => void refetch()}>
        <section className="space-y-3">
          <h2 className="text-sm font-semibold tracking-wide text-slate-500 uppercase">
            Waiting on you ({data?.requests.length ?? 0})
          </h2>

          {data && data.requests.length === 0 ? (
            <EmptyState
              title="Nothing pending"
              description="When an employer asks to meet a shortlisted candidate, it lands here."
            />
          ) : (
            data?.requests.map((request) => (
              <RequestCard
                key={request.id}
                request={request}
                onArrange={() =>
                  setScheduling({ applicationId: request.applicationId, who: request.candidateName })
                }
              />
            ))
          )}
        </section>

        <section className="space-y-3">
          <h2 className="text-sm font-semibold tracking-wide text-slate-500 uppercase">
            Coming up ({data?.upcoming.length ?? 0})
          </h2>

          {data && data.upcoming.length === 0 ? (
            <EmptyState title="No interviews booked" description="Arranged interviews appear here." />
          ) : (
            data?.upcoming.map((interview) => (
              <InterviewCard
                key={interview.id}
                interview={interview}
                onReschedule={() =>
                  setScheduling({
                    applicationId: interview.applicationId,
                    who: interview.candidateName ?? 'this candidate',
                  })
                }
              />
            ))
          )}
        </section>
      </QueryState>

      {scheduling && (
        <ScheduleDialog
          applicationId={scheduling.applicationId}
          who={scheduling.who}
          onClose={() => setScheduling(null)}
        />
      )}
    </div>
  );
}

function RequestCard({
  request,
  onArrange,
}: {
  request: InterviewRequest;
  onArrange: () => void;
}) {
  return (
    <Card>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="font-semibold text-brand-900">{request.candidateName}</p>
          <p className="mt-1 text-xs text-slate-500">Asked {formatRelative(request.createdAt)}</p>
        </div>
        <Button onClick={onArrange} className="px-3 text-xs">
          Arrange it
        </Button>
      </div>

      {request.preferredSlots.length > 0 && (
        <div className="mt-3">
          <p className="text-xs font-semibold tracking-wide text-slate-500 uppercase">
            Slots they suggested
          </p>
          <ul className="mt-1 space-y-0.5">
            {request.preferredSlots.map((slot, index) => (
              <li key={index} className="text-sm text-slate-700">
                {formatDateTime(slot)}
              </li>
            ))}
          </ul>
        </div>
      )}

      {request.note && <p className="mt-3 text-sm text-slate-600">“{request.note}”</p>}
    </Card>
  );
}

function InterviewCard({
  interview,
  onReschedule,
}: {
  interview: AdminInterview;
  onReschedule: () => void;
}) {
  const cancel = useInterviewAction('cancel');
  const complete = useInterviewAction('complete');
  const actionError =
    cancel.error instanceof ApiError
      ? cancel.error
      : complete.error instanceof ApiError
        ? complete.error
        : null;

  return (
    <Card>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="font-semibold text-brand-900">{interview.candidateName ?? 'Candidate'}</p>
          {/* IST with the suffix, the same string both parties are shown. */}
          <p className="mt-1 text-sm text-slate-700">{formatDateTime(interview.scheduledAt)}</p>
          <p className="mt-0.5 text-sm text-slate-600">
            {MODE_LABEL[interview.mode]} · {interview.durationMinutes} min
          </p>
          <p className="mt-1 text-sm break-words text-slate-500">{interview.locationOrLink}</p>
        </div>

        <div className="flex flex-col items-end gap-1.5">
          <Badge tone={interview.candidateConfirmedAt ? 'green' : 'amber'}>
            {interview.candidateConfirmedAt ? 'Candidate confirmed' : 'Candidate not confirmed'}
          </Badge>
          <Badge tone={interview.employerConfirmedAt ? 'green' : 'amber'}>
            {interview.employerConfirmedAt ? 'Employer confirmed' : 'Employer not confirmed'}
          </Badge>
        </div>
      </div>

      {interview.instructions && (
        <p className="mt-3 rounded-lg bg-slate-50 p-3 text-sm text-slate-600">
          {interview.instructions}
        </p>
      )}

      {actionError && (
        <div className="mt-3">
          <Alert tone="error">{actionError.message}</Alert>
        </div>
      )}

      <div className="mt-4 flex flex-wrap gap-2 border-t border-slate-100 pt-3">
        <Button
          className="px-3 text-xs"
          loading={complete.isPending}
          onClick={() => complete.mutate(interview.id)}
        >
          It happened
        </Button>
        <Button variant="secondary" className="px-3 text-xs" onClick={onReschedule}>
          Move it
        </Button>
        {/* Cancelling notifies both parties and unpicks a booking they have
            each planned around, so it asks first — erasing an account requires
            typing ERASE while this used to be a single tap. */}
        <Button
          variant="danger"
          className="px-3 text-xs"
          loading={cancel.isPending}
          onClick={() => {
            if (
              window.confirm(
                'Cancel this interview? We will tell the candidate and the company straight away.',
              )
            ) {
              cancel.mutate(interview.id);
            }
          }}
        >
          Cancel
        </Button>
      </div>
    </Card>
  );
}

/**
 * The scheduling form.
 *
 * `datetime-local` gives a local wall-clock string with no zone. The admin is
 * in IST and so is everybody else here, so it is converted through the
 * browser's own timezone — the one place in the app where a local time is
 * legitimately the input. What gets stored and shown back is UTC rendered as
 * IST, which is why the form echoes the result before it is saved.
 */
function ScheduleDialog({
  applicationId,
  who,
  onClose,
}: {
  applicationId: string;
  who: string;
  onClose: () => void;
}) {
  const schedule = useScheduleInterview();
  const [scheduledAt, setScheduledAt] = useState('');
  const [durationMinutes, setDurationMinutes] = useState(45);
  const [mode, setMode] = useState<InterviewMode>('VIDEO');
  const [locationOrLink, setLocationOrLink] = useState('');
  const [instructions, setInstructions] = useState('');

  const error = schedule.error instanceof ApiError ? schedule.error : null;
  const preview = scheduledAt ? formatDateTime(new Date(scheduledAt)) : null;

  function submit() {
    schedule.mutate(
      {
        applicationId,
        scheduledAt: new Date(scheduledAt).toISOString(),
        durationMinutes,
        mode,
        locationOrLink,
        ...(instructions.trim() ? { instructions: instructions.trim() } : {}),
      },
      { onSuccess: onClose },
    );
  }

  return (
    <Modal label={`Arrange an interview with ${who}`} onClose={onClose} size="lg">
        <h2 className="text-lg font-bold text-brand-900">Arrange an interview</h2>
        <p className="mt-1 text-sm text-slate-600">
          {who} and the employer both get these details, word for word.
        </p>

        {error && (
          <div className="mt-4">
            <Alert tone="error">{error.message}</Alert>
          </div>
        )}

        <div className="mt-4 space-y-4">
          <Field
            label="Date and time"
            htmlFor="scheduledAt"
            hint={preview ? `Both parties will see ${preview}` : 'At least an hour from now.'}
            error={error?.fieldError('scheduledAt')}
          >
            <Input
              id="scheduledAt"
              type="datetime-local"
              value={scheduledAt}
              onChange={(e) => setScheduledAt(e.target.value)}
            />
          </Field>

          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="How long" htmlFor="duration">
              <Select
                id="duration"
                value={String(durationMinutes)}
                onChange={(e) => setDurationMinutes(Number(e.target.value))}
              >
                {[30, 45, 60, 90, 120].map((m) => (
                  <option key={m} value={m}>
                    {m} minutes
                  </option>
                ))}
              </Select>
            </Field>

            <Field label="Format" htmlFor="mode">
              <Select
                id="mode"
                value={mode}
                onChange={(e) => setMode(e.target.value as InterviewMode)}
              >
                {INTERVIEW_MODES.map((m) => (
                  <option key={m} value={m}>
                    {MODE_LABEL[m]}
                  </option>
                ))}
              </Select>
            </Field>
          </div>

          <Field
            label={mode === 'ONSITE' ? 'Address' : 'Joining link or number'}
            htmlFor="locationOrLink"
            error={error?.fieldError('locationOrLink')}
          >
            <Input
              id="locationOrLink"
              value={locationOrLink}
              onChange={(e) => setLocationOrLink(e.target.value)}
              placeholder={
                mode === 'ONSITE' ? 'Gate 2, Plot 14, Chakan MIDC, Pune' : 'https://meet.example.com/…'
              }
            />
          </Field>

          <Field
            label="Anything they should bring or prepare"
            htmlFor="instructions"
            hint="Optional. Shown to both sides."
          >
            <Textarea
              id="instructions"
              rows={3}
              value={instructions}
              onChange={(e) => setInstructions(e.target.value)}
            />
          </Field>
        </div>

        <div className="mt-5 flex flex-col gap-2 sm:flex-row-reverse">
          <Button
            loading={schedule.isPending}
            disabled={!scheduledAt || !locationOrLink.trim()}
            onClick={submit}
          >
            Confirm with both
          </Button>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
        </div>
    </Modal>
  );
}
