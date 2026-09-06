/**
 * The candidate's application tracker.
 *
 * The five-step timeline uses the contract's exact wording — Applied → Under
 * Review → Shortlisted → Interview → Decision — rather than the internal
 * eleven-value stage enum. Candidates were shown those five steps, so those are
 * the five steps they see.
 */

import { useState } from 'react';
import { Link } from 'react-router-dom';
import {
  CANDIDATE_STAGE_MESSAGE,
  CANDIDATE_TIMELINE_STEPS,
  formatDate,
  formatDateTime,
  formatRelative,
} from '@bktc/shared';
import {
  useApplications,
  useWithdraw,
  useCompanyReveal,
  useInterview,
  useConfirmInterview,
  useDeclineRecommendation,
  type TrackedApplication,
} from '../../features/candidate/use-jobs.js';
import { Alert, Badge, Button, Card, EmptyState } from '../../components/ui/index.js';
import { Pagination } from '../../components/pagination.js';
import { QueryState } from '../../components/query-state.js';
import { MutationFeedback } from '../../components/mutation-feedback.js';
import { CANDIDATE_CARD } from './candidate-style.js';

const REVEALED_STAGES = [
  'SHORTLISTED',
  'INTERVIEW_SCHEDULED',
  'INTERVIEWED',
  'OFFER_MADE',
  'OFFER_ACCEPTED',
  'OFFER_DECLINED',
  'JOINED',
];

const TERMINAL = ['NOT_SELECTED', 'WITHDRAWN', 'OFFER_DECLINED', 'JOINED'];

export function ApplicationsPage() {
  const [page, setPage] = useState(1);
  const { data, isPending, error, refetch } = useApplications(page);

  return (
    <div className="space-y-6">
      <div>
        <p className="text-xs font-semibold tracking-widest text-pub-blue uppercase">Application Tracker</p>
        <h1 className="mt-1 text-2xl font-bold tracking-tight text-brand-900">Your applications</h1>
        <p className="mt-1.5 text-sm text-slate-600">
          We update these as each one moves. You&rsquo;ll see the company once you&rsquo;re
          shortlisted.
        </p>
      </div>

      <QueryState isPending={isPending} error={error} onRetry={() => void refetch()}>
      {data && data.items.length === 0 && (
        <EmptyState
          title="No applications yet"
          description="Browse open roles and apply, or wait for our team to put you forward directly."
          action={
            <Link
              to="/candidate/jobs"
              className="inline-flex min-h-11 items-center rounded-lg bg-brand-600 px-5 text-sm font-medium text-white hover:bg-brand-700"
            >
              Browse roles
            </Link>
          }
        />
      )}

      <div className="space-y-4">
        {data?.items.map((application) => (
          <ApplicationCard key={application.id} application={application} />
        ))}
      </div>
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

function ApplicationCard({ application: a }: { application: TrackedApplication }) {
  const [expanded, setExpanded] = useState(false);
  const withdraw = useWithdraw();
  const decline = useDeclineRecommendation();
  const revealed = REVEALED_STAGES.includes(a.stage);
  const { data: company } = useCompanyReveal(a.id, revealed && expanded);

  const closed = TERMINAL.includes(a.stage);

  return (
    <Card className={`transition-shadow hover:shadow-[0_4px_16px_rgba(15,23,42,0.07)] ${CANDIDATE_CARD}`}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="font-semibold text-slate-900">{a.jobTitle}</p>
          <p className="mt-1 text-sm text-slate-500">
            {a.employerName ?? 'Company revealed at shortlist'}
            {a.cityName ? ` · ${a.cityName}` : ''}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {a.isRecommended && <Badge tone="brand">Recommended by us</Badge>}
          <Badge tone={stageTone(a.stage)}>{a.stageLabel}</Badge>
        </div>
      </div>

      <Timeline currentStage={a.stage} label={a.stageLabel} />

      {a.stage === 'INTERVIEW_SCHEDULED' && <InterviewPanel applicationId={a.id} />}

      {a.isRecommended && !closed && a.stage === 'APPLIED' && (
        <div className="mt-4">
          <Alert tone="info" title="We put you forward for this one">
            <p>
              Our team recommended you to this company. Your profile and CV have been shared with
              them. If it isn&rsquo;t for you, say so and we&rsquo;ll stop.
            </p>
            <Button
              variant="secondary"
              className="mt-3 px-3 text-xs"
              loading={decline.isPending}
              onClick={() => {
                if (
                  window.confirm(
                    'Tell us you are not interested in this role? We will let the company know.',
                  )
                ) {
                  decline.mutate(a.id);
                }
              }}
            >
              Not interested
            </Button>
            <MutationFeedback
              error={decline.error}
              isSuccess={decline.isSuccess}
              successMessage="Thanks. We have told the company and stopped putting you forward."
            />
          </Alert>
        </div>
      )}

      {/* The outcome in words, not a colour. CANDIDATE_STAGE_LABEL collapses
          OFFER_MADE, JOINED and NOT_SELECTED all to "Decision", so the badge
          alone made an offer and a rejection look identical to anyone who
          could not distinguish the two shades. */}
      {CANDIDATE_STAGE_MESSAGE[a.stage as 'OFFER_MADE'] && (
        <div className="mt-4">
          <Alert
            tone={
              CANDIDATE_STAGE_MESSAGE[a.stage as 'OFFER_MADE']!.tone === 'good'
                ? 'success'
                : CANDIDATE_STAGE_MESSAGE[a.stage as 'OFFER_MADE']!.tone === 'bad'
                  ? 'warning'
                  : 'info'
            }
            title={CANDIDATE_STAGE_MESSAGE[a.stage as 'OFFER_MADE']!.headline}
          >
            {CANDIDATE_STAGE_MESSAGE[a.stage as 'OFFER_MADE']!.body}
          </Alert>
        </div>
      )}

      <div className="mt-5 flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 pt-4">
        <p className="text-xs font-medium text-slate-400">
          Applied {formatDate(a.appliedAt)} · updated {formatRelative(a.lastStageChangeAt)}
        </p>
        <div className="flex flex-wrap gap-2">
          <Button variant="ghost" onClick={() => setExpanded((e) => !e)} className="px-3 text-xs">
            {expanded ? 'Hide detail' : 'Show detail'}
          </Button>
          {!closed && (
            <Button
              variant="ghost"
              className="px-3 text-xs text-accent-600"
              loading={withdraw.isPending}
              onClick={() => {
                if (window.confirm('Withdraw this application? You can apply again later.')) {
                  withdraw.mutate(a.id);
                }
              }}
            >
              Withdraw
            </Button>
          )}
        </div>
      </div>

      <MutationFeedback
        error={withdraw.error}
        isSuccess={withdraw.isSuccess}
        successMessage="Withdrawn. You can apply again from the roles list."
      />

      {expanded && (
        <div className="mt-4 border-t border-slate-100 pt-4">
          {company && (
            <div className="mb-4 rounded-lg bg-brand-50 p-4">
              <p className="font-medium text-brand-900">{company.companyName}</p>
              {company.companyIntro && (
                <p className="mt-1 text-sm text-brand-800">{company.companyIntro}</p>
              )}
              <p className="mt-2 text-xs text-brand-700">
                All contact goes through the BK Talent Connect team. We&rsquo;ll be in touch with
                next steps.
              </p>
            </div>
          )}

          <p className="text-[11px] font-semibold tracking-wide text-slate-500 uppercase">History</p>
          <ul className="mt-2.5 space-y-2.5">
            {a.timeline.map((event, index) => (
              <li key={index} className="flex gap-3 text-sm">
                <span aria-hidden="true" className="mt-1.5 size-1.5 shrink-0 rounded-full bg-brand-400" />
                <span className="text-slate-700">
                  <span className="font-medium capitalize">{event.toStage.replace(/_/g, ' ').toLowerCase()}</span>
                  <span className="ml-2 text-xs text-slate-400">{formatDate(event.at)}</span>
                  {event.note && <span className="mt-0.5 block text-xs text-slate-500">{event.note}</span>}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </Card>
  );
}

/**
 * The interview details.
 *
 * Rendered through formatDateTime, which always carries the IST suffix — this
 * is the screen where a timezone mistake means somebody misses an interview.
 * The employer sees the identical string on their side.
 */
function InterviewPanel({ applicationId }: { applicationId: string }) {
  const { data, isPending } = useInterview(applicationId, true);
  const confirm = useConfirmInterview();

  if (isPending) return <p className="mt-4 text-sm text-slate-500">Loading interview details…</p>;

  const interview = data?.interview;
  if (!interview) {
    return (
      <div className="mt-4">
        <Alert tone="info">Our team is arranging the details. We&rsquo;ll confirm shortly.</Alert>
      </div>
    );
  }

  return (
    <div className="mt-4 rounded-lg border border-brand-200 bg-brand-50 p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[11px] font-semibold tracking-wide text-brand-700 uppercase">
            Your interview
          </p>
          <p className="mt-1 font-semibold text-brand-900">{formatDateTime(interview.scheduledAt)}</p>
          <p className="mt-0.5 text-sm text-brand-800">
            {MODE_LABEL[interview.mode]} · {interview.durationMinutes} minutes
          </p>
          <p className="mt-1 text-sm break-words text-brand-800">{interview.locationOrLink}</p>
        </div>
        {interview.youConfirmedAt ? (
          <Badge tone="green">You confirmed</Badge>
        ) : (
          <Button
            className="px-3 text-xs"
            loading={confirm.isPending}
            onClick={() => confirm.mutate(applicationId)}
          >
            Confirm you can make it
          </Button>
        )}
      </div>

      <MutationFeedback
        error={confirm.error}
        isSuccess={confirm.isSuccess}
        successMessage="Confirmed. We have let the company know."
      />

      {interview.instructions && (
        <p className="mt-3 rounded-lg bg-white/70 p-3 text-sm text-brand-900">
          {interview.instructions}
        </p>
      )}

      <p className="mt-3 text-xs text-brand-700">
        {interview.otherPartyConfirmed
          ? 'The company has confirmed too.'
          : 'We are still confirming with the company.'}{' '}
        Anything you need to change, tell us and we&rsquo;ll handle it.
      </p>
    </div>
  );
}

const MODE_LABEL: Record<string, string> = {
  PHONE: 'Phone call',
  VIDEO: 'Video call',
  ONSITE: 'In person',
};

function Timeline({ currentStage, label }: { currentStage: string; label: string }) {
  if (currentStage === 'WITHDRAWN') {
    return <p className="mt-4 text-sm text-slate-500">You withdrew this application.</p>;
  }

  const currentIndex = CANDIDATE_TIMELINE_STEPS.indexOf(
    label as (typeof CANDIDATE_TIMELINE_STEPS)[number],
  );
  const notSelected = currentStage === 'NOT_SELECTED';

  return (
    <ol className="mt-5 flex gap-1.5">
      {CANDIDATE_TIMELINE_STEPS.map((step, index) => {
        const reached = index <= currentIndex;
        const isCurrent = index === currentIndex;
        return (
          <li key={step} className="flex-1">
            <div
              className={`h-1.5 rounded-full transition-colors ${
                reached ? (notSelected && isCurrent ? 'bg-slate-400' : 'bg-brand-600') : 'bg-slate-200'
              }`}
            />
            <p
              className={`mt-1.5 text-[11px] leading-tight ${
                isCurrent ? 'font-semibold text-brand-800' : 'text-slate-400'
              }`}
            >
              {step}
            </p>
          </li>
        );
      })}
    </ol>
  );
}

function stageTone(stage: string): string {
  if (stage === 'NOT_SELECTED' || stage === 'OFFER_DECLINED') return 'red';
  if (stage === 'WITHDRAWN') return 'slate';
  if (stage === 'OFFER_MADE' || stage === 'OFFER_ACCEPTED' || stage === 'JOINED') return 'green';
  if (stage === 'SHORTLISTED' || stage === 'INTERVIEW_SCHEDULED') return 'brand';
  return 'amber';
}
