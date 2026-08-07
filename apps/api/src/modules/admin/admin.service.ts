/**
 * Admin review use cases.
 */

import { randomBytes } from 'node:crypto';
import { nowIso, rupeesToLpa } from '@bktc/shared';
import { transaction } from '../../repositories/tx.js';
import * as adminRepo from '../../repositories/admin.repo.js';
import * as auditRepo from '../../repositories/audit.repo.js';
import * as candidateRepo from '../../repositories/candidate.repo.js';
import * as employerRepo from '../../repositories/employer.repo.js';
import * as jobRepo from '../../repositories/job.repo.js';
import * as userRepo from '../../repositories/user.repo.js';
import * as sessionRepo from '../../repositories/session.repo.js';
import { hashPassword } from '../../lib/password.js';
import * as events from '../notification/notification-events.js';
import { badRequest, conflict, notFound } from '../../lib/errors.js';
import {
  closeApplicationsForJob,
  restoreAutoClosedApplications,
} from '../application/application.service.js';

export type ReviewDecision = 'APPROVE' | 'REQUEST_CHANGES' | 'REJECT';

export interface ReviewInput {
  readonly decision: ReviewDecision;
  readonly note?: string | undefined;
  /**
   * The status the reviewer was looking at when they decided.
   *
   * This is what makes the conditional update actually guard anything. An
   * earlier version listed every reviewable status in the WHERE clause, which
   * meant two admins acting at once BOTH matched — the first moved
   * SUBMITTED→APPROVED and the second happily moved APPROVED→REJECTED, so the
   * later click silently won. Checking against the status the admin actually
   * saw turns that into a 409 and a "refresh to see it" message.
   */
  readonly expectedStatus: string;
  readonly actorId: string;
  readonly ipAddress?: string | undefined;
}

/**
 * A rejection or a change request with no explanation is useless to the person
 * receiving it, so the reason is required by the API — not merely by the form,
 * which a direct API call would bypass.
 */
function requireReason(input: ReviewInput): string | null {
  if (input.decision === 'APPROVE') return input.note?.trim() || null;
  const note = input.note?.trim();
  if (!note || note.length < 5) {
    throw badRequest('Tell them what needs to change — this message is shown to the user.', [
      { path: 'note', message: 'Give a reason of at least 5 characters.' },
    ]);
  }
  return note;
}

const NEXT_STATUS: Record<ReviewDecision, string> = {
  APPROVE: 'APPROVED',
  REQUEST_CHANGES: 'CHANGES_REQUESTED',
  REJECT: 'REJECTED',
};

/** Statuses a record may legitimately be reviewed FROM. */
const REVIEWABLE = ['SUBMITTED', 'CHANGES_REQUESTED', 'REJECTED', 'APPROVED'];
const JOB_REVIEWABLE = ['PENDING_APPROVAL', 'CHANGES_REQUESTED', 'REJECTED', 'APPROVED'];

/**
 * Narrows the WHERE clause to the single status the reviewer saw, after
 * checking it is a status that can be reviewed at all.
 */
function expectedFrom(input: ReviewInput, allowed: readonly string[]): readonly string[] {
  if (!allowed.includes(input.expectedStatus)) {
    throw badRequest(`A record with status ${input.expectedStatus} cannot be reviewed.`);
  }
  return [input.expectedStatus];
}

export function reviewCandidate(profileId: string, input: ReviewInput): void {
  const profile = candidateRepo.findById(profileId);
  if (!profile) throw notFound('Candidate not found.');

  const note = requireReason(input);
  const next = NEXT_STATUS[input.decision];

  transaction(() => {
    const moved = adminRepo.reviewCandidate(
      profileId,
      next,
      expectedFrom(input, REVIEWABLE),
      input.actorId,
      note,
    );
    if (!moved) {
      throw conflict('This profile has already been reviewed by someone else. Refresh to see it.');
    }
    if (input.decision === 'APPROVE') adminRepo.snapshotCandidate(profileId);

    // p8: the candidate is told on approve and on changes-requested. A
    // rejection is a conversation the BK team has directly, not a bell.
    if (input.decision === 'APPROVE') {
      events.candidateProfileApproved(profile.user_id, profileId, input.actorId);
    } else if (input.decision === 'REQUEST_CHANGES' && note) {
      events.candidateChangesRequested(profile.user_id, profileId, note, input.actorId);
    }

    auditRepo.record({
      actorId: input.actorId,
      action: `CANDIDATE_${input.decision}`,
      entityType: 'CANDIDATE',
      entityId: profileId,
      // Statuses and the note only. No salary, no contact details.
      metadata: { fromStatus: profile.profile_status, toStatus: next, ...(note ? { reason: note } : {}) },
      ipAddress: input.ipAddress,
    });
  });
}

export function reviewEmployer(profileId: string, input: ReviewInput): void {
  const profile = employerRepo.findById(profileId);
  if (!profile) throw notFound('Company not found.');

  const note = requireReason(input);
  const next = NEXT_STATUS[input.decision];

  transaction(() => {
    const moved = adminRepo.reviewEmployer(
      profileId,
      next,
      expectedFrom(input, REVIEWABLE),
      input.actorId,
      note,
    );
    if (!moved) {
      throw conflict('This company has already been reviewed by someone else. Refresh to see it.');
    }

    if (input.decision === 'APPROVE') {
      events.employerAccountApproved(profile.user_id, profileId, input.actorId);
    }

    auditRepo.record({
      actorId: input.actorId,
      action: `EMPLOYER_${input.decision}`,
      entityType: 'EMPLOYER',
      entityId: profileId,
      metadata: { fromStatus: profile.account_status, toStatus: next, ...(note ? { reason: note } : {}) },
      ipAddress: input.ipAddress,
    });
  });
}

export function reviewJob(jobId: string, input: ReviewInput): void {
  const job = jobRepo.findById(jobId);
  if (!job) throw notFound('Job posting not found.');

  const note = requireReason(input);
  const next = NEXT_STATUS[input.decision];
  // Approval is what makes a posting publicly visible.
  const publishedAt = input.decision === 'APPROVE' ? (job.published_at ?? nowIso()) : null;

  transaction(() => {
    const moved = adminRepo.reviewJob(
      jobId,
      next,
      expectedFrom(input, JOB_REVIEWABLE),
      input.actorId,
      note,
      publishedAt,
    );
    if (!moved) {
      throw conflict('This posting has already been reviewed by someone else. Refresh to see it.');
    }

    const employer = employerRepo.findById(job.employer_profile_id);
    if (employer) {
      if (input.decision === 'APPROVE') {
        events.jobApproved(employer.user_id, jobId, job.title, input.actorId);
      } else if (note) {
        // Both REQUEST_CHANGES and REJECT reach the employer as "needs
        // changes" carrying the reviewer's reason — p8's "sent back with
        // admin comments" row.
        events.jobSentBack(employer.user_id, jobId, job.title, note, input.actorId);
      }
    }

    auditRepo.record({
      actorId: input.actorId,
      action: `JOB_${input.decision}`,
      entityType: 'JOB',
      entityId: jobId,
      metadata: { fromStatus: job.status, toStatus: next, ...(note ? { reason: note } : {}) },
      ipAddress: input.ipAddress,
    });
  });
}

/**
 * An admin-issued temporary password.
 *
 * There is no self-serve reset in Phase 1 — email is Phase 2 — and until now
 * there was no admin reset either, only a CLI script. That meant every
 * forgotten password on the platform, for a year of free support, required
 * Takai Labs to SSH into the droplet. It is the first thing that breaks after
 * launch and it looks amateurish to BK's own clients.
 *
 * The password is generated here rather than chosen by the admin, so nobody
 * sets "password123" for a user, and `mustChangePassword` forces it to be
 * replaced at next sign-in. Every other session is revoked: a reset is what
 * you do when an account may be compromised.
 */
export async function resetUserPassword(
  userId: string,
  actorId: string,
  ipAddress?: string,
): Promise<{ temporaryPassword: string }> {
  const user = userRepo.findById(userId);
  if (!user) throw notFound('User not found.');

  const temporaryPassword = generateTemporaryPassword();
  const passwordHash = await hashPassword(temporaryPassword);

  transaction(() => {
    userRepo.updatePassword(userId, passwordHash, true);
    sessionRepo.deleteAllForUser(userId);

    auditRepo.record({
      actorId,
      action: 'USER_PASSWORD_RESET',
      entityType: 'USER',
      entityId: userId,
      // Never the password, obviously — only that a reset happened.
      metadata: { toStatus: 'RESET' },
      ipAddress,
    });
  });

  return { temporaryPassword };
}

/**
 * Readable, unambiguous, and long enough.
 *
 * Excludes characters that are easily confused when read aloud over a phone
 * call, which is exactly how this password will be delivered.
 */
function generateTemporaryPassword(): string {
  const alphabet = 'abcdefghjkmnpqrstuvwxyz23456789';
  const bytes = randomBytes(16);
  const chars = [...bytes].map((b) => alphabet[b % alphabet.length]);
  return `${chars.slice(0, 4).join('')}-${chars.slice(4, 8).join('')}-${chars.slice(8, 12).join('')}`;
}

// ---------------------------------------------------------------------------
// Salary vs band
// ---------------------------------------------------------------------------

export type SalaryComparison = {
  readonly candidateExpectedMinLpa: number | null;
  readonly candidateExpectedMaxLpa: number | null;
  readonly candidateCurrentLpa: number | null;
  readonly jobBandMinLpa: number | null;
  readonly jobBandMaxLpa: number | null;
  /** 'WITHIN' | 'ABOVE' | 'BELOW' | 'UNKNOWN' */
  readonly fit: 'WITHIN' | 'ABOVE' | 'BELOW' | 'UNKNOWN';
  /** Gap in LPA between the candidate's minimum and the band's top. */
  readonly gapLpa: number | null;
};

/**
 * The highest-value screen the admin team has, and the one thing only they can
 * see: a candidate's expectations sit behind one privacy boundary and an
 * employer's band behind another, so nobody else can put the two side by side.
 *
 * Both figures are already stored, so this costs almost nothing to compute.
 */
export function compareSalary(candidateProfileId: string, jobId: string): SalaryComparison {
  const profile = candidateRepo.findById(candidateProfileId);
  const job = jobRepo.findById(jobId);
  if (!profile || !job) throw notFound('Not found.');

  const expectedMin = profile.expected_salary_min;
  const expectedMax = profile.expected_salary_max;
  const bandMin = job.salary_band_min;
  const bandMax = job.salary_band_max;

  let fit: SalaryComparison['fit'] = 'UNKNOWN';
  let gapLpa: number | null = null;

  if (expectedMin != null && bandMin != null && bandMax != null) {
    if (expectedMin > bandMax) {
      fit = 'ABOVE';
      gapLpa = rupeesToLpa(expectedMin - bandMax);
    } else if ((expectedMax ?? expectedMin) < bandMin) {
      fit = 'BELOW';
      gapLpa = rupeesToLpa(bandMin - (expectedMax ?? expectedMin));
    } else {
      fit = 'WITHIN';
      gapLpa = 0;
    }
  }

  return {
    candidateExpectedMinLpa: expectedMin == null ? null : rupeesToLpa(expectedMin),
    candidateExpectedMaxLpa: expectedMax == null ? null : rupeesToLpa(expectedMax),
    candidateCurrentLpa: profile.current_salary == null ? null : rupeesToLpa(profile.current_salary),
    jobBandMinLpa: bandMin == null ? null : rupeesToLpa(bandMin),
    jobBandMaxLpa: bandMax == null ? null : rupeesToLpa(bandMax),
    fit,
    gapLpa,
  };
}

// ---------------------------------------------------------------------------
// User administration
// ---------------------------------------------------------------------------

export function suspendUser(userId: string, actorId: string, ipAddress?: string): void {
  const user = userRepo.findById(userId);
  if (!user) throw notFound('User not found.');

  if (userId === actorId) throw badRequest('You cannot suspend your own account.');

  // Without this the platform can be locked out entirely: there is no self-serve
  // password reset in Phase 1, so recovery would mean SSH and a hand-generated
  // argon2 hash.
  if (user.role === 'ADMIN' && userRepo.countActiveAdmins(userId) === 0) {
    throw badRequest('That is the last active admin. Create another before suspending this one.');
  }

  if (!userRepo.setStatus(userId, 'SUSPENDED', 'ACTIVE')) {
    throw conflict('That account is already suspended.');
  }

  /**
   * Suspending an employer must take their roles down with them.
   *
   * Previously only the login was blocked, so their postings stayed live,
   * candidates kept applying, and nobody could action the result — the employer
   * was locked out and the applications piled up against a company BK had just
   * suspended.
   */
  let unpublishedJobs = 0;
  if (user.role === 'EMPLOYER') {
    const employer = employerRepo.findByUserId(userId);
    if (employer) {
      const jobIds = jobRepo.unpublishAllForEmployer(employer.id);
      unpublishedJobs = jobIds.length;
      for (const jobId of jobIds) {
        closeApplicationsForJob(jobId, actorId, 'JOB_CLOSED');
      }
    }
  }

  auditRepo.record({
    actorId,
    action: 'USER_SUSPEND',
    entityType: 'USER',
    entityId: userId,
    metadata: { fromStatus: 'ACTIVE', toStatus: 'SUSPENDED', count: unpublishedJobs },
    ipAddress,
  });
}

/**
 * Reactivating an employer undoes what suspending them did.
 *
 * Suspension is a routine, reversible moderation action — a payment dispute, a
 * complaint under investigation. It was not reversible: the cascade turned
 * down every pending applicant with reason JOB_CLOSED and set the postings to
 * PENDING_APPROVAL, while the only restore path required status CLOSED. So
 * reactivating gave the employer their login back and nothing else, and every
 * rejection became permanent once the 24-hour reversal window passed. BK had
 * no way to see what had been lost, and each candidate had been told a role
 * closed that never closed.
 */
export function reactivateUser(
  userId: string,
  actorId: string,
  ipAddress?: string,
): { restoredApplications: number } {
  const user = userRepo.findById(userId);
  if (!user) throw notFound('User not found.');

  if (!userRepo.setStatus(userId, 'ACTIVE', 'SUSPENDED')) {
    throw conflict('That account is already active.');
  }

  let restoredApplications = 0;
  if (user.role === 'EMPLOYER') {
    const employer = employerRepo.findByUserId(userId);
    if (employer) {
      // Only the postings a suspension could have taken down. A job the
      // employer closed themselves stays closed, and its applicants stay
      // closed with it.
      for (const jobId of jobRepo.listSuspendableIdsForEmployer(employer.id)) {
        restoredApplications += restoreAutoClosedApplications(jobId, actorId);
      }
    }
  }

  auditRepo.record({
    actorId,
    action: 'USER_REACTIVATE',
    entityType: 'USER',
    entityId: userId,
    metadata: { fromStatus: 'SUSPENDED', toStatus: 'ACTIVE', count: restoredApplications },
    ipAddress,
  });

  return { restoredApplications };
}
