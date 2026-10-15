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
  { from: 'APPLIED', to: 'UNDER_REVIEW', roles: ['EMPLOYER'] },
  { from: 'APPLIED', to: 'NOT_SELECTED', roles: ['EMPLOYER'] },
  { from: 'UNDER_REVIEW', to: 'SHORTLISTED', roles: ['EMPLOYER'] },
  { from: 'UNDER_REVIEW', to: 'NOT_SELECTED', roles: ['EMPLOYER'] },
  { from: 'SHORTLISTED', to: 'NOT_SELECTED', roles: ['EMPLOYER'] },
  { from: 'INTERVIEWED', to: 'OFFER_MADE', roles: ['EMPLOYER'] },
  { from: 'INTERVIEWED', to: 'NOT_SELECTED', roles: ['EMPLOYER'] },

  /*
   * --- Employer-driven interview coordination -------------------------------
   *
   * Previously admin-only ("BK schedules and confirms with both parties").
   * Product decision: Candidate and Employer own interview coordination and
   * every hiring decision end to end; Admin is read-only. The employer now
   * schedules directly (via the same scheduleInterview/completeInterview
   * service functions, parameterised by actor role instead of hardcoded to
   * ADMIN) and can still just ask (requestInterview) if they would rather
   * propose slots first.
   */
  { from: 'SHORTLISTED', to: 'INTERVIEW_SCHEDULED', roles: ['EMPLOYER'] },
  { from: 'INTERVIEW_SCHEDULED', to: 'INTERVIEWED', roles: ['EMPLOYER'] },
  { from: 'INTERVIEW_SCHEDULED', to: 'NOT_SELECTED', roles: ['EMPLOYER'] },

  /*
   * --- The offer decision is the candidate's ---------------------------------
   *
   * Accepting or declining a job offer is unambiguously the candidate's own
   * decision in any real hiring process, not the employer's and not BK's.
   * Previously admin-only; BK had no business making this call on anyone's
   * behalf, it simply had no other actor to assign it to.
   */
  { from: 'OFFER_MADE', to: 'OFFER_ACCEPTED', roles: ['CANDIDATE'] },
  { from: 'OFFER_MADE', to: 'OFFER_DECLINED', roles: ['CANDIDATE'] },

  /*
   * --- Joining is the employer's to confirm -----------------------------------
   * The employer is the party who actually observes the candidate starting —
   * onboarding, first day — so they confirm it, previously admin-only.
   */
  { from: 'OFFER_ACCEPTED', to: 'JOINED', roles: ['EMPLOYER'] },

  /*
   * --- Employer-driven corrections --------------------------------------------
   *
   * Product decision (confirmed by the team): these three regressions were
   * admin-only in the original design, but Admin's mutation routes are gone
   * and Admin is read-only for hiring decisions end to end — nobody else was
   * ever assigned them, which left them structurally unreachable. The
   * employer is the party who actually made the forward move in each case
   * (moved someone to review, shortlisted them, booked the interview), so
   * they are also the right party to undo a mis-click. This does not touch
   * the NOT_SELECTED reversal below — that stays admin-only and 24-hour-
   * windowed; the team's decision there is a warning before rejecting, not a
   * new self-service undo.
   */
  { from: 'UNDER_REVIEW', to: 'APPLIED', roles: ['EMPLOYER'] },
  { from: 'SHORTLISTED', to: 'UNDER_REVIEW', roles: ['EMPLOYER'] },
  { from: 'INTERVIEW_SCHEDULED', to: 'SHORTLISTED', roles: ['EMPLOYER'] },

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

  /*
   * Terminal stages are terminal for everyone.
   *
   * JOINED is BK's billing event and OFFER_DECLINED closes the loop on an
   * offer; neither is a state anyone gets to leave by ordinary means. This
   * guard exists because the constant did not previously guard anything — it
   * was declared, documented, and referenced nowhere, while a candidate could
   * withdraw from JOINED and then re-apply, erasing the record of their own
   * placement. If a genuine correction is needed it is a data fix with a
   * reason attached, not a self-service button.
   */
  if ((TERMINAL_STAGES as readonly string[]).includes(from)) {
    return {
      allowed: false,
      reason: `This application is closed at ${from} and cannot be changed.`,
    };
  }

  /*
   * A candidate withdrawing follows the table like everything else.
   *
   * There was a short-circuit here that allowed withdrawal from ANY stage,
   * added to stop the NOT_SELECTED branch below answering a withdrawal with
   * "only an admin can reopen a rejected application". It fixed the message
   * and broke the rules: combined with the sanctioned WITHDRAWN → APPLIED
   * re-apply, it gave a two-step escape out of every terminal and rejected
   * state. The branch below is scoped instead, which was the actual fix.
   */
  if (from === 'NOT_SELECTED' && to !== 'WITHDRAWN') {
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

/**
 * What the candidate is actually TOLD at each stage.
 *
 * CANDIDATE_STAGE_LABEL exists to position the five contract steps on the
 * progress bar, so it correctly collapses the last five stages to "Decision".
 * That is fine for a progress bar and hopeless as a message: it left an offer
 * and a rejection distinguishable only by the colour of a badge, and only the
 * rejection had any explanatory copy at all.
 *
 * Telling somebody they have a job offer is the most important sentence this
 * product will ever render. It gets its own words.
 */
export interface CandidateStageMessage {
  readonly headline: string;
  readonly body: string;
  readonly tone: 'good' | 'bad' | 'neutral';
}

export const CANDIDATE_STAGE_MESSAGE: Partial<Record<ApplicationStage, CandidateStageMessage>> = {
  OFFER_MADE: {
    headline: 'You have an offer',
    body: 'The company has made you an offer for this role. Our team will walk you through the details and answer anything you want to ask before you decide.',
    tone: 'good',
  },
  OFFER_ACCEPTED: {
    headline: 'Offer accepted',
    body: 'You have accepted this offer. Our team will stay with you through notice period and joining.',
    tone: 'good',
  },
  OFFER_DECLINED: {
    headline: 'Offer declined',
    body: 'You turned this one down. We will keep looking for the right fit.',
    tone: 'neutral',
  },
  JOINED: {
    headline: 'You joined',
    body: 'Congratulations. Do get in touch if we can help again.',
    tone: 'good',
  },
  NOT_SELECTED: {
    headline: 'Not taken forward',
    body: 'This one did not work out. Our team keeps your profile in front of other employers.',
    tone: 'bad',
  },
  /*
   * INTERVIEW_SCHEDULED is deliberately absent: the tracker renders a full
   * interview panel for that stage, with the time, place and a confirm
   * button. A second alert saying the same thing is noise.
   */
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
