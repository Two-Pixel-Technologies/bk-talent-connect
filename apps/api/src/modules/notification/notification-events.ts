/**
 * Every notification the portal sends, and the words it uses.
 *
 * Copy lives here rather than at the call sites for two reasons. The first is
 * that BK will want to change the wording, and hunting it across nine services
 * guarantees an inconsistent voice. The second is the privacy rule: a
 * notification is the one place a fact escapes its serializer, so all of them
 * need to be readable in one screenful.
 *
 * Two rules hold across this whole file, and the P7 tests enforce both:
 *
 *   1. No salary figure appears in any notification, ever. Not the candidate's
 *      expectation, not the job's band, in either direction.
 *   2. Candidate-facing copy never names the employer. Candidate job views are
 *      anonymous by design (toCandidateView omits employer identity); a
 *      notification saying "Acme Ltd shortlisted you" would walk straight
 *      around that.
 */

import { CANDIDATE_STAGE_LABEL, formatDateTime, type ApplicationStage } from '@bktc/shared';
import { notify, notifyQuietly } from '../../lib/notify.js';
import * as applicationRepo from '../../repositories/application.repo.js';
import * as candidateRepo from '../../repositories/candidate.repo.js';
import * as employerRepo from '../../repositories/employer.repo.js';
import * as jobRepo from '../../repositories/job.repo.js';
import * as userRepo from '../../repositories/user.repo.js';
import { logger } from '../../lib/logger.js';

// ---------------------------------------------------------------------------
// Party resolution
// ---------------------------------------------------------------------------

interface ApplicationParties {
  readonly candidateUserId: string;
  readonly employerUserId: string;
  readonly candidateName: string;
  readonly companyName: string;
  readonly jobTitle: string;
  readonly jobId: string;
}

/**
 * The two humans behind an application.
 *
 * Returns undefined rather than throwing when something in the chain is
 * missing (a soft-deleted profile, say). The caller then skips the
 * notification: a stage change must not fail because we could not compose a
 * message about it.
 */
function partiesFor(applicationId: string): ApplicationParties | undefined {
  const application = applicationRepo.findById(applicationId);
  if (!application) return undefined;

  const profile = candidateRepo.findById(application.candidate_profile_id);
  const job = jobRepo.findById(application.job_id);
  if (!profile || !job) return undefined;

  const employer = employerRepo.findById(job.employer_profile_id);
  if (!employer) return undefined;

  return {
    candidateUserId: profile.user_id,
    employerUserId: employer.user_id,
    candidateName: profile.full_name,
    companyName: employer.company_name,
    jobTitle: job.title,
    jobId: job.id,
  };
}

// ---------------------------------------------------------------------------
// Registration and profile review
// ---------------------------------------------------------------------------

export function candidateRegistered(userId: string, profileId: string, fullName: string): void {
  // Quietly: an account must not fail to be created because a welcome message
  // could not be written.
  notifyQuietly({
    event: 'CANDIDATE_REGISTERED',
    parties: { CANDIDATE: userId },
    title: 'Welcome to BK Talent Connect',
    body: 'Complete your profile and submit it — roles open up as soon as our team approves it.',
    perRole: {
      ADMIN: {
        title: 'New candidate registered',
        body: `${fullName} has signed up. Their profile will appear in the review queue once they submit it.`,
      },
    },
    entityType: 'CANDIDATE',
    entityId: profileId,
  });
}

export function candidateProfileApproved(userId: string, profileId: string, actorId: string): void {
  notify({
    event: 'CANDIDATE_PROFILE_APPROVED',
    parties: { CANDIDATE: userId },
    title: 'Your profile is approved',
    body: 'You can now browse and apply to roles.',
    entityType: 'CANDIDATE',
    entityId: profileId,
    excludeUserId: actorId,
  });
}

export function candidateChangesRequested(
  userId: string,
  profileId: string,
  reason: string,
  actorId: string,
): void {
  notify({
    event: 'CANDIDATE_PROFILE_CHANGES_REQUESTED',
    parties: { CANDIDATE: userId },
    title: 'We have asked for a few changes',
    // The reviewer's words verbatim. A paraphrase would be a second, worse
    // explanation of something they already explained.
    body: reason,
    entityType: 'CANDIDATE',
    entityId: profileId,
    excludeUserId: actorId,
  });
}

export function employerAccountApproved(userId: string, profileId: string, actorId: string): void {
  notify({
    event: 'EMPLOYER_ACCOUNT_APPROVED',
    parties: { EMPLOYER: userId },
    title: 'Your company account is verified',
    body: 'You can post roles now. Every posting is reviewed by our team before it goes live.',
    entityType: 'EMPLOYER',
    entityId: profileId,
    excludeUserId: actorId,
  });
}

// ---------------------------------------------------------------------------
// Jobs
// ---------------------------------------------------------------------------

export function jobSubmitted(input: {
  readonly employerUserId: string;
  readonly jobId: string;
  readonly jobTitle: string;
  readonly companyName: string;
}): void {
  notify({
    event: 'JOB_SUBMITTED',
    parties: { EMPLOYER: input.employerUserId },
    title: `“${input.jobTitle}” is with our team`,
    body: 'We review postings before they go live, usually within a working day.',
    perRole: {
      ADMIN: {
        title: 'New posting to review',
        body: `${input.jobTitle} — ${input.companyName}.`,
      },
    },
    entityType: 'JOB',
    entityId: input.jobId,
  });
}

export function jobApproved(
  employerUserId: string,
  jobId: string,
  jobTitle: string,
  actorId: string,
): void {
  notify({
    event: 'JOB_APPROVED',
    parties: { EMPLOYER: employerUserId },
    title: `“${jobTitle}” is live`,
    body: 'Approved candidates can see and apply to it now.',
    entityType: 'JOB',
    entityId: jobId,
    excludeUserId: actorId,
  });
}

export function jobSentBack(
  employerUserId: string,
  jobId: string,
  jobTitle: string,
  reason: string,
  actorId: string,
): void {
  notify({
    event: 'JOB_SENT_BACK',
    parties: { EMPLOYER: employerUserId },
    title: `“${jobTitle}” needs changes`,
    body: reason,
    entityType: 'JOB',
    entityId: jobId,
    excludeUserId: actorId,
  });
}

// ---------------------------------------------------------------------------
// Applications and pipeline
// ---------------------------------------------------------------------------

export function applicationSubmitted(applicationId: string): void {
  const p = partiesFor(applicationId);
  if (!p) return;

  notify({
    event: 'APPLICATION_SUBMITTED',
    parties: { CANDIDATE: p.candidateUserId },
    title: 'Application received',
    // No company name: the role is anonymous to the candidate until shortlist.
    body: `We have your application for ${p.jobTitle}. You can follow its progress on your tracker.`,
    perRole: {
      ADMIN: {
        title: 'New application',
        body: `${p.candidateName} applied to ${p.jobTitle} at ${p.companyName}.`,
      },
    },
    entityType: 'APPLICATION',
    entityId: applicationId,
  });
}

/**
 * Stage changes that the p8 matrix gives a notification.
 *
 * Called from the one place a stage moves, so a new caller cannot forget it.
 * Stages the matrix is silent about produce nothing — that silence is a
 * decision recorded in the matrix, not an omission here.
 */
export function stageChanged(input: {
  readonly applicationId: string;
  readonly toStage: ApplicationStage;
  readonly actorId: string;
  readonly actorRole: 'CANDIDATE' | 'EMPLOYER' | 'ADMIN' | 'SYSTEM';
}): void {
  const p = partiesFor(input.applicationId);
  if (!p) return;

  try {
    switch (input.toStage) {
      case 'SHORTLISTED':
        notify({
          event: 'CANDIDATE_SHORTLISTED',
          parties: { CANDIDATE: p.candidateUserId, EMPLOYER: p.employerUserId },
          title: 'You have been shortlisted',
          body: `Your application for ${p.jobTitle} has been shortlisted. Our team will be in touch about next steps.`,
          perRole: {
            EMPLOYER: {
              title: `${p.candidateName} shortlisted`,
              body: `${p.jobTitle}. Ask us to arrange an interview when you are ready.`,
            },
          },
          entityType: 'APPLICATION',
          entityId: input.applicationId,
          excludeUserId: input.actorId,
        });
        break;

      case 'OFFER_MADE':
        notify({
          event: 'OFFER_MADE',
          parties: { CANDIDATE: p.candidateUserId },
          title: 'You have an offer',
          body: `An offer has been made for ${p.jobTitle}. Our team will walk you through it.`,
          perRole: {
            ADMIN: {
              title: `Offer made to ${p.candidateName}`,
              body: `${p.jobTitle} at ${p.companyName}.`,
            },
          },
          entityType: 'APPLICATION',
          entityId: input.applicationId,
          excludeUserId: input.actorId,
        });
        break;

      case 'NOT_SELECTED':
        notify({
          event: 'CANDIDATE_NOT_SELECTED',
          parties: { CANDIDATE: p.candidateUserId },
          title: 'Update on your application',
          body: `Your application for ${p.jobTitle} is not being taken forward. Other roles are open to you.`,
          perRole: {
            ADMIN: {
              title: `${p.candidateName} not taken forward`,
              body: `${p.jobTitle} at ${p.companyName}.`,
            },
          },
          entityType: 'APPLICATION',
          entityId: input.applicationId,
          excludeUserId: input.actorId,
        });
        break;

      // The candidate's own decision on an offer — the employer who made it
      // needs to know which way it went.
      case 'OFFER_ACCEPTED':
        notify({
          event: 'OFFER_ACCEPTED',
          parties: { EMPLOYER: p.employerUserId },
          title: `${p.candidateName} accepted the offer`,
          body: `${p.jobTitle}.`,
          perRole: {
            ADMIN: {
              title: `${p.candidateName} accepted an offer`,
              body: `${p.jobTitle} at ${p.companyName}.`,
            },
          },
          entityType: 'APPLICATION',
          entityId: input.applicationId,
          excludeUserId: input.actorId,
        });
        break;

      case 'OFFER_DECLINED':
        notify({
          event: 'OFFER_DECLINED',
          parties: { EMPLOYER: p.employerUserId },
          title: `${p.candidateName} declined the offer`,
          body: `${p.jobTitle}.`,
          perRole: {
            ADMIN: {
              title: `${p.candidateName} declined an offer`,
              body: `${p.jobTitle} at ${p.companyName}.`,
            },
          },
          entityType: 'APPLICATION',
          entityId: input.applicationId,
          excludeUserId: input.actorId,
        });
        break;

      // The employer confirming joining — the candidate is told it was
      // recorded.
      case 'JOINED':
        notify({
          event: 'CANDIDATE_JOINED',
          parties: { CANDIDATE: p.candidateUserId },
          title: 'Your joining has been recorded',
          // Candidate job views are anonymous by design — never name the
          // employer in a candidate-facing notification body.
          body: `${p.jobTitle}. Congratulations, and do get in touch if we can help again.`,
          perRole: {
            ADMIN: {
              title: `${p.candidateName} joined`,
              body: `${p.jobTitle} at ${p.companyName}.`,
            },
          },
          entityType: 'APPLICATION',
          entityId: input.applicationId,
          excludeUserId: input.actorId,
        });
        break;

      default:
        break;
    }

    /*
     * Proposal p6: "Admin is notified immediately on every employer action in
     * the pipeline." The employer is the one party BK cannot see acting in
     * real time, so this is how the managed model stays managed.
     */
    if (input.actorRole === 'EMPLOYER') {
      notify({
        event: 'EMPLOYER_PIPELINE_ACTION',
        parties: {},
        title: `${p.companyName} moved a candidate to ${CANDIDATE_STAGE_LABEL[input.toStage]}`,
        body: `${p.candidateName} — ${p.jobTitle}.`,
        entityType: 'APPLICATION',
        entityId: input.applicationId,
      });
    }
  } catch (error) {
    // A stage change is the record of a real decision. It stands even if we
    // could not tell anyone about it; the log is how that gets noticed.
    logger.error({ err: error, applicationId: input.applicationId }, 'stage notification failed');
  }
}

/**
 * A posting closing, which turns down every pending applicant at once.
 *
 * Each candidate is told individually — their process just ended and the
 * tracker moving with no explanation is exactly the silence this portal is
 * meant to replace. The admin team gets one summary row rather than one per
 * applicant; see omitAdminFanOut in lib/notify.ts.
 */
export function applicationsClosedWithJob(input: {
  readonly applicationIds: readonly string[];
  readonly jobId: string;
  readonly actorId: string;
}): void {
  if (input.applicationIds.length === 0) return;

  let jobTitle = 'a role';
  let companyName = 'A company';

  for (const applicationId of input.applicationIds) {
    const p = partiesFor(applicationId);
    if (!p) continue;
    jobTitle = p.jobTitle;
    companyName = p.companyName;

    notify({
      event: 'CANDIDATE_NOT_SELECTED',
      parties: { CANDIDATE: p.candidateUserId },
      omitAdminFanOut: true,
      title: 'A role you applied to has closed',
      body: `${p.jobTitle} is no longer accepting applications, so your application has been closed. Other roles are open to you.`,
      entityType: 'APPLICATION',
      entityId: applicationId,
    });
  }

  const actor = userRepo.findById(input.actorId);
  if (actor?.role === 'EMPLOYER') {
    notify({
      event: 'EMPLOYER_PIPELINE_ACTION',
      parties: {},
      title: `${companyName} closed “${jobTitle}”`,
      body: `${input.applicationIds.length} pending application${
        input.applicationIds.length === 1 ? ' was' : 's were'
      } closed with it.`,
      entityType: 'JOB',
      entityId: input.jobId,
    });
  }
}

// ---------------------------------------------------------------------------
// Recommendations and interviews
// ---------------------------------------------------------------------------

export function candidateRecommended(applicationId: string): void {
  const p = partiesFor(applicationId);
  if (!p) return;

  notify({
    event: 'CANDIDATE_RECOMMENDED',
    parties: { CANDIDATE: p.candidateUserId },
    title: 'We have put you forward for a role',
    /*
     * Not in the p8 matrix — added because being recommended shares this
     * person's profile and CV with a company they never chose. Telling them is
     * the DPDP position and, separately, the moment the managed service proves
     * it is doing something for them.
     */
    body: `Our team recommended you for ${p.jobTitle}. If it is not for you, you can decline from your applications.`,
    entityType: 'APPLICATION',
    entityId: applicationId,
  });
}

export function interviewConfirmed(input: {
  readonly applicationId: string;
  readonly interviewId: string;
  readonly scheduledAt: string;
  readonly rescheduled: boolean;
}): void {
  const p = partiesFor(input.applicationId);
  if (!p) return;

  const when = formatDateTime(input.scheduledAt);

  notify({
    event: 'INTERVIEW_CONFIRMED',
    parties: { CANDIDATE: p.candidateUserId, EMPLOYER: p.employerUserId },
    title: input.rescheduled ? 'Interview moved' : 'Interview confirmed',
    // Both sides get the same time string, in IST with the suffix. A time that
    // reads differently to the two parties is how somebody misses an interview.
    body: `${p.jobTitle} — ${when}. Full details are on your interview page.`,
    perRole: {
      EMPLOYER: {
        title: input.rescheduled ? 'Interview moved' : 'Interview confirmed',
        body: `${p.candidateName} for ${p.jobTitle} — ${when}.`,
      },
    },
    entityType: 'INTERVIEW',
    entityId: input.interviewId,
  });
}

/**
 * The 24-hour-before reminder — p8's one row with no Portal column (see
 * NOTIFICATION_MATRIX's INTERVIEW_REMINDER entry), so notify() writes no
 * bell row here, only the email/WhatsApp dispatch.
 *
 * Called only from the sweep in lib/interview-reminder-sweep.ts, once per
 * interview, on an interview row already atomically claimed via
 * interview.repo.ts's claimDueReminders — this function itself does not
 * re-check reminder_sent_at, so it must never be called outside that path.
 */
export function interviewReminder(input: {
  readonly applicationId: string;
  readonly interviewId: string;
  readonly scheduledAt: string;
}): void {
  const p = partiesFor(input.applicationId);
  if (!p) return;

  const when = formatDateTime(input.scheduledAt);

  notify({
    event: 'INTERVIEW_REMINDER',
    parties: { CANDIDATE: p.candidateUserId, EMPLOYER: p.employerUserId },
    title: 'Interview tomorrow',
    body: `${p.jobTitle} — ${when}. Full details are on your interview page.`,
    perRole: {
      EMPLOYER: {
        title: 'Interview tomorrow',
        body: `${p.candidateName} for ${p.jobTitle} — ${when}.`,
      },
    },
    entityType: 'INTERVIEW',
    entityId: input.interviewId,
  });
}

/**
 * The interview is off.
 *
 * Uses the same INTERVIEW_CONFIRMED row of the matrix, because it is the same
 * fact being corrected and the same two people need it. An interview that is
 * announced loudly and cancelled silently is worse than one never arranged.
 */
export function interviewCancelled(input: {
  readonly applicationId: string;
  readonly interviewId: string;
  readonly scheduledAt: string;
  readonly actorId: string;
}): void {
  const p = partiesFor(input.applicationId);
  if (!p) return;

  const when = formatDateTime(input.scheduledAt);

  notify({
    event: 'INTERVIEW_CONFIRMED',
    parties: { CANDIDATE: p.candidateUserId, EMPLOYER: p.employerUserId },
    title: 'Interview cancelled',
    body: `The interview for ${p.jobTitle} on ${when} is no longer going ahead. Our team will be in touch about next steps.`,
    perRole: {
      EMPLOYER: {
        title: 'Interview cancelled',
        body: `${p.candidateName} for ${p.jobTitle} — ${when} is cancelled. We will come back to you with alternatives.`,
      },
    },
    entityType: 'INTERVIEW',
    entityId: input.interviewId,
    excludeUserId: input.actorId,
  });
}

export function employerRequestedInterview(applicationId: string): void {
  const p = partiesFor(applicationId);
  if (!p) return;

  notify({
    event: 'EMPLOYER_INTERVIEW_REQUESTED',
    parties: {},
    title: `${p.companyName} wants to interview ${p.candidateName}`,
    body: `${p.jobTitle}. Their preferred slots are on the coordination screen.`,
    entityType: 'APPLICATION',
    entityId: applicationId,
  });
}
