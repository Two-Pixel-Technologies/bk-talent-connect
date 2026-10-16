/**
 * Admin pipeline visibility — read-only.
 *
 * Product decision: Candidate and Employer own every hiring decision and all
 * interview coordination end to end. Admin inspects the pipeline — who is at
 * what stage, when it last moved, whether an interview is booked — but there
 * is no button here that changes any of it. The backend enforces the same
 * boundary (see admin-pipeline.routes.ts): the mutating routes this page used
 * to call no longer exist, so this isn't just a UI choice to hide them.
 *
 * Cards are deliberately compact (3–4 per row on desktop) so a reviewer can
 * scan many applications at once; the full history, salary fit and notes for
 * one application open in a dialog instead of expanding the card in place.
 */

import { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { CANDIDATE_STAGE_LABEL, formatDate, formatRelative, formatDateTime, type Page } from '@bktc/shared';
import { api } from '../../lib/api-client.js';
import { Badge, Card, EmptyState, Field, Input } from '../../components/ui/index.js';
import { Modal } from '../../components/modal.js';
import { Pagination } from '../../components/pagination.js';
import { QueryState } from '../../components/query-state.js';
import { NotesPanel } from '../../components/notes-panel.js';
import { useSalaryComparison } from '../../features/admin/use-admin.js';
import { useApplicationInterviews } from '../../features/admin/use-coordination.js';
import { useDebounced } from '../../lib/use-debounced.js';
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

const FILTERS = [
  { value: '', label: 'Everything' },
  { value: 'APPLIED', label: 'New' },
  { value: 'UNDER_REVIEW', label: 'With employer' },
  { value: 'SHORTLISTED', label: 'Shortlisted' },
  { value: 'INTERVIEW_SCHEDULED', label: 'Interview arranged' },
  { value: 'INTERVIEWED', label: 'Interviewed' },
  { value: 'OFFER_MADE', label: 'Offer out' },
  { value: 'NOT_SELECTED', label: 'Not selected' },
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
  const [searchParams, setSearchParams] = useSearchParams();
  const jobId = searchParams.get('jobId') ?? '';
  const candidateId = searchParams.get('candidateId') ?? '';
  // Notification deep links carry ?focus=<applicationId>.
  const focusId = searchParams.get('focus');

  const [stage, setStage] = useState('');
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const debouncedSearch = useDebounced(search);
  const [openId, setOpenId] = useState<string | null>(focusId);

  const params = new URLSearchParams({ page: String(page) });
  if (stage) params.set('stage', stage);
  if (jobId) params.set('jobId', jobId);
  if (candidateId) params.set('candidateId', candidateId);
  if (debouncedSearch) params.set('search', debouncedSearch);

  const { data, isPending, error, refetch } = useQuery({
    queryKey: ['admin', 'pipeline', stage, page, jobId, candidateId, debouncedSearch],
    queryFn: () => api.get<PipelineResponse>(`/admin/applications?${params.toString()}`),
    placeholderData: (prev) => prev,
  });

  const filterLabel = jobId ? data?.items[0]?.jobTitle : candidateId ? data?.items[0]?.candidateName : null;
  const clearEntityFilter = () => setSearchParams({});

  return (
    <div className="space-y-6">
      <div>
        <p className="text-xs font-semibold tracking-widest text-pub-blue uppercase">Pipeline</p>
        <h1 className="mt-1 text-2xl font-bold tracking-tight text-brand-900">Pipeline</h1>
        <p className="mt-1.5 text-sm text-slate-600">
          Candidates and employers run the hiring process. This is what it looks like right now.
        </p>
      </div>

      {(jobId || candidateId) && (
        <div className="flex flex-wrap items-center gap-2 rounded-lg border border-brand-200 bg-brand-50 px-3 py-2 text-sm text-brand-800">
          <span>
            Filtered to {jobId ? 'job' : 'candidate'}
            {filterLabel ? `: ${filterLabel}` : ''}
          </span>
          <button type="button" onClick={clearEntityFilter} className="font-medium underline">
            Show all pipelines
          </button>
        </div>
      )}

      {/*
        * Filters on their own row, Search on the row below — the same shape
        * the three review queues already use (queue-shell.tsx), not a row
        * shared between the two. Sharing a row previously meant the filter
        * row and a fixed-width search box were competing for the same
        * horizontal space and neither fit at the reference desktop width
        * (8 filter buttons need ~930px on their own); giving the filter row
        * the full width removes that competition and the buttons fit
        * without scrolling. overflow-x-auto stays as a safety net for
        * narrower widths where they still don't all fit.
        */}
      <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {FILTERS.map((f) => (
          <button
            key={f.value || 'all'}
            type="button"
            onClick={() => {
              setPage(1);
              setStage(f.value);
            }}
            className={`min-h-11 shrink-0 cursor-pointer rounded-lg border px-3 text-sm font-semibold whitespace-nowrap transition-colors ${
              stage === f.value
                ? 'border-brand-600 bg-brand-600 text-white shadow-sm shadow-brand-900/10'
                : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
            }`}
          >
            {f.label}
            {data?.counts[f.value] ? <span className="ml-1.5 opacity-70">{data.counts[f.value]}</span> : null}
          </button>
        ))}
      </div>

      <div className="max-w-sm">
        <Field label="Search" htmlFor="pipeline-search">
          <Input
            id="pipeline-search"
            value={search}
            onChange={(e) => {
              setPage(1);
              setSearch(e.target.value);
            }}
            placeholder="Candidate, job or company"
          />
        </Field>
      </div>

      <QueryState isPending={isPending} error={error} onRetry={() => void refetch()}>
        {data && data.items.length === 0 ? (
          <EmptyState
            title="Nothing here"
            description={
              search || stage
                ? 'No applications match this search and filter.'
                : 'Applications appear here as candidates apply and employers review them.'
            }
          />
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {data?.items.map((application) => (
              <PipelineCard
                key={application.id}
                application={application}
                onOpen={() => setOpenId(application.id)}
              />
            ))}
          </div>
        )}
      </QueryState>

      {data && (
        <Pagination page={page} pageSize={data.pageSize} total={data.total} onChange={setPage} noun="application" />
      )}

      {openId && (
        <ApplicationDialog
          applicationId={openId}
          summary={data?.items.find((a) => a.id === openId)}
          onClose={() => setOpenId(null)}
        />
      )}
    </div>
  );
}

function PipelineCard({
  application: a,
  onOpen,
}: {
  application: PipelineApplication;
  onOpen: () => void;
}) {
  return (
    <button type="button" onClick={onOpen} className="min-w-0 w-full text-left">
      <Card className={`h-full min-w-0 transition-all hover:border-brand-300 hover:shadow-[0_6px_18px_rgba(15,23,42,0.08)] ${ADMIN_CARD}`}>
        <div className="flex items-start justify-between gap-2">
          <p className="min-w-0 truncate font-semibold text-brand-900">{a.candidateName}</p>
          {a.isRecommended && <Badge tone="brand">Put forward</Badge>}
        </div>
        <p className="mt-1 truncate text-sm text-slate-600">{a.jobTitle}</p>
        <p className="truncate text-xs text-slate-500">{a.employerName}</p>
        <div className="mt-3 flex items-center justify-between gap-2">
          <Badge tone={toneFor(a.stage)}>{CANDIDATE_STAGE_LABEL[a.stage as 'APPLIED'] ?? a.stage}</Badge>
          <span className="text-xs text-slate-500">{formatRelative(a.lastStageChangeAt)}</span>
        </div>
        {a.firstEmployerActionAt === null && a.stage === 'APPLIED' && (
          <p className="mt-2 text-xs font-medium text-amber-700">Employer has not looked yet</p>
        )}
      </Card>
    </button>
  );
}

function ApplicationDialog({
  applicationId,
  summary,
  onClose,
}: {
  applicationId: string;
  summary: PipelineApplication | undefined;
  onClose: () => void;
}) {
  const detail = useQuery({
    queryKey: ['admin', 'application', applicationId],
    queryFn: () => api.get<PipelineApplication>(`/admin/applications/${applicationId}`),
  });
  const a = detail.data ?? summary;
  const interviews = useApplicationInterviews(applicationId, true);
  const liveInterview = interviews.data?.items.find((i) => i.status === 'SCHEDULED');

  if (!a) return null;

  return (
    <Modal label={`${a.candidateName}, ${a.jobTitle}`} onClose={onClose} size="lg">
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
        {a.outcomeReasonCode && <span>Reason: {REASON_LABEL[a.outcomeReasonCode] ?? a.outcomeReasonCode}</span>}
      </div>

      <div className="mt-5 space-y-4 border-t border-slate-100 pt-4">
        {liveInterview && (
          <div className="rounded-lg border border-brand-200 bg-brand-50 p-3 text-sm text-brand-900">
            <p className="font-medium">Interview booked</p>
            <p className="mt-0.5 text-brand-800">
              {formatDateTime(liveInterview.scheduledAt)} · {liveInterview.mode.toLowerCase()}
            </p>
          </div>
        )}

        <div>
          <p className="text-xs font-semibold tracking-wide text-slate-500 uppercase">History</p>
          <ul className="mt-2 space-y-1.5">
            {(detail.data?.timeline ?? a.timeline ?? []).map((event, index) => (
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

        {/*
         * The one comparison only BK can make — a candidate's expectations and
         * an employer's band each sit behind a privacy boundary nobody else
         * can see across. Read-only: this is visibility, not a decision.
         */}
        <SalaryPanel candidateProfileId={a.candidateProfileId} jobId={a.jobId} />

        <NotesPanel entityType="APPLICATION" entityId={a.id} />
      </div>
    </Modal>
  );
}

const FIT_COPY: Record<string, { label: string; tone: 'green' | 'amber' | 'red' | 'slate' }> = {
  WITHIN: { label: 'Within band', tone: 'green' },
  ABOVE: { label: 'Above band', tone: 'red' },
  BELOW: { label: 'Below band', tone: 'amber' },
  UNKNOWN: { label: 'Not enough information', tone: 'slate' },
};

function SalaryPanel({ candidateProfileId, jobId }: { candidateProfileId: string; jobId: string }) {
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
