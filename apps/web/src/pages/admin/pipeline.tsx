/**
 * Admin pipeline control.
 *
 * The screen that makes this a *managed* portal. Employers can take an
 * application as far as Shortlisted; everything after that — arranging the
 * interview, recording the outcome, marking someone joined — is BK's, and until
 * this existed those steps were unreachable for anybody.
 *
 * The action buttons come from the server's `availableStages`, which is
 * `allowedNextStages()` over the shared D4 matrix. No second copy of the rules.
 */

import { useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  CANDIDATE_STAGE_LABEL,
  OUTCOME_REASON_CODES,
  formatDate,
  formatRelative,
  type Page,
} from '@bktc/shared';
import { api, ApiError } from '../../lib/api-client.js';
import { Alert, Badge, Button, Card, EmptyState, Field, Select } from '../../components/ui/index.js';
import { Pagination } from '../../components/pagination.js';
import { QueryState } from '../../components/query-state.js';
import { NotesPanel } from '../../components/notes-panel.js';
import { useSalaryComparison } from '../../features/admin/use-admin.js';
import { ADMIN_CARD } from './admin-style.js';

type PipelineApplication = {
  id: string;
  jobId: string;
  jobTitle: string;
  employerName: string;
  candidateProfileId: string;
  candidateName: string;
  stage: string;
  source: string;
  isRecommended: boolean;
  appliedAt: string;
  lastStageChangeAt: string;
  firstEmployerActionAt: string | null;
  outcomeReasonCode: string | null;
  timeline: { fromStage: string | null; toStage: string; byRole: string; note: string | null; at: string }[];
};

type PipelineResponse = Page<PipelineApplication> & { counts: Record<string, number> };

/** The stages BK owns, in the order they happen. */
const STAGE_ACTIONS: Record<string, { label: string; variant: 'primary' | 'secondary' | 'danger' }> = {
  UNDER_REVIEW: { label: 'Move to reviewing', variant: 'secondary' },
  SHORTLISTED: { label: 'Shortlist', variant: 'secondary' },
  INTERVIEW_SCHEDULED: { label: 'Interview arranged', variant: 'primary' },
  INTERVIEWED: { label: 'Interview done', variant: 'primary' },
  OFFER_MADE: { label: 'Offer made', variant: 'primary' },
  OFFER_ACCEPTED: { label: 'Offer accepted', variant: 'primary' },
  OFFER_DECLINED: { label: 'Offer declined', variant: 'secondary' },
  JOINED: { label: 'Joined', variant: 'primary' },
  NOT_SELECTED: { label: 'Not selected', variant: 'danger' },
  APPLIED: { label: 'Back to applied', variant: 'secondary' },
};

const FILTERS = [
  { value: '', label: 'Everything' },
  { value: 'SHORTLISTED', label: 'Ready for interview' },
  { value: 'INTERVIEW_SCHEDULED', label: 'Interview arranged' },
  { value: 'INTERVIEWED', label: 'Interviewed' },
  { value: 'OFFER_MADE', label: 'Offer out' },
  { value: 'UNDER_REVIEW', label: 'With employer' },
  { value: 'APPLIED', label: 'New' },
];

const REASON_LABEL: Record<string, string> = {
  SKILLS_MISMATCH: 'Skills did not match',
  EXPERIENCE_MISMATCH: 'Experience did not match',
  SALARY_MISMATCH: 'Salary expectations',
  LOCATION_MISMATCH: 'Location',
  NOTICE_PERIOD: 'Notice period',
  CANDIDATE_UNRESPONSIVE: 'Candidate unresponsive',
  CANDIDATE_DECLINED: 'Candidate declined',
  POSITION_FILLED: 'Position filled',
  JOB_CLOSED: 'Role closed',
  OTHER: 'Other',
};

export function PipelinePage() {
  const [searchParams] = useSearchParams();
  // Notification deep links carry ?focus=<applicationId>. The page read no
  // search params at all, so every link landed on an unfiltered list with
  // nothing selected.
  const focusId = searchParams.get('focus');

  const [stage, setStage] = useState('');
  const [page, setPage] = useState(1);
  const [openId, setOpenId] = useState<string | null>(focusId);
  const queryClient = useQueryClient();

  const params = new URLSearchParams({ page: String(page) });
  if (stage) params.set('stage', stage);

  const { data, isPending, error, refetch } = useQuery({
    queryKey: ['admin', 'pipeline', stage, page],
    queryFn: () => api.get<PipelineResponse>(`/admin/applications?${params.toString()}`),
    placeholderData: (prev) => prev,
  });

  const changeStage = useMutation({
    mutationFn: (input: { id: string; stage: string; outcomeReasonCode?: string }) =>
      api.post(`/admin/applications/${input.id}/stage`, {
        stage: input.stage,
        ...(input.outcomeReasonCode ? { outcomeReasonCode: input.outcomeReasonCode } : {}),
      }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['admin'] }),
  });

  const actionError = changeStage.error instanceof ApiError ? changeStage.error : null;

  return (
    <div className="space-y-6">
      <div>
        <p className="text-xs font-semibold tracking-widest text-pub-blue uppercase">Pipeline</p>
        <h1 className="mt-1 text-2xl font-bold tracking-tight text-brand-900">Pipeline</h1>
        <p className="mt-1.5 text-sm text-slate-600">
          Employers can shortlist. Everything after that - arranging interviews, recording outcomes
          - is yours.
        </p>
      </div>

      {actionError && <Alert tone="error">{actionError.message}</Alert>}

      <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {FILTERS.map((f) => (
          <button
            key={f.value || 'all'}
            type="button"
            onClick={() => {
              setPage(1);
              setStage(f.value);
            }}
            className={`min-h-11 shrink-0 rounded-lg border px-3 text-sm font-semibold whitespace-nowrap transition-colors ${
              stage === f.value
                ? 'border-brand-600 bg-brand-600 text-white shadow-sm shadow-brand-900/10'
                : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
            }`}
          >
            {f.label}
            {data?.counts[f.value] ? (
              <span className="ml-1.5 opacity-70">{data.counts[f.value]}</span>
            ) : null}
          </button>
        ))}
      </div>

      <QueryState isPending={isPending} error={error} onRetry={() => void refetch()}>
        {data && data.items.length === 0 ? (
          <EmptyState
            title="Nothing here"
            description={
              stage
                ? 'No applications are at this stage.'
                : 'Applications appear here as candidates apply and employers review them.'
            }
          />
        ) : (
          <div className="space-y-3">
            {data?.items.map((application) => (
              <PipelineCard
                key={application.id}
                application={application}
                open={openId === application.id}
                onToggle={() => setOpenId(openId === application.id ? null : application.id)}
                onStage={(next, reason) =>
                  changeStage.mutate({
                    id: application.id,
                    stage: next,
                    ...(reason ? { outcomeReasonCode: reason } : {}),
                  })
                }
                // Only the row actually in flight. A page-level flag spun the
                // buttons on all twenty cards and gave no clue which one was
                // being acted on.
                isPending={changeStage.isPending && changeStage.variables?.id === application.id}
              />
            ))}
          </div>
        )}
      </QueryState>

      {data && (
        <Pagination
          page={page}
          pageSize={data.pageSize}
          total={data.total}
          onChange={setPage}
          noun="application"
        />
      )}
    </div>
  );
}

function PipelineCard({
  application: a,
  open,
  onToggle,
  onStage,
  isPending,
}: {
  application: PipelineApplication;
  open: boolean;
  onToggle: () => void;
  onStage: (stage: string, reason?: string) => void;
  isPending: boolean;
}) {
  const [pendingReject, setPendingReject] = useState(false);
  const [reason, setReason] = useState<string>('SKILLS_MISMATCH');

  const detail = useQuery({
    queryKey: ['admin', 'application', a.id],
    queryFn: () =>
      api.get<PipelineApplication & { availableStages: string[] }>(`/admin/applications/${a.id}`),
    enabled: open,
  });

  const available = detail.data?.availableStages ?? [];

  return (
    <Card className={ADMIN_CARD}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <p className="font-semibold text-brand-900">{a.candidateName}</p>
            {a.isRecommended && <Badge tone="brand">We put them forward</Badge>}
          </div>
          <p className="mt-1 text-sm text-slate-600">
            {a.jobTitle} · {a.employerName}
          </p>
        </div>
        <Badge tone={toneFor(a.stage)}>{CANDIDATE_STAGE_LABEL[a.stage as 'APPLIED'] ?? a.stage}</Badge>
      </div>

      <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-500">
        <span>Applied {formatDate(a.appliedAt)}</span>
        <span>Moved {formatRelative(a.lastStageChangeAt)}</span>
        <span className="font-mono">{a.stage.replace(/_/g, ' ').toLowerCase()}</span>
        {a.outcomeReasonCode && <span>Reason: {REASON_LABEL[a.outcomeReasonCode] ?? a.outcomeReasonCode}</span>}
        {a.firstEmployerActionAt === null && a.stage === 'APPLIED' && (
          <span className="font-medium text-amber-700">Employer has not looked yet</span>
        )}
      </div>

      {open && (
        <div className="mt-5 space-y-4 border-t border-slate-100 pt-4">
          <div>
            <p className="text-xs font-semibold tracking-wide text-slate-500 uppercase">History</p>
            <ul className="mt-2 space-y-1.5">
              {(detail.data?.timeline ?? a.timeline).map((event, index) => (
                <li key={index} className="flex gap-3 text-sm">
                  <span aria-hidden="true" className="mt-1.5 size-1.5 shrink-0 rounded-full bg-brand-400" />
                  <span className="text-slate-700">
                    {event.toStage.replace(/_/g, ' ').toLowerCase()}
                    <span className="ml-2 text-xs text-slate-400">
                      {formatDate(event.at)} · {event.byRole.toLowerCase()}
                    </span>
                    {event.note && <span className="block text-xs text-slate-500">{event.note}</span>}
                  </span>
                </li>
              ))}
            </ul>
          </div>

          {pendingReject && (
            <Alert tone="warning" title="Why are they not going forward?">
              <p>
                Recorded against the application. Phase 2 reports on these, and the reason cannot be
                reconstructed afterwards.
              </p>
              <div className="mt-3 max-w-xs">
                <Field label="Reason" htmlFor={`reason-${a.id}`}>
                  <Select id={`reason-${a.id}`} value={reason} onChange={(e) => setReason(e.target.value)}>
                    {OUTCOME_REASON_CODES.filter((c) => c !== 'JOB_CLOSED').map((code) => (
                      <option key={code} value={code}>
                        {REASON_LABEL[code] ?? code}
                      </option>
                    ))}
                  </Select>
                </Field>
              </div>
              <div className="mt-3 flex flex-col gap-2 sm:flex-row">
                <Button
                  variant="danger"
                  loading={isPending}
                  onClick={() => {
                    onStage('NOT_SELECTED', reason);
                    setPendingReject(false);
                  }}
                >
                  Record it
                </Button>
                <Button variant="secondary" onClick={() => setPendingReject(false)}>
                  Cancel
                </Button>
              </div>
            </Alert>
          )}

          {/* SHORTLISTED is where BK takes over — the interview is arranged on
              the coordination screen, which is also where the stage moves. */}
          {a.stage === 'SHORTLISTED' && (
            <Alert tone="info">
              Ready for an interview. Arrange it from{' '}
              <Link to="/admin/coordination" className="font-medium underline">
                Interviews
              </Link>{' '}
              — the stage moves when the booking is made.
            </Alert>
          )}

          {/*
            * The one comparison only BK can make.
            *
            * A candidate's expectations sit behind one privacy boundary and an
            * employer's band behind another, so nobody else in the system can
            * put the two side by side. The endpoint and the hook both existed
            * and no screen rendered them.
            */}
          <SalaryPanel candidateProfileId={a.candidateProfileId} jobId={a.jobId} />

          <NotesPanel entityType="APPLICATION" entityId={a.id} />

          {detail.isPending ? (
            <p className="text-sm text-slate-500">Loading actions…</p>
          ) : (
            <div className="flex flex-wrap gap-2">
              {available.map((next) => {
                const action = STAGE_ACTIONS[next];
                if (!action) return null;
                if (next === 'NOT_SELECTED') {
                  return (
                    <Button
                      key={next}
                      variant="danger"
                      className="px-3 text-xs"
                      onClick={() => setPendingReject(true)}
                    >
                      {action.label}
                    </Button>
                  );
                }
                return (
                  <Button
                    key={next}
                    variant={action.variant}
                    className="px-3 text-xs"
                    loading={isPending}
                    onClick={() => onStage(next)}
                  >
                    {action.label}
                  </Button>
                );
              })}
              {available.length === 0 && (
                <p className="text-sm text-slate-500">
                  This application has reached the end of the pipeline.
                </p>
              )}
            </div>
          )}
        </div>
      )}

      <div className="mt-4 border-t border-slate-100 pt-3">
        <Button variant="ghost" className="px-3 text-xs" onClick={onToggle}>
          {open ? 'Hide' : 'Manage'}
        </Button>
      </div>
    </Card>
  );
}

const FIT_COPY: Record<string, { label: string; tone: 'green' | 'amber' | 'red' | 'slate' }> = {
  WITHIN: { label: 'Within band', tone: 'green' },
  ABOVE: { label: 'Above band', tone: 'red' },
  BELOW: { label: 'Below band', tone: 'amber' },
  UNKNOWN: { label: 'Not enough information', tone: 'slate' },
};

function SalaryPanel({
  candidateProfileId,
  jobId,
}: {
  candidateProfileId: string;
  jobId: string;
}) {
  const { data, isPending, isError } = useSalaryComparison(candidateProfileId, jobId);

  if (isPending) return <p className="text-sm text-slate-500">Checking salary fit…</p>;
  if (isError || !data) {
    return <p className="text-sm text-slate-500">Salary comparison unavailable.</p>;
  }

  const fit = FIT_COPY[data.fit] ?? FIT_COPY.UNKNOWN!;
  const range = (min: number | null, max: number | null) =>
    min == null && max == null ? '—' : `${min ?? '?'} – ${max ?? '?'} LPA`;

  return (
    <div className="rounded-lg border border-amber-200 bg-amber-50 p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs font-semibold tracking-wide text-amber-800 uppercase">
          🔒 Salary fit — visible to you only
        </p>
        <Badge tone={fit.tone}>{fit.label}</Badge>
      </div>
      <dl className="mt-3 grid gap-x-6 gap-y-1.5 text-sm sm:grid-cols-2">
        <div>
          <dt className="text-xs text-amber-800">They expect</dt>
          <dd className="text-amber-900">
            {range(data.candidateExpectedMinLpa, data.candidateExpectedMaxLpa)}
          </dd>
        </div>
        <div>
          <dt className="text-xs text-amber-800">Company band</dt>
          <dd className="text-amber-900">{range(data.jobBandMinLpa, data.jobBandMaxLpa)}</dd>
        </div>
        <div>
          <dt className="text-xs text-amber-800">Currently on</dt>
          <dd className="text-amber-900">
            {data.candidateCurrentLpa == null ? '—' : `${data.candidateCurrentLpa} LPA`}
          </dd>
        </div>
        {data.gapLpa != null && data.gapLpa > 0 && (
          <div>
            <dt className="text-xs text-amber-800">Gap</dt>
            <dd className="font-medium text-amber-900">{data.gapLpa} LPA</dd>
          </div>
        )}
      </dl>
    </div>
  );
}

function toneFor(stage: string): string {
  if (stage === 'NOT_SELECTED' || stage === 'OFFER_DECLINED') return 'red';
  if (stage === 'WITHDRAWN') return 'slate';
  if (stage === 'JOINED' || stage === 'OFFER_ACCEPTED') return 'green';
  if (stage === 'SHORTLISTED' || stage === 'INTERVIEW_SCHEDULED' || stage === 'OFFER_MADE') return 'brand';
  return 'amber';
}
