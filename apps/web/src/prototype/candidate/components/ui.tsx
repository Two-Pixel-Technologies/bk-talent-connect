/**
 * CANDIDATE PORTAL PROTOTYPE — reusable UI primitives.
 * Design-only, mock-data-driven. Written so they can be lifted into the real
 * portal after approval with minimal changes (props are plain data, no
 * prototype-only coupling beyond the mock types they're typed against).
 */

import type { ButtonHTMLAttributes, ReactNode } from 'react';
import type { ApplicationStage, ApprovalStatus } from '../mock-data.js';

/* ---------------------------------------------------------------------- */
/* StatusChip — stage/approval status, one consistent chip language.       */
/* ---------------------------------------------------------------------- */

const STAGE_TONE: Record<ApplicationStage, string> = {
  APPLIED: 'bg-pub-blue-light text-pub-blue',
  UNDER_REVIEW: 'bg-amber-50 text-amber-700',
  SHORTLISTED: 'bg-emerald-50 text-emerald-700',
  INTERVIEW_SCHEDULED: 'bg-violet-50 text-violet-700',
  INTERVIEWED: 'bg-violet-50 text-violet-700',
  OFFER_MADE: 'bg-emerald-50 text-emerald-700',
  OFFER_ACCEPTED: 'bg-emerald-50 text-emerald-700',
  OFFER_DECLINED: 'bg-slate-100 text-slate-600',
  JOINED: 'bg-emerald-50 text-emerald-700',
  NOT_SELECTED: 'bg-slate-100 text-slate-600',
  WITHDRAWN: 'bg-slate-100 text-slate-500',
};

const STAGE_LABEL: Record<ApplicationStage, string> = {
  APPLIED: 'Applied',
  UNDER_REVIEW: 'Under Review',
  SHORTLISTED: 'Shortlisted',
  INTERVIEW_SCHEDULED: 'Interview Scheduled',
  INTERVIEWED: 'Interviewed',
  OFFER_MADE: 'Offer Made',
  OFFER_ACCEPTED: 'Offer Accepted',
  OFFER_DECLINED: 'Offer Declined',
  JOINED: 'Joined',
  NOT_SELECTED: 'Not Selected',
  WITHDRAWN: 'Withdrawn',
};

export function StageChip({ stage, className = '' }: { stage: ApplicationStage; className?: string }) {
  return (
    <span className={`inline-flex shrink-0 rounded-full px-2.5 py-1 text-xs font-semibold ${STAGE_TONE[stage]} ${className}`}>
      {STAGE_LABEL[stage]}
    </span>
  );
}

const APPROVAL_TONE: Record<ApprovalStatus, string> = {
  DRAFT: 'bg-slate-100 text-slate-600',
  SUBMITTED: 'bg-amber-50 text-amber-700',
  APPROVED: 'bg-emerald-50 text-emerald-700',
  CHANGES_REQUESTED: 'bg-amber-50 text-amber-700',
  REJECTED: 'bg-red-50 text-red-700',
};

const APPROVAL_LABEL: Record<ApprovalStatus, string> = {
  DRAFT: 'Draft',
  SUBMITTED: 'Submitted for review',
  APPROVED: 'Approved',
  CHANGES_REQUESTED: 'Changes requested',
  REJECTED: 'Rejected',
};

export function ApprovalChip({ status, className = '' }: { status: ApprovalStatus; className?: string }) {
  return (
    <span className={`inline-flex shrink-0 rounded-full px-2.5 py-1 text-xs font-semibold ${APPROVAL_TONE[status]} ${className}`}>
      {APPROVAL_LABEL[status]}
    </span>
  );
}

/* ---------------------------------------------------------------------- */
/* MetricTile — a single dashboard summary number.                        */
/* ---------------------------------------------------------------------- */

export function MetricTile({
  label,
  value,
  icon,
  tone = 'default',
}: {
  label: string;
  value: string | number;
  icon: ReactNode;
  tone?: 'default' | 'navy';
}) {
  if (tone === 'navy') {
    return (
      <div className="rounded-2xl bg-gradient-to-br from-pub-navy to-[#0e2a56] p-4 text-white shadow-sm">
        <span className="flex size-9 items-center justify-center rounded-full bg-white/15">{icon}</span>
        <p className="mt-3 font-heading text-2xl font-bold">{value}</p>
        <p className="mt-0.5 text-xs text-white/70">{label}</p>
      </div>
    );
  }
  return (
    <div className="rounded-2xl border border-pub-border bg-white p-4 shadow-sm">
      <span className="flex size-9 items-center justify-center rounded-full bg-pub-blue-light text-pub-blue">{icon}</span>
      <p className="mt-3 font-heading text-2xl font-bold text-pub-navy">{value}</p>
      <p className="mt-0.5 text-xs text-pub-muted">{label}</p>
    </div>
  );
}

/* ---------------------------------------------------------------------- */
/* ProfileProgressRing                                                     */
/* ---------------------------------------------------------------------- */

export function ProfileProgressRing({ percent, size = 64 }: { percent: number; size?: number }) {
  const r = (size - 8) / 2;
  const c = 2 * Math.PI * r;
  const offset = c * (1 - percent / 100);
  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      <svg viewBox={`0 0 ${size} ${size}`} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--color-pub-border)" strokeWidth="6" />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke="var(--color-pub-blue)"
          strokeWidth="6"
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={offset}
        />
      </svg>
      <span className="absolute inset-0 flex items-center justify-center font-heading text-sm font-bold text-pub-navy">
        {percent}%
      </span>
    </div>
  );
}

/* ---------------------------------------------------------------------- */
/* SectionCard — a titled panel used across profile/dashboard pages.       */
/* ---------------------------------------------------------------------- */

export function SectionCard({
  title,
  action,
  children,
  className = '',
}: {
  title?: string;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={`rounded-2xl border border-pub-border bg-white p-5 shadow-sm sm:p-6 ${className}`}>
      {title && (
        <div className="flex items-center justify-between gap-3">
          <h2 className="font-heading text-base font-bold text-pub-navy">{title}</h2>
          {action}
        </div>
      )}
      <div className={title ? 'mt-4' : ''}>{children}</div>
    </section>
  );
}

/* ---------------------------------------------------------------------- */
/* EmptyState                                                              */
/* ---------------------------------------------------------------------- */

export function EmptyState({
  icon,
  title,
  description,
  action,
}: {
  icon?: ReactNode;
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center rounded-2xl border border-dashed border-pub-border bg-pub-bg/60 p-10 text-center">
      {icon && <span className="mb-3 flex size-12 items-center justify-center rounded-full bg-white text-pub-blue shadow-sm">{icon}</span>}
      <p className="font-heading text-sm font-bold text-pub-navy">{title}</p>
      {description && <p className="mx-auto mt-1 max-w-sm text-sm text-pub-muted">{description}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

/* ---------------------------------------------------------------------- */
/* Skeletons — loading placeholders, prototype-only states.                */
/* ---------------------------------------------------------------------- */

export function SkeletonLine({ className = '' }: { className?: string }) {
  return <div className={`animate-pulse rounded bg-pub-border/70 ${className}`} />;
}

export function SkeletonCard() {
  return (
    <div className="rounded-2xl border border-pub-border bg-white p-5 shadow-sm">
      <div className="flex items-center gap-3">
        <div className="size-10 shrink-0 animate-pulse rounded-full bg-pub-border/70" />
        <div className="flex-1 space-y-2">
          <SkeletonLine className="h-3.5 w-2/3" />
          <SkeletonLine className="h-3 w-1/3" />
        </div>
      </div>
      <div className="mt-4 space-y-2">
        <SkeletonLine className="h-2.5 w-full" />
        <SkeletonLine className="h-2.5 w-5/6" />
      </div>
    </div>
  );
}

/* ---------------------------------------------------------------------- */
/* Buttons — matching the site's premium button language.                  */
/* ---------------------------------------------------------------------- */

export function PrimaryButton({
  children,
  loading = false,
  className = '',
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { loading?: boolean }) {
  return (
    <button
      {...props}
      disabled={props.disabled || loading}
      className={`inline-flex min-h-10 items-center justify-center gap-2 rounded-lg bg-pub-blue px-4 text-sm font-semibold text-white transition-colors hover:bg-pub-navy disabled:cursor-not-allowed disabled:opacity-60 ${className}`}
    >
      {loading && <span aria-hidden="true" className="size-3.5 animate-spin rounded-full border-2 border-white/40 border-t-white" />}
      {children}
    </button>
  );
}

export function SecondaryButton({
  children,
  loading = false,
  className = '',
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { loading?: boolean }) {
  return (
    <button
      {...props}
      disabled={props.disabled || loading}
      className={`inline-flex min-h-10 items-center justify-center gap-2 rounded-lg border border-pub-border bg-white px-4 text-sm font-semibold text-pub-navy transition-colors hover:bg-pub-bg disabled:cursor-not-allowed disabled:opacity-60 ${className}`}
    >
      {loading && <span aria-hidden="true" className="size-3.5 animate-spin rounded-full border-2 border-pub-border border-t-pub-blue" />}
      {children}
    </button>
  );
}
