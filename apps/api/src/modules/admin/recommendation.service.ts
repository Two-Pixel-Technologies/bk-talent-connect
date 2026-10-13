/**
 * Admin recommendations and interview coordination.
 *
 * Recommendation is the single feature that makes this a managed portal rather
 * than a job board: BK puts a candidate in front of an employer for a role the
 * candidate never applied to.
 *
 * That also makes it the most sensitive thing in the product. It shares a
 * person's profile — and, under D1, their CV — with a company they did not
 * choose. So it is gated on the consent captured at registration, the candidate
 * is told it happened, and they can withdraw.
 *
 * Plan reference: HIGH-15, BLOCKER-3.
 */


import { canTransition, type ApplicationStage, type Role } from '@bktc/shared';
import { transaction } from '../../repositories/tx.js';
import * as applicationRepo from '../../repositories/application.repo.js';
import * as candidateRepo from '../../repositories/candidate.repo.js';
import * as jobRepo from '../../repositories/job.repo.js';
import * as interviewRepo from '../../repositories/interview.repo.js';
import * as auditRepo from '../../repositories/audit.repo.js';
import * as userRepo from '../../repositories/user.repo.js';
import * as events from '../notification/notification-events.js';
import { badRequest, conflict, forbidden, notFound } from '../../lib/errors.js';

export type RecommendResult = {
  readonly applicationId: string;
  readonly alreadyExisted: boolean;
};

/**
 * Puts a candidate forward for a role.
 *
 * Idempotent: recommending someone twice flags the existing application rather
 * than creating a second one, which the unique constraint would reject anyway.
 */
export function recommend(jobId: string, candidateProfileId: string, actorId: string, ip?: string): RecommendResult {
  const job = jobRepo.findById(jobId);
  if (!job) throw notFound('Job posting not found.');
  if (job.status !== 'APPROVED') {
    throw badRequest('That role is not live. Approve the posting before recommending anyone for it.');
  }

  const profile = candidateRepo.findById(candidateProfileId);
  if (!profile) throw notFound('Candidate not found.');
  if (profile.profile_status !== 'APPROVED') {
    throw badRequest('Approve this candidate’s profile before putting them forward.');
  }

  /*
   * The account has to be live, not just the profile approved.
   *
   * The candidate SEARCH filters on user.status = 'ACTIVE'; the endpoint that
   * acts on the result did not. So a suspended person was invisible in the
   * picker and could still be recommended by id — put in front of an employer
   * as "Recommended by Us", and sent a notification on an account they can no
   * longer sign in to.
   */
  const candidateUser = userRepo.findById(profile.user_id);
  if (!candidateUser || candidateUser.status !== 'ACTIVE') {
    throw badRequest('That candidate’s account is not active, so they cannot be put forward.');
  }

  /**
   * The consent gate.
   *
   * Registration captures explicit, versioned consent to us sharing a profile
   * with employers on the candidate's behalf. Without it, recommending is
   * processing we have no basis for — and in narrow industrial sectors, a
   * candidate discovered being put forward to their own employer is a serious
   * incident, not a paperwork issue.
   */
  if (!profile.consented_at) {
    throw forbidden(
      'This candidate has not consented to being put forward. Ask them to accept it on their profile first.',
    );
  }

  return transaction(() => {
    const existing = applicationRepo.findByJobAndCandidate(jobId, candidateProfileId);

    if (existing) {
      /*
       * A candidate who stepped back out is not re-recommendable.
       *
       * This used to return a cheerful `alreadyExisted: true` and change
       * nothing: the application stayed WITHDRAWN, the employer still could
       * not see them, and the admin was told it had worked. Worse, quietly
       * re-recommending someone who declined would override the decision the
       * consent model exists to protect.
       */
      if (existing.stage === 'WITHDRAWN') {
        throw conflict(
          'This candidate stepped back from this role. Speak to them before putting them forward again.',
        );
      }

      if (existing.is_recommended === 1) {
        return { applicationId: existing.id, alreadyExisted: true };
      }
      // They applied on their own and we are now endorsing them — same row,
      // now carrying the badge.
      applicationRepo.markRecommended(existing.id, actorId);
      applicationRepo.recordStageEvent({
        applicationId: existing.id,
        fromStage: existing.stage,
        toStage: existing.stage,
        changedById: actorId,
        changedByRole: 'ADMIN',
        note: 'Recommended by BK Talent Connect',
      });
      events.candidateRecommended(existing.id);
      return { applicationId: existing.id, alreadyExisted: true };
    }

    const applicationId = applicationRepo.create({
      jobId,
      candidateProfileId,
      source: 'ADMIN_RECOMMENDED',
      resumeFileId: profile.resume_file_id,
      recommendedById: actorId,
    });

    applicationRepo.recordStageEvent({
      applicationId,
      fromStage: null,
      toStage: 'APPLIED',
      changedById: actorId,
      changedByRole: 'ADMIN',
      note: 'Put forward by BK Talent Connect',
    });

    auditRepo.record({
      actorId,
      action: 'CANDIDATE_RECOMMENDED',
      entityType: 'JOB',
      entityId: jobId,
      metadata: { toStatus: 'APPLIED' },
      ipAddress: ip,
    });

    // The candidate learns their profile went to a company they did not pick.
    // Inside the transaction: if the recommendation rolls back, so does the
    // message saying it happened.
    events.candidateRecommended(applicationId);

    return { applicationId, alreadyExisted: false };
  });
}

// ---------------------------------------------------------------------------
// Interviews
// ---------------------------------------------------------------------------

export interface ScheduleInput {
  readonly applicationId: string;
  readonly scheduledAt: string;
  readonly durationMinutes: number;
  readonly mode: 'PHONE' | 'VIDEO' | 'ONSITE';
  readonly locationOrLink: string;
  readonly instructions?: string | undefined;
  readonly actorId: string;
  /** Who is booking it — the employer in production now; kept generic rather
   *  than hardcoded so this function does not need to change again if that
   *  ever does. */
  readonly role: Role;
}

/**
 * Books an interview and moves the application to INTERVIEW_SCHEDULED.
 *
 * Rescheduling supersedes the previous row rather than mutating it, so the
 * original time survives — otherwise "we moved it twice" is unanswerable.
 */
export function scheduleInterview(input: ScheduleInput): { interviewId: string; rescheduled: boolean } {
  const application = applicationRepo.findById(input.applicationId);
  if (!application) throw notFound('Application not found.');

  /*
   * Legality is the matrix's decision, not this function's.
   *
   * This used to write the stage directly, which meant an interview could be
   * booked from ANY stage — including one the candidate had already withdrawn
   * from, sending them a confirmation for a process they had opted out of.
   * The guard on the plain stage route caught nothing, because scheduling is
   * the door people actually use.
   *
   * A reschedule leaves the stage alone, so it needs no check.
   */
  const from = application.stage as ApplicationStage;
  if (from !== 'INTERVIEW_SCHEDULED') {
    const check = canTransition(from, 'INTERVIEW_SCHEDULED', input.role, {
      stageChangedAt: new Date(application.last_stage_change_at),
    });
    if (!check.allowed) {
      throw badRequest(
        check.reason ?? 'An interview cannot be arranged for this application at its current stage.',
      );
    }
  }

  const when = new Date(input.scheduledAt);
  if (Number.isNaN(when.getTime())) throw badRequest('That date and time is not valid.');
  // An interview in the past is always a mistake, and the failure mode is a
  // candidate travelling for a slot that already passed.
  if (when.getTime() < Date.now() + 60 * 60 * 1000) {
    throw badRequest('Pick a time at least an hour from now.');
  }

  return transaction(() => {
    const existing = interviewRepo.findScheduled(input.applicationId);

    // Free the partial unique index BEFORE inserting the replacement — only one
    // SCHEDULED interview per application may exist at a time.
    if (existing) interviewRepo.setStatus(existing.id, 'RESCHEDULED');

    const interviewId = interviewRepo.create({
      applicationId: input.applicationId,
      scheduledAt: when.toISOString(),
      durationMinutes: input.durationMinutes,
      mode: input.mode,
      locationOrLink: input.locationOrLink,
      instructions: input.instructions,
      createdById: input.actorId,
    });

    // Now the replacement exists, link the old row to it.
    if (existing) interviewRepo.setSupersededBy(existing.id, interviewId);

    // Only move the stage on the first booking — a reschedule leaves it where
    // it is.
    if (application.stage !== 'INTERVIEW_SCHEDULED') {
      const moved = applicationRepo.setStage(
        input.applicationId,
        'INTERVIEW_SCHEDULED',
        application.stage as never,
      );
      if (!moved) throw conflict('This application has already moved on. Refresh and try again.');

      applicationRepo.recordStageEvent({
        applicationId: input.applicationId,
        fromStage: application.stage,
        toStage: 'INTERVIEW_SCHEDULED',
        changedById: input.actorId,
        changedByRole: input.role,
        note: 'Interview arranged',
      });
    }

    interviewRepo.resolveRequestsFor(input.applicationId, 'ARRANGED');

    events.interviewConfirmed({
      applicationId: input.applicationId,
      interviewId,
      scheduledAt: when.toISOString(),
      rescheduled: existing !== undefined,
    });

    return { interviewId, rescheduled: existing !== undefined };
  });
}

export function cancelInterview(interviewId: string, actorId: string, role: Role): void {
  const interview = interviewRepo.findById(interviewId);
  if (!interview) throw notFound('Interview not found.');

  const application = applicationRepo.findById(interview.application_id);

  transaction(() => {
    const cancelled = interviewRepo.setStatus(interviewId, 'CANCELLED');
    if (!cancelled) throw conflict('That interview is no longer scheduled.');

    applicationRepo.recordStageEvent({
      applicationId: interview.application_id,
      // The application's real stage, not a hardcoded guess. An interview can
      // be cancelled after the stage has moved on, and writing a fromStage
      // that never happened corrupts the timeline both parties read.
      fromStage: application?.stage ?? 'INTERVIEW_SCHEDULED',
      toStage: application?.stage ?? 'INTERVIEW_SCHEDULED',
      changedById: actorId,
      changedByRole: role,
      note: 'Interview cancelled',
    });

    /*
     * Both parties were told the interview was confirmed, with a date and a
     * place. Cancelling it in silence is how somebody travels to a factory
     * gate on the wrong day — and coordination is the one thing this product
     * exists to do.
     */
    events.interviewCancelled({
      applicationId: interview.application_id,
      interviewId,
      scheduledAt: interview.scheduled_at,
      actorId,
    });
  });
}

/** Marks the interview done and advances the application. */
export function completeInterview(interviewId: string, actorId: string, role: Role): void {
  const interview = interviewRepo.findById(interviewId);
  if (!interview) throw notFound('Interview not found.');

  const application = applicationRepo.findById(interview.application_id);
  if (!application) throw notFound('Application not found.');

  /*
   * Legality is the matrix's decision here too — matching scheduleInterview.
   * Without this check, completing was gated only by the route's role
   * middleware, which is correct for who the route accepts but says nothing
   * about whether THIS transition (INTERVIEW_SCHEDULED -> INTERVIEWED) is one
   * that role may make from the application's actual current stage.
   */
  if (application.stage === 'INTERVIEW_SCHEDULED') {
    const check = canTransition('INTERVIEW_SCHEDULED', 'INTERVIEWED', role, {
      stageChangedAt: new Date(application.last_stage_change_at),
    });
    if (!check.allowed) {
      throw badRequest(check.reason ?? 'That change is not allowed.');
    }
  }

  transaction(() => {
    /*
     * setStatus only matches rows still SCHEDULED, and its return value used
     * to be discarded — so "complete" succeeded on an interview that had been
     * cancelled, recording a meeting that never happened and advancing the
     * application to INTERVIEWED, from which an offer could be made.
     */
    if (!interviewRepo.setStatus(interviewId, 'COMPLETED')) {
      throw conflict('That interview is no longer scheduled, so it cannot be marked as held.');
    }

    if (application.stage === 'INTERVIEW_SCHEDULED') {
      applicationRepo.setStage(application.id, 'INTERVIEWED', 'INTERVIEW_SCHEDULED');
      applicationRepo.recordStageEvent({
        applicationId: application.id,
        fromStage: 'INTERVIEW_SCHEDULED',
        toStage: 'INTERVIEWED',
        changedById: actorId,
        changedByRole: role,
        note: 'Interview completed',
      });
    }
  });
}

// ---------------------------------------------------------------------------
// Employer interview requests
// ---------------------------------------------------------------------------

/**
 * The employer asking to meet someone.
 *
 * They cannot book it themselves — BK coordinates with both sides — but before
 * this their only way to signal interest was to shortlist and hope.
 */
/** Stages at which an employer may still ask to meet someone. */
const REQUESTABLE_STAGES = [
  'APPLIED',
  'UNDER_REVIEW',
  'SHORTLISTED',
  'INTERVIEW_SCHEDULED',
  'INTERVIEWED',
] as const satisfies readonly ApplicationStage[];

export function requestInterview(input: {
  readonly applicationId: string;
  readonly requestedById: string;
  readonly preferredSlots: readonly string[];
  readonly note?: string | undefined;
}): string {
  const application = applicationRepo.findById(input.applicationId);
  if (!application) throw notFound('Application not found.');

  /*
   * Only for applications that are actually live.
   *
   * Without this an employer can request a meeting with someone who withdrew
   * or was turned down, and it lands on BK's coordination screen as real work.
   * For a withdrawal it is a request to arrange contact the candidate
   * explicitly opted out of, which is exactly what the consent model is meant
   * to prevent.
   */
  if (!(REQUESTABLE_STAGES as readonly string[]).includes(application.stage)) {
    throw badRequest(
      application.stage === 'WITHDRAWN'
        ? 'This candidate has withdrawn from the role, so we cannot arrange a meeting.'
        : 'This application is closed, so an interview cannot be arranged for it.',
    );
  }

  if (interviewRepo.findOpenRequest(input.applicationId)) {
    throw conflict('You have already asked us to arrange an interview for this candidate.');
  }

  const requestId = interviewRepo.createRequest(input);

  applicationRepo.recordStageEvent({
    applicationId: input.applicationId,
    fromStage: application.stage,
    toStage: application.stage,
    changedById: input.requestedById,
    changedByRole: 'EMPLOYER',
    note: 'Employer asked us to arrange an interview',
  });

  // The request only means anything if BK sees it — this is the notification
  // that turns it into work on the coordination screen.
  events.employerRequestedInterview(input.applicationId);

  return requestId;
}
