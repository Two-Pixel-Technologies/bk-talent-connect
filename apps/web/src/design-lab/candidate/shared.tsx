/**
 * DESIGN LAB — shared bits used by all 3 dashboard options.
 * Not imported by, and does not import from, any production page.
 */

import type { ReactNode, SVGProps } from 'react';
import { CANDIDATE_TIMELINE_STEPS, STAGE_STEP_INDEX, type ApplicationStage } from './mock-data.js';

type IconProps = SVGProps<SVGSVGElement>;
const base = {
  viewBox: '0 0 24 24',
  fill: 'none' as const,
  stroke: 'currentColor',
  strokeWidth: 1.75,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
};

export function IconBriefcase(props: IconProps) {
  return (
    <svg {...base} {...props}>
      <rect x="3" y="7.5" width="18" height="12" rx="2" />
      <path d="M8.5 7.5V6a2 2 0 0 1 2-2h3a2 2 0 0 1 2 2v1.5" />
      <path d="M3 12.5h18" />
    </svg>
  );
}

export function IconCheckShield(props: IconProps) {
  return (
    <svg {...base} {...props}>
      <path d="M12 3.5 5 6v5.5c0 4.2 2.9 7.4 7 9 4.1-1.6 7-4.8 7-9V6l-7-2.5Z" />
      <path d="m9 12 2 2 4-4.2" />
    </svg>
  );
}

export function IconUser(props: IconProps) {
  return (
    <svg {...base} {...props}>
      <circle cx="12" cy="8" r="3.5" />
      <path d="M5 20c.6-3.6 3-5.5 7-5.5s6.4 1.9 7 5.5" />
    </svg>
  );
}

export function IconBell(props: IconProps) {
  return (
    <svg {...base} {...props}>
      <path d="M6 10.5a6 6 0 0 1 12 0c0 3.5 1 5 2 6H4c1-1 2-2.5 2-6Z" />
      <path d="M10 19a2 2 0 0 0 4 0" />
    </svg>
  );
}

export function IconClock(props: IconProps) {
  return (
    <svg {...base} {...props}>
      <circle cx="12" cy="12" r="8.25" />
      <path d="M12 7.5V12l3 2" />
    </svg>
  );
}

export function IconMapPin(props: IconProps) {
  return (
    <svg {...base} {...props}>
      <path d="M12 21s-6.5-5.6-6.5-11A6.5 6.5 0 0 1 18.5 10c0 5.4-6.5 11-6.5 11Z" />
      <circle cx="12" cy="10" r="2.3" />
    </svg>
  );
}

export function IconArrowRight(props: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <path d="m9 6 6 6-6 6" />
    </svg>
  );
}

export function IconCalendar(props: IconProps) {
  return (
    <svg {...base} {...props}>
      <rect x="3.5" y="5" width="17" height="15.5" rx="2" />
      <path d="M3.5 9.5h17M8 3v3.5M16 3v3.5" />
    </svg>
  );
}

const STAGE_TONE: Record<ApplicationStage, { label: string; classes: string }> = {
  APPLIED: { label: 'Applied', classes: 'bg-pub-blue-light text-pub-blue' },
  UNDER_REVIEW: { label: 'Under Review', classes: 'bg-amber-50 text-amber-700' },
  SHORTLISTED: { label: 'Shortlisted', classes: 'bg-emerald-50 text-emerald-700' },
  INTERVIEW_SCHEDULED: { label: 'Interview Scheduled', classes: 'bg-violet-50 text-violet-700' },
  INTERVIEWED: { label: 'Interviewed', classes: 'bg-violet-50 text-violet-700' },
  OFFER_MADE: { label: 'Offer Made', classes: 'bg-emerald-50 text-emerald-700' },
  OFFER_ACCEPTED: { label: 'Offer Accepted', classes: 'bg-emerald-50 text-emerald-700' },
  OFFER_DECLINED: { label: 'Offer Declined', classes: 'bg-slate-100 text-slate-600' },
  JOINED: { label: 'Joined', classes: 'bg-emerald-50 text-emerald-700' },
  NOT_SELECTED: { label: 'Not Selected', classes: 'bg-slate-100 text-slate-600' },
  WITHDRAWN: { label: 'Withdrawn', classes: 'bg-slate-100 text-slate-500' },
};

export function StageBadge({ stage, className = '' }: { stage: ApplicationStage; className?: string }) {
  const tone = STAGE_TONE[stage];
  return (
    <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${tone.classes} ${className}`}>
      {tone.label}
    </span>
  );
}

/** The 5-step candidate-facing timeline (Applied → Under Review → Shortlisted → Interview → Decision). */
export function StageTimeline({ stage, compact = false }: { stage: ApplicationStage; compact?: boolean }) {
  const currentIndex = STAGE_STEP_INDEX[stage];
  return (
    <div className="flex items-center gap-1">
      {CANDIDATE_TIMELINE_STEPS.map((step, index) => (
        <div key={step} className="flex flex-1 items-center gap-1">
          <span
            title={step}
            className={`h-1.5 flex-1 rounded-full ${
              index <= currentIndex ? 'bg-pub-blue' : 'bg-pub-border'
            }`}
          />
        </div>
      ))}
      {!compact && (
        <span className="ml-2 shrink-0 text-xs font-medium text-pub-muted">
          {currentIndex >= 0 ? CANDIDATE_TIMELINE_STEPS[currentIndex] : 'Withdrawn'}
        </span>
      )}
    </div>
  );
}

export function ProfileCompletionRing({ percent, size = 64 }: { percent: number; size?: number }) {
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

export function DesignLabFrame({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children: ReactNode;
}) {
  return (
    <div>
      <div className="border-b border-pub-border bg-white px-4 py-3 sm:px-6">
        <p className="text-xs font-semibold uppercase tracking-widest text-pub-blue">{title}</p>
        <p className="mt-0.5 text-sm text-pub-muted">{description}</p>
      </div>
      {children}
    </div>
  );
}
