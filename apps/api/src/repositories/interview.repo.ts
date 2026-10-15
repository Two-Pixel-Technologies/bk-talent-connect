/**
 * Interviews, employer interview requests, and private admin notes.
 */

import { getDb } from '../db/client.js';
import type { InterviewRow, InterviewRequestRow, AdminNoteRow, Row } from '../db/rows.js';
import { newId } from '../lib/ids.js';
import { nowIso } from '@bktc/shared';

// --- Interviews -----------------------------------------------------------

export function findById(id: string): Row<InterviewRow> | undefined {
  return getDb().prepare('SELECT * FROM interview WHERE id = ?').get(id) as
    | Row<InterviewRow>
    | undefined;
}

/** The live interview for an application, if there is one. */
export function findScheduled(applicationId: string): Row<InterviewRow> | undefined {
  return getDb()
    .prepare("SELECT * FROM interview WHERE application_id = ? AND status = 'SCHEDULED'")
    .get(applicationId) as Row<InterviewRow> | undefined;
}

/** Full history including cancelled and superseded rows. */
export function listForApplication(applicationId: string): Row<InterviewRow>[] {
  return getDb()
    .prepare('SELECT * FROM interview WHERE application_id = ? ORDER BY scheduled_at DESC')
    .all(applicationId) as Row<InterviewRow>[];
}

export interface CreateInterviewInput {
  readonly applicationId: string;
  readonly scheduledAt: string;
  readonly durationMinutes: number;
  readonly mode: string;
  readonly locationOrLink: string;
  readonly instructions?: string | undefined;
  readonly createdById: string;
}

export function create(input: CreateInterviewInput): string {
  const id = newId();
  const now = nowIso();
  getDb()
    .prepare(
      `INSERT INTO interview
         (id, application_id, scheduled_at, duration_minutes, mode, location_or_link,
          instructions, status, created_by_id, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, 'SCHEDULED', ?, ?, ?)`,
    )
    .run(
      id,
      input.applicationId,
      input.scheduledAt,
      input.durationMinutes,
      input.mode,
      input.locationOrLink,
      input.instructions ?? null,
      input.createdById,
      now,
      now,
    );
  return id;
}

export function setStatus(id: string, status: string): boolean {
  const result = getDb()
    .prepare("UPDATE interview SET status = ?, updated_at = ? WHERE id = ? AND status = 'SCHEDULED'")
    .run(status, nowIso(), id);
  return result.changes === 1;
}

/**
 * Cancels whatever interview is still live on an application.
 *
 * Returns the cancelled row so the caller can tell both parties.
 */
export function cancelScheduledFor(applicationId: string): Row<InterviewRow> | undefined {
  const live = findScheduled(applicationId);
  if (!live) return undefined;
  setStatus(live.id, 'CANCELLED');
  return live;
}

/**
 * Points a superseded interview at the one that replaced it.
 *
 * Separate from setStatus because the ordering matters: the partial unique
 * index allows only one SCHEDULED row per application, so the old row must be
 * moved off SCHEDULED *before* the replacement is inserted — which means its
 * id does not exist yet at that moment.
 */
export function setSupersededBy(id: string, supersededById: string): void {
  getDb()
    .prepare('UPDATE interview SET superseded_by_id = ?, updated_at = ? WHERE id = ?')
    .run(supersededById, nowIso(), id);
}

/**
 * Confirmation from one side.
 *
 * The proposal has BK "schedule and confirm with both parties"; recording it
 * here means the next person to pick up the conversation can see who has
 * actually agreed rather than asking again.
 */
export function confirm(id: string, side: 'CANDIDATE' | 'EMPLOYER'): void {
  const column = side === 'CANDIDATE' ? 'candidate_confirmed_at' : 'employer_confirmed_at';
  getDb()
    .prepare(`UPDATE interview SET ${column} = ?, updated_at = ? WHERE id = ?`)
    .run(nowIso(), nowIso(), id);
}

/** Upcoming interviews, for the admin's coordination view. */
export function listUpcoming(limit = 50): Row<InterviewRow>[] {
  return getDb()
    .prepare(
      `SELECT * FROM interview
       WHERE status = 'SCHEDULED' AND scheduled_at >= ?
       ORDER BY scheduled_at LIMIT ?`,
    )
    .all(nowIso(), limit) as Row<InterviewRow>[];
}

/**
 * Atomically claims every SCHEDULED interview whose scheduled_at falls in
 * [windowStart, windowEnd) and has not already been reminded, in one UPDATE
 * ... RETURNING — not a SELECT followed by an UPDATE. Two overlapping sweep
 * runs (e.g. a slow run still finishing when the next interval fires) would
 * otherwise both see the same unreminded row and both send; the single
 * atomic statement means only the run that actually flips reminder_sent_at
 * from NULL gets the row back, so each interview is reminded exactly once
 * regardless of how many sweeps overlap it.
 */
export function claimDueReminders(windowStart: string, windowEnd: string): Row<InterviewRow>[] {
  return getDb()
    .prepare(
      `UPDATE interview
       SET reminder_sent_at = ?
       WHERE status = 'SCHEDULED'
         AND reminder_sent_at IS NULL
         AND scheduled_at >= ?
         AND scheduled_at < ?
       RETURNING *`,
    )
    .all(nowIso(), windowStart, windowEnd) as Row<InterviewRow>[];
}

// --- Interview requests ---------------------------------------------------

export function createRequest(input: {
  readonly applicationId: string;
  readonly requestedById: string;
  readonly preferredSlots: readonly string[];
  readonly note?: string | undefined;
}): string {
  const id = newId();
  getDb()
    .prepare(
      `INSERT INTO interview_request
         (id, application_id, requested_by_id, preferred_slots, note, status, created_at)
       VALUES (?, ?, ?, ?, ?, 'OPEN', ?)`,
    )
    .run(
      id,
      input.applicationId,
      input.requestedById,
      JSON.stringify(input.preferredSlots),
      input.note ?? null,
      nowIso(),
    );
  return id;
}

export function findOpenRequest(applicationId: string): Row<InterviewRequestRow> | undefined {
  return getDb()
    .prepare("SELECT * FROM interview_request WHERE application_id = ? AND status = 'OPEN'")
    .get(applicationId) as Row<InterviewRequestRow> | undefined;
}

export function listOpenRequests(): Row<InterviewRequestRow>[] {
  return getDb()
    .prepare("SELECT * FROM interview_request WHERE status = 'OPEN' ORDER BY created_at")
    .all() as Row<InterviewRequestRow>[];
}

export function resolveRequestsFor(applicationId: string, status: 'ARRANGED' | 'DECLINED'): void {
  getDb()
    .prepare(
      "UPDATE interview_request SET status = ?, resolved_at = ? WHERE application_id = ? AND status = 'OPEN'",
    )
    .run(status, nowIso(), applicationId);
}

// --- Admin notes ----------------------------------------------------------

export function listNotes(entityType: string, entityId: string): Row<AdminNoteRow>[] {
  return getDb()
    .prepare(
      'SELECT * FROM admin_note WHERE entity_type = ? AND entity_id = ? ORDER BY created_at DESC',
    )
    .all(entityType, entityId) as Row<AdminNoteRow>[];
}

export function createNote(input: {
  readonly authorId: string;
  readonly entityType: string;
  readonly entityId: string;
  readonly body: string;
}): string {
  const id = newId();
  const now = nowIso();
  getDb()
    .prepare(
      `INSERT INTO admin_note (id, author_id, entity_type, entity_id, body, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
    )
    .run(id, input.authorId, input.entityType, input.entityId, input.body, now, now);
  return id;
}

export function deleteNote(id: string, authorId: string): boolean {
  const result = getDb()
    .prepare('DELETE FROM admin_note WHERE id = ? AND author_id = ?')
    .run(id, authorId);
  return result.changes === 1;
}

/**
 * Notes whose target no longer exists. The polymorphic key cannot have a
 * foreign key, so orphans are swept rather than prevented.
 */
export function deleteOrphanedNotes(): number {
  const db = getDb();
  const result = db
    .prepare(
      `DELETE FROM admin_note WHERE
         (entity_type = 'CANDIDATE'   AND entity_id NOT IN (SELECT id FROM candidate_profile)) OR
         (entity_type = 'EMPLOYER'    AND entity_id NOT IN (SELECT id FROM employer_profile))  OR
         (entity_type = 'JOB'         AND entity_id NOT IN (SELECT id FROM job))               OR
         (entity_type = 'APPLICATION' AND entity_id NOT IN (SELECT id FROM application))`,
    )
    .run();
  return result.changes;
}
