/**
 * The DPDP right to erasure.
 *
 * Two things have to be true at once, and they pull against each other:
 *
 *   1. When someone asks to be erased, the personal data goes. Not hidden, not
 *      flagged — overwritten, and the CV off the disk.
 *   2. The hiring processes they were part of survive. An employer's record of
 *      who they interviewed and why is that employer's, an audit trail with a
 *      hole in it is not an audit trail, and BK is contractually accountable
 *      for both.
 *
 * The resolution is that identity is erased and history is detached: stage
 * events and audit rows keep their shape and lose their actor. Every column
 * that carries a name, a number, an address or an opinion is overwritten, and
 * erasure.test.ts asserts that column by column rather than trusting this
 * comment.
 *
 * Plan reference: HIGH-5.
 */

import { transaction } from '../../repositories/tx.js';
import * as erasureRepo from '../../repositories/erasure.repo.js';
import * as candidateRepo from '../../repositories/candidate.repo.js';
import * as employerRepo from '../../repositories/employer.repo.js';
import * as sessionRepo from '../../repositories/session.repo.js';
import * as userRepo from '../../repositories/user.repo.js';
import * as auditRepo from '../../repositories/audit.repo.js';
import * as fileStorage from '../../lib/file-storage.js';
import { logger } from '../../lib/logger.js';
import { badRequest, conflict, forbidden, notFound } from '../../lib/errors.js';

/**
 * A `type`, not an `interface` — TypeScript withholds the implicit index
 * signature from interfaces, so an interface cannot satisfy the `Serialized`
 * constraint that sendSerialized() requires. Every response DTO in this
 * codebase is a type alias for that reason.
 */
export type ErasureResult = {
  readonly filesRemoved: number;
  readonly notificationsRemoved: number;
};

/**
 * Records the request. Does not erase anything.
 *
 * Erasure is irreversible and can take an employer's records with it if done
 * carelessly, so a human confirms it. The candidate is told that, plainly, at
 * the point of asking.
 */
export function requestErasure(userId: string, reason: string | undefined): string {
  if (erasureRepo.findOpenForUser(userId)) {
    throw conflict('You have already asked us to erase your account. We are working on it.');
  }

  const user = userRepo.findById(userId);
  if (!user) throw notFound('Account not found.');

  return erasureRepo.createRequest(userId, reason?.trim() || undefined);
}

/**
 * Carries out an erasure.
 *
 * The filesystem work happens outside the transaction, because better-sqlite3
 * transactions are synchronous and cannot contain it. Files are removed
 * *after* the commit: a failed unlink leaves an orphan file that the weekly
 * sweep picks up, whereas unlinking first and then rolling back would leave a
 * row pointing at a CV that no longer exists.
 */
export function executeErasure(requestId: string, actorId: string, ip?: string): ErasureResult {
  const request = erasureRepo.findById(requestId);
  if (!request) throw notFound('Request not found.');
  if (request.status !== 'OPEN') throw conflict('That request has already been dealt with.');

  const user = userRepo.findById(request.user_id);
  if (!user) throw notFound('Account not found.');

  /*
   * An admin cannot be erased through this route.
   *
   * Their audit trail is the accountability record for everyone else's data,
   * and erasing the last active admin would lock BK out of their own platform.
   * If a BK staff member leaves, that is an account handover, not an erasure.
   */
  if (user.role === 'ADMIN') {
    throw forbidden(
      'Admin accounts cannot be erased here — their audit trail covers everyone else’s data. Hand the account over instead.',
    );
  }

  const files = erasureRepo.listOwnedFiles(user.id);

  const result = transaction(() => {
    let notificationsRemoved = 0;

    if (user.role === 'CANDIDATE') {
      const profile = candidateRepo.findByUserId(user.id);
      if (profile) {
        erasureRepo.anonymiseCandidateProfile(profile.id);
        // Must precede deleteFileRows: applications hold a foreign key to the
        // CV they were made with, and the delete fails while they do.
        erasureRepo.detachApplicationFiles(profile.id);
        // Free text OTHER people wrote about them, and notifications naming
        // them in other people's feeds. Neither is reachable by scoping on
        // this user's id, which is exactly how both survived a "completed"
        // erasure until an audit went looking for the name in the database.
        erasureRepo.scrubFreeTextAbout(profile.id);
        notificationsRemoved += erasureRepo.deleteNotificationsAbout(profile.id, user.id);
      }
    } else {
      const profile = employerRepo.findByUserId(user.id);
      if (profile) erasureRepo.anonymiseEmployerProfile(profile.id);
    }

    erasureRepo.deleteFileRows(user.id);
    notificationsRemoved += erasureRepo.deleteNotifications(user.id);
    erasureRepo.deleteAuthoredNotes(user.id);
    erasureRepo.detachFromHistory(user.id);
    sessionRepo.deleteAllForUser(user.id);
    erasureRepo.anonymiseUser(user.id);

    if (!erasureRepo.resolve(requestId, 'COMPLETED', actorId, null)) {
      throw conflict('That request has already been dealt with.');
    }

    /*
     * The audit row is written against the request, not the person. It records
     * that an erasure happened and who performed it — never what was erased,
     * which would defeat the point.
     */
    auditRepo.record({
      actorId,
      action: 'USER_ERASED',
      entityType: 'USER',
      entityId: requestId,
      metadata: { toStatus: 'ERASED' },
      ipAddress: ip,
    });

    return { notificationsRemoved };
  });

  let filesRemoved = 0;
  for (const file of files) {
    try {
      fileStorage.remove(file.stored_path);
      filesRemoved += 1;
    } catch (error) {
      // The row is already gone, so the file is unreachable either way. Logged
      // because an orphan on disk is still personal data sitting there.
      logger.error({ err: error, fileId: file.id }, 'erasure could not remove a stored file');
    }
  }

  return { filesRemoved, notificationsRemoved: result.notificationsRemoved };
}

export function rejectErasure(requestId: string, actorId: string, note: string): void {
  const reason = note.trim();
  if (reason.length < 10) {
    // DPDP allows refusal on narrow grounds only. An unexplained refusal is
    // indefensible, so the API requires the explanation rather than the form.
    throw badRequest('Explain why this cannot be erased — the person is shown this.', [
      { path: 'note', message: 'Give a reason of at least 10 characters.' },
    ]);
  }

  if (!erasureRepo.resolve(requestId, 'REJECTED', actorId, reason)) {
    throw conflict('That request has already been dealt with.');
  }
}
