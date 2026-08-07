/**
 * Erasure requests, and the SQL that carries one out.
 *
 * The anonymisation statements live here rather than in the service because
 * they are the part that must be reviewed against the schema: every column
 * holding personal data has to appear in exactly one of them, and a column
 * added later that nobody adds here is a quiet compliance failure. The
 * erasure test asserts the result column by column for that reason.
 */

import { getDb } from '../db/client.js';
import type { ErasureRequestRow, Row } from '../db/rows.js';
import { newId } from '../lib/ids.js';
import { nowIso } from '@bktc/shared';

export function createRequest(userId: string, reason: string | undefined): string {
  const id = newId();
  getDb()
    .prepare(
      `INSERT INTO erasure_request (id, user_id, reason, status, requested_at)
       VALUES (?, ?, ?, 'OPEN', ?)`,
    )
    .run(id, userId, reason ?? null, nowIso());
  return id;
}

export function findOpenForUser(userId: string): Row<ErasureRequestRow> | undefined {
  return getDb()
    .prepare("SELECT * FROM erasure_request WHERE user_id = ? AND status = 'OPEN'")
    .get(userId) as Row<ErasureRequestRow> | undefined;
}

export function findById(id: string): Row<ErasureRequestRow> | undefined {
  return getDb().prepare('SELECT * FROM erasure_request WHERE id = ?').get(id) as
    | Row<ErasureRequestRow>
    | undefined;
}

export function listForUser(userId: string): Row<ErasureRequestRow>[] {
  return getDb()
    .prepare('SELECT * FROM erasure_request WHERE user_id = ? ORDER BY requested_at DESC')
    .all(userId) as Row<ErasureRequestRow>[];
}

export function list(options: {
  readonly status?: string | undefined;
  readonly limit: number;
  readonly offset: number;
}): { rows: Row<ErasureRequestRow>[]; total: number } {
  const db = getDb();
  const where = options.status ? 'WHERE status = ?' : '';
  const params = options.status ? [options.status] : [];

  const total = (
    db.prepare(`SELECT COUNT(*) AS n FROM erasure_request ${where}`).get(...params) as { n: number }
  ).n;

  const rows = db
    .prepare(`SELECT * FROM erasure_request ${where} ORDER BY requested_at DESC LIMIT ? OFFSET ?`)
    .all(...params, options.limit, options.offset) as Row<ErasureRequestRow>[];

  return { rows, total };
}

export function resolve(
  id: string,
  status: 'COMPLETED' | 'REJECTED',
  handledById: string,
  note: string | null,
): boolean {
  /*
   * On completion the person's own words are dropped.
   *
   * `reason` is free text they wrote, and people asking to be erased routinely
   * identify themselves in it — "delete everything, my name is X, mobile Y".
   * Keeping it would leave the strongest copy of their personal data inside
   * the very record we would produce as evidence that we erased them. The row
   * survives, because "erased on this date at their request" is what proves
   * compliance; the prose does not.
   *
   * A refusal keeps the reason, because the request is still live and BK needs
   * to know what was asked.
   */
  const clearReason = status === 'COMPLETED';

  const result = getDb()
    .prepare(
      `UPDATE erasure_request
          SET status = ?,
              handled_at = ?,
              handled_by_id = ?,
              decision_note = ?,
              reason = CASE WHEN ? THEN NULL ELSE reason END
        WHERE id = ? AND status = 'OPEN'`,
    )
    .run(status, nowIso(), handledById, note, clearReason ? 1 : 0, id);
  return result.changes === 1;
}

// ---------------------------------------------------------------------------
// The erasure itself
// ---------------------------------------------------------------------------

/**
 * Overwrites every column on the user row that identifies a person.
 *
 * The row survives so foreign keys elsewhere hold — an application without a
 * candidate row is a dangling record on somebody else's screen. What is left
 * is an id, a role and a tombstone.
 */
export function anonymiseUser(userId: string): void {
  const now = nowIso();
  getDb()
    .prepare(
      `UPDATE user
          SET email = 'erased-' || id || '@erased.invalid',
              password_hash = 'ERASED',
              status = 'SUSPENDED',
              must_change_password = 0,
              last_login_at = NULL,
              deleted_at = ?,
              updated_at = ?
        WHERE id = ?`,
    )
    .run(now, now, userId);
}

/** Every personal field on a candidate profile, and every child row of it. */
export function anonymiseCandidateProfile(profileId: string): void {
  const db = getDb();
  const now = nowIso();

  db.prepare(
    `UPDATE candidate_profile
        SET full_name = 'Erased at their request',
            mobile = '',
            city_id = NULL,
            state = NULL,
            current_job_title = NULL,
            current_employer = NULL,
            years_of_experience = NULL,
            sector_id = NULL,
            functional_area_id = NULL,
            education_level = NULL,
            qualification = NULL,
            qualification_year = NULL,
            career_summary = NULL,
            notice_period = NULL,
            employment_preference = NULL,
            current_salary = NULL,
            expected_salary_min = NULL,
            expected_salary_max = NULL,
            linkedin_url = NULL,
            resume_file_id = NULL,
            review_note = NULL,
            last_approved_snapshot = NULL,
            profile_status = 'REJECTED',
            deleted_at = ?,
            updated_at = ?
      WHERE id = ?`,
  ).run(now, now, profileId);

  // Skills and career history are free-text personal data with no retention
  // interest attached — they go entirely.
  db.prepare('DELETE FROM candidate_skill WHERE candidate_profile_id = ?').run(profileId);
  db.prepare('DELETE FROM candidate_experience WHERE candidate_profile_id = ?').run(profileId);

  // Internal notes are opinions about a person. Nothing justifies keeping them
  // once that person is gone. Both the notes filed against the candidate and
  // the ones filed against their applications — an audit found the second kind
  // surviving a "completed" erasure, still readable on /admin/notes.
  db.prepare("DELETE FROM admin_note WHERE entity_type = 'CANDIDATE' AND entity_id = ?").run(
    profileId,
  );
  db.prepare(
    `DELETE FROM admin_note
      WHERE entity_type = 'APPLICATION'
        AND entity_id IN (SELECT id FROM application WHERE candidate_profile_id = ?)`,
  ).run(profileId);
}

/**
 * Free text other people wrote ABOUT this person.
 *
 * The hard half of an erasure, and the half that was missed. Overwriting the
 * candidate's own columns is obvious; what is easy to forget is that a
 * coordinator typed "ask for <name> at reception, his mobile is <number>" into
 * an interview instruction, and that field is served to the employer every
 * time they open the interview. None of these columns belong to the erased
 * user, so nothing scoped by `user_id` or `candidate_profile_id` alone
 * reaches them.
 *
 * The records themselves survive — an interview happened, a stage changed —
 * they simply stop carrying a person's identity in prose. Anything that cannot
 * be usefully redacted in place is nulled rather than paraphrased: a redaction
 * we invent is a new statement about someone who asked us to stop making them.
 */
export function scrubFreeTextAbout(candidateProfileId: string): void {
  const db = getDb();

  // Notes on the stage timeline, written by employers and admins.
  db.prepare(
    `UPDATE application_stage_event
        SET note = NULL
      WHERE application_id IN (SELECT id FROM application WHERE candidate_profile_id = ?)`,
  ).run(candidateProfileId);

  // Joining instructions and the employer's reason for wanting the meeting.
  db.prepare(
    `UPDATE interview
        SET instructions = NULL, location_or_link = '(removed)'
      WHERE application_id IN (SELECT id FROM application WHERE candidate_profile_id = ?)`,
  ).run(candidateProfileId);

  db.prepare(
    `UPDATE interview_request
        SET note = NULL
      WHERE application_id IN (SELECT id FROM application WHERE candidate_profile_id = ?)`,
  ).run(candidateProfileId);
}

/**
 * Notifications ABOUT this person, wherever they are.
 *
 * deleteNotifications() only clears the erased user's own bell. Every
 * notification naming them — "Anita Desai applied to…", "Kirloskar wants to
 * interview Anita Desai" — sits in an admin's or an employer's feed under a
 * different user_id and survived untouched.
 *
 * Matched on the subject rather than the text, so this does not depend on
 * guessing how a name was formatted into a sentence.
 */
export function deleteNotificationsAbout(candidateProfileId: string, userId: string): number {
  return getDb()
    .prepare(
      `DELETE FROM notification
        WHERE entity_id = ?
           OR entity_id = ?
           OR entity_id IN (SELECT id FROM application WHERE candidate_profile_id = ?)
           OR entity_id IN (
                SELECT i.id FROM interview i
                  JOIN application a ON a.id = i.application_id
                 WHERE a.candidate_profile_id = ?)`,
    )
    .run(candidateProfileId, userId, candidateProfileId, candidateProfileId).changes;
}

export function anonymiseEmployerProfile(profileId: string): void {
  const now = nowIso();
  getDb()
    .prepare(
      `UPDATE employer_profile
          SET hr_contact_name = 'Erased',
              hr_contact_email = 'erased@erased.invalid',
              hr_contact_phone = '',
              website = NULL,
              linkedin_url = NULL,
              review_note = NULL,
              last_approved_snapshot = NULL,
              deleted_at = ?,
              updated_at = ?
        WHERE id = ?`,
    )
    .run(now, now, profileId);
}

/** Files owned by this user, so the CV comes off disk as well as out of the DB. */
export function listOwnedFiles(userId: string): { id: string; stored_path: string }[] {
  return getDb()
    .prepare('SELECT id, stored_path FROM file_asset WHERE owner_id = ?')
    .all(userId) as { id: string; stored_path: string }[];
}

/**
 * Releases the applications' hold on this person's files.
 *
 * An application snapshots the CV that was current when it was made, as a
 * foreign key — which means deleting the file row fails outright while any
 * application still points at it. That FK is doing its job: it is what stops a
 * CV being replaced out from under an employer mid-process. Under erasure it
 * has to be released first, and the employer loses the download rather than
 * the whole application.
 *
 * Called before deleteFileRows, and the erasure test covers the ordering.
 */
export function detachApplicationFiles(candidateProfileId: string): void {
  getDb()
    .prepare(
      `UPDATE application
          SET resume_file_id_at_apply = NULL
        WHERE candidate_profile_id = ?`,
    )
    .run(candidateProfileId);
}

export function deleteFileRows(userId: string): number {
  return getDb().prepare('DELETE FROM file_asset WHERE owner_id = ?').run(userId).changes;
}

/**
 * Detaches the person from records that legitimately survive them.
 *
 * Stage events and audit rows are the history of decisions BK and its clients
 * made — a hiring process that loses its own history is not anonymised, it is
 * destroyed. Both columns are nullable precisely so this is possible.
 */
export function detachFromHistory(userId: string): void {
  const db = getDb();
  db.prepare('UPDATE application_stage_event SET changed_by_id = NULL WHERE changed_by_id = ?').run(
    userId,
  );
  db.prepare('UPDATE audit_log SET actor_id = NULL, ip_address = NULL WHERE actor_id = ?').run(userId);
}

export function deleteNotifications(userId: string): number {
  return getDb().prepare('DELETE FROM notification WHERE user_id = ?').run(userId).changes;
}

/** Notes this person wrote, if they were an admin. */
export function deleteAuthoredNotes(userId: string): number {
  return getDb().prepare('DELETE FROM admin_note WHERE author_id = ?').run(userId).changes;
}

/*
 * Session retention lives in session.repo.deleteExpired(), which already
 * sweeps both expired rows and rows past LIMITS.session.retentionMs. It is
 * deliberately not duplicated here: two definitions of the retention window
 * is how one of them ends up wrong.
 */
