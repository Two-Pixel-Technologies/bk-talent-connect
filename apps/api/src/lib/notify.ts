/**
 * Notification dispatch.
 *
 * Recipients are read from NOTIFICATION_MATRIX in packages/shared and from
 * nowhere else. That matrix is a verbatim transcription of the Proposal p8
 * table, so "who gets told what" is a data question with one answer, checkable
 * row by row against the document BK signed.
 *
 * The alternative — each service calling notificationRepo.create() for whoever
 * seemed relevant — is how v1 of the plan ended up notifying employers of new
 * applications, which p8 explicitly marks "–". It failed its own exit check and
 * nothing caught it, because there was no single place the rule lived.
 *
 * Plan reference: HIGH-2, BLOCKER-2, LOW-7.
 */

import {
  recipientsFor,
  type NotificationEntityType,
  type NotificationEvent,
  type Role,
} from '@bktc/shared';
import * as notificationRepo from '../repositories/notification.repo.js';
import * as userRepo from '../repositories/user.repo.js';
import { logger } from './logger.js';

export interface NotificationCopy {
  readonly title: string;
  readonly body?: string | undefined;
}

export interface NotifyInput {
  readonly event: NotificationEvent;
  /**
   * The user behind each party role for this subject. ADMIN is not listed —
   * it always expands to every active admin, never a nominated account.
   */
  readonly parties: {
    readonly CANDIDATE?: string | undefined;
    readonly EMPLOYER?: string | undefined;
  };
  readonly title: string;
  readonly body?: string | undefined;
  /**
   * Wording for a specific audience, overriding the default above.
   *
   * The same event genuinely reads differently to different people: "You have
   * been shortlisted" to the candidate, "<name> shortlisted" to the employer,
   * "<name> applied to <role> at <company>" to the admin. Overriding the copy
   * per role keeps that natural while leaving the recipient list — the part
   * BK signed off — entirely matrix-driven.
   *
   * It is also how the anonymity rule is kept: the CANDIDATE entry is the one
   * that must never name the employer.
   */
  readonly perRole?: Partial<Record<Role, NotificationCopy>> | undefined;
  readonly entityType?: NotificationEntityType | undefined;
  readonly entityId?: string | undefined;
  /**
   * Whoever performed the action, so they are not told about their own click.
   * Only meaningful when the actor is also in the recipient set — an admin
   * approving a job, say.
   */
  readonly excludeUserId?: string | undefined;
  /**
   * The one sanctioned deviation from the matrix, for bulk events only.
   *
   * Closing a posting turns down every pending applicant at once. Fanning the
   * admin row out per application means forty bell entries for one click,
   * which is how a notification centre becomes something people stop reading.
   * The candidates are still told individually — they are the ones whose
   * process just ended.
   *
   * Every use of this must raise a single summary notification for the admin
   * team instead, so the team still learns it happened.
   */
  readonly omitAdminFanOut?: boolean | undefined;
}

/**
 * Expands the matrix row into concrete user ids.
 *
 * A party the matrix requires but the caller did not supply is a bug in the
 * call site, not a reason to send fewer notifications. It throws rather than
 * skipping: a notification that silently never arrives is the failure mode
 * this whole file exists to prevent, and every call site is exercised by the
 * matrix test.
 */
interface Recipient {
  readonly userId: string;
  readonly role: Role;
}

function resolveRecipients(input: NotifyInput): Recipient[] {
  const roles: readonly Role[] = recipientsFor(input.event);
  const byUser = new Map<string, Recipient>();

  for (const role of roles) {
    if (role === 'ADMIN') {
      if (input.omitAdminFanOut) continue;
      for (const id of userRepo.listAdminIds()) byUser.set(id, { userId: id, role: 'ADMIN' });
      continue;
    }
    const userId = input.parties[role];
    if (!userId) {
      throw new Error(
        `Notification ${input.event} names ${role} as a recipient but no ${role} user was supplied.`,
      );
    }
    byUser.set(userId, { userId, role });
  }

  if (input.excludeUserId) byUser.delete(input.excludeUserId);
  return [...byUser.values()];
}

/**
 * Writes one row per recipient.
 *
 * Called inside the caller's transaction where there is one, so a notification
 * about a stage change cannot survive a rolled-back stage change.
 */
export function notify(input: NotifyInput): string[] {
  return resolveRecipients(input).map(({ userId, role }) => {
    const copy = input.perRole?.[role] ?? { title: input.title, body: input.body };
    return notificationRepo.create({
      userId,
      event: input.event,
      title: copy.title,
      body: copy.body,
      entityType: input.entityType,
      entityId: input.entityId,
    });
  });
}

/**
 * Dispatch that must not take the caller down with it.
 *
 * Used only where the notification is genuinely secondary to the operation —
 * registration, for instance, where failing to write a welcome row is not a
 * reason to refuse the account. Everywhere inside a transaction uses notify()
 * directly, so the notification and the fact it describes commit together.
 */
export function notifyQuietly(input: NotifyInput): void {
  try {
    notify(input);
  } catch (error) {
    logger.error({ err: error, event: input.event }, 'notification dispatch failed');
  }
}
