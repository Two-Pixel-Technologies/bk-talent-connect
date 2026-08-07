/**
 * Application and pipeline use cases.
 */

import {
  canTransition,
  type ApplicationStage,
  type Role,
} from '@bktc/shared';
import { transaction } from '../../repositories/tx.js';
import * as applicationRepo from '../../repositories/application.repo.js';
import * as candidateRepo from '../../repositories/candidate.repo.js';
import * as jobRepo from '../../repositories/job.repo.js';
import * as interviewRepo from '../../repositories/interview.repo.js';
import * as events from '../notification/notification-events.js';
import { badRequest, conflict, forbidden, notFound } from '../../lib/errors.js';
import type { ApplicationRow, Row } from '../../db/rows.js';

/** Only an approved candidate may browse or apply. */
/**
 * Message per status.
 *
 * Telling a candidate who has never submitted that their profile "is still
 * being reviewed" leaves them waiting for something that will never happen —
 * and the same for one we have asked to make changes. Those two states need an
 * instruction, not reassurance.
 */
const GATE_MESSAGE: Record<string, string> = {
  DRAFT:
    'Finish your profile and submit it — roles open up as soon as our team approves it.',
  SUBMITTED:
    'Your profile is with our team. You will be able to browse roles once it is approved, usually within a working day.',
  CHANGES_REQUESTED:
    'We have asked for a few changes to your profile. Update it and resubmit, and roles will open up again.',
  REJECTED:
    'We were not able to approve your profile. Please contact the BK Talent Connect team.',
};

export function requireApprovedCandidate(userId: string) {
  const profile = candidateRepo.findByUserId(userId);
  if (!profile) throw notFound('Profile not found.');
  if (profile.profile_status !== 'APPROVED') {
    throw forbidden(GATE_MESSAGE[profile.profile_status] ?? GATE_MESSAGE.SUBMITTED!);
  }
  return profile;
}

/**
 * Applying to a job.
 *
 * The whole thing is one transaction, and the job's live status is re-checked
 * INSIDE it — a candidate holding a stale page could otherwise apply to a role
 * that was closed a moment ago. The stage event and the application row commit
 * together, so there is never an application with no history.
 */
export function apply(userId: string, jobId: string): { applicationId: string; reopened: boolean } {
  const profile = requireApprovedCandidate(userId);

  return transaction(() => {
    const job = jobRepo.findLiveById(jobId);
    if (!job) throw conflict('That role is no longer accepting applications.');

    const existing = applicationRepo.findByJobAndCandidate(jobId, profile.id);

    if (existing) {
      if (existing.stage !== 'WITHDRAWN') {
        throw conflict('You have already applied to this role.');
      }
      // Re-apply. The unique (job, candidate) constraint means withdrawing
      // would otherwise lock the candidate out of this role permanently.
      const reopened = applicationRepo.reopen(existing.id, profile.resume_file_id);
      if (!reopened) throw conflict('That application has already moved on.');

      applicationRepo.recordStageEvent({
        applicationId: existing.id,
        fromStage: 'WITHDRAWN',
        toStage: 'APPLIED',
        changedById: userId,
        changedByRole: 'CANDIDATE',
        note: 'Re-applied',
      });
      events.applicationSubmitted(existing.id);
      return { applicationId: existing.id, reopened: true };
    }

    const applicationId = applicationRepo.create({
      jobId,
      candidateProfileId: profile.id,
      source: 'APPLIED',
      resumeFileId: profile.resume_file_id,
    });

    applicationRepo.recordStageEvent({
      applicationId,
      fromStage: null,
      toStage: 'APPLIED',
      changedById: userId,
      changedByRole: 'CANDIDATE',
    });

    events.applicationSubmitted(applicationId);

    return { applicationId, reopened: false };
  });
}

export function getOwnApplication(userId: string, applicationId: string): Row<ApplicationRow> {
  const profile = candidateRepo.findByUserId(userId);
  if (!profile) throw notFound('Profile not found.');

  const application = applicationRepo.findById(applicationId);
  if (!application || application.candidate_profile_id !== profile.id) {
    throw forbidden('You do not have access to that application.');
  }
  return application;
}

/**
 * What a stage change means for a booked interview.
 *
 * Three outcomes, and the difference matters because two of them send
 * messages to real people:
 *
 *   INTERVIEW_SCHEDULED  the booking is the point of the stage — leave it.
 *   INTERVIEWED          the meeting happened. Close it out as COMPLETED,
 *                        silently; nobody needs telling about a meeting they
 *                        just attended.
 *   anything else        withdrawn, rejected, offered, joined, or regressed:
 *                        the booking is stale and both parties are told.
 *
 * Marking INTERVIEWED as completed rather than cancelled is what stops a
 * candidate being sent "your interview is cancelled" moments before being
 * sent "you have an offer".
 */
const INTERVIEW_KEPT_STAGE = 'INTERVIEW_SCHEDULED';
const INTERVIEW_COMPLETED_STAGE = 'INTERVIEWED';

export interface ChangeStageInput {
  readonly applicationId: string;
  readonly toStage: ApplicationStage;
  readonly role: Role;
  readonly actorId: string;
  readonly note?: string | undefined;
  readonly outcomeReasonCode?: string | undefined;
}

/**
 * The single place a stage changes.
 *
 * Legality is decided by canTransition() in packages/shared, which is generated
 * from the D4 matrix — the same table the tests are derived from. No route
 * hand-rolls its own rules.
 */
export function changeStage(input: ChangeStageInput): void {
  const application = applicationRepo.findById(input.applicationId);
  if (!application) throw notFound('Application not found.');

  const from = application.stage as ApplicationStage;

  const check = canTransition(from, input.toStage, input.role, {
    stageChangedAt: new Date(application.last_stage_change_at),
  });
  if (!check.allowed) throw badRequest(check.reason ?? 'That change is not allowed.');

  transaction(() => {
    const moved = applicationRepo.setStage(
      input.applicationId,
      input.toStage,
      from,
      input.outcomeReasonCode ?? null,
    );
    if (!moved) {
      throw conflict('This application has already moved on. Refresh and try again.');
    }

    applicationRepo.recordStageEvent({
      applicationId: input.applicationId,
      fromStage: from,
      toStage: input.toStage,
      changedById: input.actorId,
      changedByRole: input.role === 'CANDIDATE' ? 'CANDIDATE' : input.role === 'EMPLOYER' ? 'EMPLOYER' : 'ADMIN',
      note: input.note ?? null,
    });

    if (input.role === 'EMPLOYER') applicationRepo.markEmployerAction(input.applicationId);

    /*
     * An interview cannot outlive the application it belongs to.
     *
     * changeStage never touched the interview table, so withdrawing, being
     * rejected, or being moved back a stage all left a live SCHEDULED row.
     * Both parties kept seeing a confirmed meeting for a process that had
     * ended, BK's coordination screen kept listing it — including for JOINED
     * and for erased candidates — and the admin could not even reschedule to
     * clear it, because the application was no longer at a stage from which
     * an interview is legal.
     *
     * Moving forward through the pipeline keeps the interview; leaving the
     * interview stages, in either direction, ends it.
     */
    if (input.toStage === INTERVIEW_COMPLETED_STAGE) {
      const live = interviewRepo.findScheduled(input.applicationId);
      if (live) interviewRepo.setStatus(live.id, 'COMPLETED');
    } else if (input.toStage !== INTERVIEW_KEPT_STAGE) {
      const cancelled = interviewRepo.cancelScheduledFor(input.applicationId);
      if (cancelled) {
        events.interviewCancelled({
          applicationId: input.applicationId,
          interviewId: cancelled.id,
          scheduledAt: cancelled.scheduled_at,
          actorId: input.actorId,
        });
      }
    }

    /*
     * The only place a pipeline notification is raised.
     *
     * Inside the transaction, so a notification cannot outlive a stage change
     * that rolled back — a candidate reading "you have an offer" for an offer
     * that does not exist is worse than no notification at all. Which stages
     * actually produce one is decided by the p8 matrix, not here.
     */
    events.stageChanged({
      applicationId: input.applicationId,
      toStage: input.toStage,
      actorId: input.actorId,
      actorRole: input.role,
    });
  });
}

export function withdraw(userId: string, applicationId: string): void {
  const application = getOwnApplication(userId, applicationId);
  changeStage({
    applicationId: application.id,
    toStage: 'WITHDRAWN',
    role: 'CANDIDATE',
    actorId: userId,
  });
}

/**
 * Closing a job resolves its open applications rather than leaving candidates
 * watching a tracker that will never move again.
 *
 * Applications already at shortlist or beyond are left alone: those are live
 * conversations the BK team is running, and a closed posting does not
 * automatically end them.
 */
export function closeApplicationsForJob(jobId: string, actorId: string, reason: string): number {
  return transaction(() => {
    const closed = applicationRepo.closeOpenApplications(jobId, reason);
    for (const { id: applicationId, fromStage } of closed) {
      applicationRepo.recordStageEvent({
        applicationId,
        fromStage,
        toStage: 'NOT_SELECTED',
        changedById: actorId,
        changedByRole: 'SYSTEM',
        note: 'This role was closed.',
      });
    }

    events.applicationsClosedWithJob({
      applicationIds: closed.map((c) => c.id),
      jobId,
      actorId,
    });

    return closed.length;
  });
}

/**
 * Restores applications that a job closure auto-rejected.
 *
 * Scoped to JOB_CLOSED specifically: a candidate the employer turned down on
 * merit must stay turned down.
 */
export function restoreAutoClosedApplications(jobId: string, actorId: string): number {
  return transaction(() => {
    const restored = applicationRepo.restoreAutoClosed(jobId);
    for (const { id } of restored) {
      applicationRepo.recordStageEvent({
        applicationId: id,
        fromStage: 'NOT_SELECTED',
        toStage: 'APPLIED',
        changedById: actorId,
        changedByRole: 'SYSTEM',
        note: 'This role reopened.',
      });
    }
    return restored.length;
  });
}
