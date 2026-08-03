/**
 * Application pipeline stages and the legal transitions between them.
 *
 * This file is the specification. The server's transition validator and the
 * whole transition test suite are both derived from ALLOWED_TRANSITIONS — do
 * not hand-write a second copy of these rules anywhere.
 *
 * Plan reference: D4.
 */

import type { Role } from './enums.js';

export const APPLICATION_STAGES = [
  'APPLIED',
  'UNDER_REVIEW',
  'SHORTLISTED',
  'INTERVIEW_SCHEDULED',
  'INTERVIEWED',
  'OFFER_MADE',
  'OFFER_ACCEPTED',
  'OFFER_DECLINED',
  'JOINED',
  'NOT_SELECTED',
  'WITHDRAWN',
] as const;
export type ApplicationStage = (typeof APPLICATION_STAGES)[number];

/**
 * Stages from which no further progress is possible without an admin override.
 * NOT_SELECTED is deliberately NOT terminal — see REVERSIBLE_WINDOW_MS.
 */
export const TERMINAL_STAGES = ['JOINED', 'OFFER_DECLINED'] as const satisfies readonly ApplicationStage[];

/**
 * An admin may reverse an accidental NOT_SELECTED within this window. Without
 * it a mis-click permanently ends a candidate's chance at a role and fires a
 * rejection notification that cannot be taken back.
 */
export const NOT_SELECTED_REVERSIBLE_WINDOW_MS = 24 * 60 * 60 * 1000;

export interface StageTransition {
  readonly from: ApplicationStage;
  readonly to: ApplicationStage;
  /** Roles permitted to make this transition. */
  readonly roles: readonly Role[];
  /** Human-readable rationale, surfaced in error messages and docs. */
  readonly note?: string;
}

export const ALLOWED_TRANSITIONS: readonly StageTransition[] = [
  // --- Employer-driven progression -----------------------------------------
  { from: 'APPLIED', to: 'UNDER_REVIEW', roles: ['EMPLOYER', 'ADMIN'] },
  { from: 'APPLIED', to: 'NOT_SELECTED', roles: ['EMPLOYER', 'ADMIN'] },
  { from: 'UNDER_REVIEW', to: 'SHORTLISTED', roles: ['EMPLOYER', 'ADMIN'] },
  { from: 'UNDER_REVIEW', to: 'NOT_SELECTED', roles: ['EMPLOYER', 'ADMIN'] },
  { from: 'SHORTLISTED', to: 'NOT_SELECTED', roles: ['EMPLOYER', 'ADMIN'] },
  { from: 'INTERVIEWED', to: 'OFFER_MADE', roles: ['EMPLOYER', 'ADMIN'] },
  { from: 'INTERVIEWED', to: 'NOT_SELECTED', roles: ['EMPLOYER', 'ADMIN'] },

  // --- Admin-only: BK coordinates every interview ---------------------------
  {
    from: 'SHORTLISTED',
    to: 'INTERVIEW_SCHEDULED',
    roles: ['ADMIN'],
    note: 'BK schedules and confirms with both parties; employers request, they do not schedule.',
  },
  { from: 'INTERVIEW_SCHEDULED', to: 'INTERVIEWED', roles: ['ADMIN'] },
  { from: 'INTERVIEW_SCHEDULED', to: 'NOT_SELECTED', roles: ['ADMIN'] },
  { from: 'OFFER_MADE', to: 'OFFER_ACCEPTED', roles: ['ADMIN'] },
  { from: 'OFFER_MADE', to: 'OFFER_DECLINED', roles: ['ADMIN'] },
  { from: 'OFFER_ACCEPTED', to: 'JOINED', roles: ['ADMIN'] },

  // --- Admin-only regressions ----------------------------------------------
  {
    from: 'UNDER_REVIEW',
    to: 'APPLIED',
    roles: ['ADMIN'],
    note: 'Regression is an admin correction tool, never an employer action.',
  },
  { from: 'SHORTLISTED', to: 'UNDER_REVIEW', roles: ['ADMIN'] },
  { from: 'INTERVIEW_SCHEDULED', to: 'SHORTLISTED', roles: ['ADMIN'] },

  // --- Candidate-driven -----------------------------------------------------
  { from: 'APPLIED', to: 'WITHDRAWN', roles: ['CANDIDATE'] },
  { from: 'UNDER_REVIEW', to: 'WITHDRAWN', roles: ['CANDIDATE'] },
  { from: 'SHORTLISTED', to: 'WITHDRAWN', roles: ['CANDIDATE'] },
  { from: 'INTERVIEW_SCHEDULED', to: 'WITHDRAWN', roles: ['CANDIDATE'] },
  { from: 'INTERVIEWED', to: 'WITHDRAWN', roles: ['CANDIDATE'] },
  { from: 'OFFER_MADE', to: 'WITHDRAWN', roles: ['CANDIDATE'] },
  {
    from: 'WITHDRAWN',
    to: 'APPLIED',
    roles: ['CANDIDATE'],
    note: 'Re-apply. The unique (jobId, candidateId) constraint means withdrawing would otherwise lock the candidate out of that job forever.',
  },
] as const;

/**
 * NOT_SELECTED → previous stage is handled separately from the table above
 * because it is time-bounded and the target depends on history rather than
 * being a fixed pair. See NOT_SELECTED_REVERSIBLE_WINDOW_MS.
 */
export const NOT_SELECTED_REVERSIBLE_TO = [
  'APPLIED',
  'UNDER_REVIEW',
  'SHORTLISTED',
  'INTERVIEW_SCHEDULED',
  'INTERVIEWED',
] as const satisfies readonly ApplicationStage[];

export interface TransitionCheck {
  readonly allowed: boolean;
  readonly reason?: string;
}

/** The single authority on whether a stage change is legal. */
export function canTransition(
  from: ApplicationStage,
  to: ApplicationStage,
  role: Role,
  options?: { readonly stageChangedAt?: Date; readonly now?: Date },
): TransitionCheck {
  if (from === to) {
    return { allowed: false, reason: 'Application is already at that stage.' };
  }

  if (from === 'NOT_SELECTED') {
    if (role !== 'ADMIN') {
      return { allowed: false, reason: 'Only an admin can reopen a rejected application.' };
    }
    if (!(NOT_SELECTED_REVERSIBLE_TO as readonly string[]).includes(to)) {
      return { allowed: false, reason: `Cannot reopen a rejected application into ${to}.` };
    }
    const changedAt = options?.stageChangedAt;
    const now = options?.now ?? new Date();
    if (!changedAt) {
      return { allowed: false, reason: 'Cannot verify the rejection window without a timestamp.' };
    }
    if (now.getTime() - changedAt.getTime() > NOT_SELECTED_REVERSIBLE_WINDOW_MS) {
      return { allowed: false, reason: 'The 24-hour window to reverse this rejection has passed.' };
    }
    return { allowed: true };
  }

  const match = ALLOWED_TRANSITIONS.find((t) => t.from === from && t.to === to);
  if (!match) {
    return { allowed: false, reason: `${from} cannot move to ${to}.` };
  }
  if (!match.roles.includes(role)) {
    return { allowed: false, reason: `A ${role.toLowerCase()} cannot move an application from ${from} to ${to}.` };
  }
  return { allowed: true };
}

/** Every stage a given role can move an application into from `from`. */
export function allowedNextStages(from: ApplicationStage, role: Role): ApplicationStage[] {
  return ALLOWED_TRANSITIONS.filter((t) => t.from === from && t.roles.includes(role)).map((t) => t.to);
}

// ---------------------------------------------------------------------------
// Presentation
//
// Internal stages are finer-grained than what either party is shown. The
// contract shows candidates five steps and employers four buckets; exposing the
// raw eleven-value enum would read as "not what we agreed".
// ---------------------------------------------------------------------------

/** Candidate tracker wording, using the Phased Plan's exact labels. */
export const CANDIDATE_STAGE_LABEL: Record<ApplicationStage, string> = {
  APPLIED: 'Applied',
  UNDER_REVIEW: 'Under Review',
  SHORTLISTED: 'Shortlisted',
  INTERVIEW_SCHEDULED: 'Interview',
  INTERVIEWED: 'Interview',
  OFFER_MADE: 'Decision',
  OFFER_ACCEPTED: 'Decision',
  OFFER_DECLINED: 'Decision',
  JOINED: 'Decision',
  NOT_SELECTED: 'Decision',
  WITHDRAWN: 'Withdrawn',
};

/** The five steps drawn in the candidate's progress timeline, in order. */
export const CANDIDATE_TIMELINE_STEPS = [
  'Applied',
  'Under Review',
  'Shortlisted',
  'Interview',
  'Decision',
] as const;

export const EMPLOYER_BUCKETS = ['NEW', 'REVIEWING', 'INTERVIEW', 'DECISION'] as const;
export type EmployerBucket = (typeof EMPLOYER_BUCKETS)[number];

/** Proposal p6 Kanban columns. Phase 2 swaps the list for a board; the buckets are the same. */
export const EMPLOYER_BUCKET_OF: Record<ApplicationStage, EmployerBucket | null> = {
  APPLIED: 'NEW',
  UNDER_REVIEW: 'REVIEWING',
  SHORTLISTED: 'REVIEWING',
  INTERVIEW_SCHEDULED: 'INTERVIEW',
  INTERVIEWED: 'INTERVIEW',
  OFFER_MADE: 'DECISION',
  OFFER_ACCEPTED: 'DECISION',
  OFFER_DECLINED: 'DECISION',
  JOINED: 'DECISION',
  NOT_SELECTED: 'DECISION',
  WITHDRAWN: null, // withdrawn applications leave the employer's board entirely
};
