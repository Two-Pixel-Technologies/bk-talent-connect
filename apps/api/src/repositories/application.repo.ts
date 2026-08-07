/**
 * Application and pipeline data access.
 */

import { LIKE_ESCAPE_CLAUSE as LIKE, likeContains } from './like.js';
import { getDb } from '../db/client.js';
import type { ApplicationRow, ApplicationStageEventRow, JobRow, Row } from '../db/rows.js';
import { newId } from '../lib/ids.js';
import { nowIso, SORT_DIRECTIONS, type ApplicationStage, type SortDirection } from '@bktc/shared';

export function findById(id: string): Row<ApplicationRow> | undefined {
  return getDb().prepare('SELECT * FROM application WHERE id = ?').get(id) as
    | Row<ApplicationRow>
    | undefined;
}

export function findByJobAndCandidate(
  jobId: string,
  candidateProfileId: string,
): Row<ApplicationRow> | undefined {
  return getDb()
    .prepare('SELECT * FROM application WHERE job_id = ? AND candidate_profile_id = ?')
    .get(jobId, candidateProfileId) as Row<ApplicationRow> | undefined;
}

export interface CreateApplicationInput {
  readonly jobId: string;
  readonly candidateProfileId: string;
  readonly source: 'APPLIED' | 'ADMIN_RECOMMENDED';
  readonly resumeFileId: string | null;
  readonly recommendedById?: string | undefined;
}

export function create(input: CreateApplicationInput): string {
  const id = newId();
  const now = nowIso();
  const recommended = input.source === 'ADMIN_RECOMMENDED';

  getDb()
    .prepare(
      `INSERT INTO application
         (id, job_id, candidate_profile_id, source, stage, is_recommended, recommended_by_id,
          recommended_at, applied_at, last_stage_change_at, resume_file_id_at_apply,
          created_at, updated_at)
       VALUES (?, ?, ?, ?, 'APPLIED', ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .run(
      id,
      input.jobId,
      input.candidateProfileId,
      input.source,
      recommended ? 1 : 0,
      input.recommendedById ?? null,
      recommended ? now : null,
      now,
      now,
      input.resumeFileId,
      now,
      now,
    );
  return id;
}

/**
 * Moves an application to a new stage, conditional on it still being at the
 * stage the caller checked. Two people acting at once cannot both succeed.
 */
export function setStage(
  applicationId: string,
  next: ApplicationStage,
  expectedCurrent: ApplicationStage,
  outcomeReasonCode?: string | null,
): boolean {
  const now = nowIso();
  const result = getDb()
    .prepare(
      `UPDATE application
       SET stage = ?, last_stage_change_at = ?, updated_at = ?,
           outcome_reason_code = COALESCE(?, outcome_reason_code)
       WHERE id = ? AND stage = ?`,
    )
    .run(next, now, now, outcomeReasonCode ?? null, applicationId, expectedCurrent);
  return result.changes === 1;
}

/** Re-apply after withdrawing: reuses the row the unique constraint reserved. */
export function reopen(applicationId: string, resumeFileId: string | null): boolean {
  const now = nowIso();
  const result = getDb()
    .prepare(
      `UPDATE application
       SET stage = 'APPLIED', applied_at = ?, last_stage_change_at = ?, updated_at = ?,
           outcome_reason_code = NULL, resume_file_id_at_apply = ?
       WHERE id = ? AND stage = 'WITHDRAWN'`,
    )
    .run(now, now, now, resumeFileId, applicationId);
  return result.changes === 1;
}

/** Flags an existing application as recommended by BK. */
export function markRecommended(applicationId: string, actorId: string): void {
  const now = nowIso();
  getDb()
    .prepare(
      `UPDATE application
       SET is_recommended = 1, recommended_by_id = ?, recommended_at = ?, updated_at = ?
       WHERE id = ?`,
    )
    .run(actorId, now, now, applicationId);
}

/**
 * Candidates who could be put forward for a role: approved, consented, and not
 * already on this job. Ordered by the overlap between their skills and the
 * job's required skills, so the strongest fits come first.
 */
export function searchRecommendable(options: {
  readonly jobId: string;
  readonly search?: string | undefined;
  readonly sectorId?: number | undefined;
  readonly minExperience?: number | undefined;
  readonly limit: number;
  readonly offset: number;
}): { rows: { profileId: string; matchingSkills: number }[]; total: number } {
  const db = getDb();
  const where = [
    "cp.profile_status = 'APPROVED'",
    'cp.deleted_at IS NULL',
    "u.status = 'ACTIVE'",
    // Consent is a hard precondition for recommending, so people who have not
    // given it are not even offered.
    'cp.consented_at IS NOT NULL',
    'cp.id NOT IN (SELECT candidate_profile_id FROM application WHERE job_id = ?)',
  ];
  const params: unknown[] = [options.jobId];

  if (options.search) {
    where.push(`(cp.full_name LIKE ? ${LIKE} OR cp.current_job_title LIKE ? ${LIKE})`);
    const term = likeContains(options.search);
    params.push(term, term);
  }
  if (options.sectorId !== undefined) {
    where.push('cp.sector_id = ?');
    params.push(options.sectorId);
  }
  if (options.minExperience !== undefined) {
    where.push('cp.years_of_experience >= ?');
    params.push(options.minExperience);
  }
  const whereSql = where.join(' AND ');
  const joins = 'JOIN user u ON u.id = cp.user_id';

  const total = (
    db
      .prepare(`SELECT count(*) AS n FROM candidate_profile cp ${joins} WHERE ${whereSql}`)
      .get(...params) as { n: number }
  ).n;

  const rows = db
    .prepare(
      `SELECT cp.id AS profileId,
              (SELECT count(*) FROM candidate_skill cs
                 JOIN job_skill js ON js.skill_id = cs.skill_id
                WHERE cs.candidate_profile_id = cp.id
                  AND js.job_id = ? AND js.requirement = 'REQUIRED') AS matchingSkills
       FROM candidate_profile cp ${joins}
       WHERE ${whereSql}
       ORDER BY matchingSkills DESC, cp.years_of_experience DESC, cp.id DESC
       LIMIT ? OFFSET ?`,
    )
    .all(options.jobId, ...params, options.limit, options.offset) as {
    profileId: string;
    matchingSkills: number;
  }[];

  return { rows, total };
}

/** First employer touch, for Phase 2's response-time metric. Never overwritten. */
export function markEmployerAction(applicationId: string): void {
  const now = nowIso();
  getDb()
    .prepare(
      `UPDATE application
       SET first_employer_action_at = COALESCE(first_employer_action_at, ?),
           employer_last_viewed_at = ?
       WHERE id = ?`,
    )
    .run(now, now, applicationId);
}

// --- Stage history --------------------------------------------------------

export function recordStageEvent(input: {
  readonly applicationId: string;
  readonly fromStage: string | null;
  readonly toStage: string;
  readonly changedById: string | null;
  readonly changedByRole: 'CANDIDATE' | 'EMPLOYER' | 'ADMIN' | 'SYSTEM';
  readonly note?: string | null;
}): void {
  getDb()
    .prepare(
      `INSERT INTO application_stage_event
         (application_id, from_stage, to_stage, changed_by_id, changed_by_role, note, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
    )
    .run(
      input.applicationId,
      input.fromStage,
      input.toStage,
      input.changedById,
      input.changedByRole,
      input.note ?? null,
      nowIso(),
    );
}

export function listStageEvents(applicationId: string): Row<ApplicationStageEventRow>[] {
  return getDb()
    .prepare(
      'SELECT * FROM application_stage_event WHERE application_id = ? ORDER BY created_at, id',
    )
    .all(applicationId) as Row<ApplicationStageEventRow>[];
}

// --- Candidate's own applications -----------------------------------------

export interface CandidateApplicationRow {
  readonly application: Row<ApplicationRow>;
  readonly job: Row<JobRow>;
  readonly employerName: string;
}

/**
 * The company name is only included once the application reaches shortlist —
 * public and pre-shortlist listings are anonymous by design.
 */
export function listForCandidate(
  candidateProfileId: string,
  limit: number,
  offset: number,
): { rows: CandidateApplicationRow[]; total: number } {
  const db = getDb();
  const total = (
    db
      .prepare('SELECT count(*) AS n FROM application WHERE candidate_profile_id = ?')
      .get(candidateProfileId) as { n: number }
  ).n;

  const rows = db
    .prepare(
      `SELECT a.*, j.id AS _job_id, ep.company_name AS _employer_name
       FROM application a
       JOIN job j ON j.id = a.job_id
       JOIN employer_profile ep ON ep.id = j.employer_profile_id
       WHERE a.candidate_profile_id = ?
       ORDER BY a.applied_at DESC, a.id DESC
       LIMIT ? OFFSET ?`,
    )
    .all(candidateProfileId, limit, offset) as (ApplicationRow & {
    _job_id: string;
    _employer_name: string;
  })[];

  const jobs = new Map<string, Row<JobRow>>();
  for (const row of rows) {
    if (!jobs.has(row.job_id)) {
      const job = db.prepare('SELECT * FROM job WHERE id = ?').get(row.job_id) as Row<JobRow>;
      jobs.set(row.job_id, job);
    }
  }

  return {
    rows: rows.map((row) => ({
      application: row as Row<ApplicationRow>,
      job: jobs.get(row.job_id)!,
      employerName: row._employer_name,
    })),
    total,
  };
}

// --- Employer's applicant list --------------------------------------------

/**
 * Sort allowlist. Note what is absent: nothing derived from the candidate's
 * salary. The serializer strips those values from the response, but allowing a
 * sort on them would leak their ORDER — an employer could binary-search a
 * candidate's expectations by combining sort with filters.
 */
const APPLICANT_SORTS = {
  applied: 'a.applied_at',
  stage: 'a.stage',
  name: 'cp.full_name',
  experience: 'cp.years_of_experience',
} as const;
export type ApplicantSortKey = keyof typeof APPLICANT_SORTS;

export const isApplicantSort = (v: unknown): v is ApplicantSortKey =>
  typeof v === 'string' && v in APPLICANT_SORTS;
export const isSortDirection = (v: unknown): v is SortDirection =>
  typeof v === 'string' && (SORT_DIRECTIONS as readonly string[]).includes(v);

export function listApplicants(options: {
  readonly jobId: string;
  readonly stage?: string | undefined;
  readonly sort?: ApplicantSortKey | undefined;
  readonly dir?: SortDirection | undefined;
  readonly limit: number;
  readonly offset: number;
}): {
  rows: { application: Row<ApplicationRow>; candidateAvailable: boolean }[];
  total: number;
  counts: Record<string, number>;
} {
  const db = getDb();
  const where = ['a.job_id = ?'];
  const params: unknown[] = [options.jobId];

  if (options.stage) {
    where.push('a.stage = ?');
    params.push(options.stage);
  }

  // A candidate whose profile was rejected or whose account was suspended must
  // drop out of the employer's list — the whole premise is that employers only
  // see people we have vouched for.
  // A withdrawn application belongs to no Kanban bucket and has no available
  // actions, so leaving it on the board just inflates the count with a row the
  // employer can never do anything about.
  if (!options.stage) where.push("a.stage != 'WITHDRAWN'");

  // Suspended accounts and soft-deleted profiles drop out. Profile status is
  // deliberately NOT filtered here — see the candidateAvailable flag below.
  where.push("u.status = 'ACTIVE'", 'cp.deleted_at IS NULL');

  const whereSql = where.join(' AND ');
  const joins = `
    JOIN candidate_profile cp ON cp.id = a.candidate_profile_id
    JOIN user u ON u.id = cp.user_id`;

  const total = (
    db.prepare(`SELECT count(*) AS n FROM application a ${joins} WHERE ${whereSql}`).get(...params) as {
      n: number;
    }
  ).n;

  const countRows = db
    .prepare(
      `SELECT a.stage, count(*) AS n FROM application a ${joins}
       WHERE a.job_id = ? AND u.status = 'ACTIVE' AND cp.deleted_at IS NULL
         AND a.stage != 'WITHDRAWN'
       GROUP BY a.stage`,
    )
    .all(options.jobId) as { stage: string; n: number }[];

  const column = APPLICANT_SORTS[options.sort ?? 'applied'];
  const dir = options.dir === 'ASC' ? 'ASC' : 'DESC';

  // Pinning is done in SQL, not in JS after LIMIT/OFFSET. Pinning after
  // pagination would re-pin a different subset on every page, so rows would
  // appear twice or vanish. a.id is the final tiebreak for stable paging.
  const rows = db
    .prepare(
      `SELECT a.*, (cp.profile_status = 'APPROVED') AS _available
       FROM application a ${joins}
       WHERE ${whereSql}
       ORDER BY a.is_recommended DESC, ${column} ${dir}, a.id DESC
       LIMIT ? OFFSET ?`,
    )
    .all(...params, options.limit, options.offset) as (ApplicationRow & { _available: number })[];

  return {
    rows: rows.map((row) => ({
      application: row as Row<ApplicationRow>,
      candidateAvailable: row._available === 1,
    })),
    total,
    counts: Object.fromEntries(countRows.map((r) => [r.stage, r.n])),
  };
}

// --- Admin pipeline -------------------------------------------------------

/**
 * Every application, optionally narrowed to one job or stage.
 *
 * Unlike the employer list this applies no availability filter: an admin needs
 * to see records precisely when something is wrong with them.
 */
export function listForAdmin(options: {
  readonly jobId?: string | undefined;
  readonly stage?: string | undefined;
  readonly limit: number;
  readonly offset: number;
}): { rows: Row<ApplicationRow>[]; total: number } {
  const db = getDb();
  const where: string[] = [];
  const params: unknown[] = [];

  if (options.jobId) {
    where.push('a.job_id = ?');
    params.push(options.jobId);
  }
  if (options.stage) {
    where.push('a.stage = ?');
    params.push(options.stage);
  }
  const whereSql = where.length > 0 ? `WHERE ${where.join(' AND ')}` : '';

  const total = (
    db.prepare(`SELECT count(*) AS n FROM application a ${whereSql}`).get(...params) as { n: number }
  ).n;

  const rows = db
    .prepare(
      `SELECT a.* FROM application a ${whereSql}
       ORDER BY a.last_stage_change_at DESC, a.id DESC
       LIMIT ? OFFSET ?`,
    )
    .all(...params, options.limit, options.offset) as Row<ApplicationRow>[];

  return { rows, total };
}

export function countByStage(jobId?: string): Record<string, number> {
  const db = getDb();
  const rows = jobId
    ? (db
        .prepare('SELECT stage, count(*) AS n FROM application WHERE job_id = ? GROUP BY stage')
        .all(jobId) as { stage: string; n: number }[])
    : (db.prepare('SELECT stage, count(*) AS n FROM application GROUP BY stage').all() as {
        stage: string;
        n: number;
      }[]);
  return Object.fromEntries(rows.map((r) => [r.stage, r.n]));
}

export function setOutcomeReason(applicationId: string, code: string): void {
  getDb()
    .prepare('UPDATE application SET outcome_reason_code = ?, updated_at = ? WHERE id = ?')
    .run(code, nowIso(), applicationId);
}

/** Does this employer own the job this application belongs to? */
export function employerOwnsApplication(applicationId: string, employerProfileId: string): boolean {
  const row = getDb()
    .prepare(
      `SELECT 1 AS hit FROM application a
       JOIN job j ON j.id = a.job_id
       WHERE a.id = ? AND j.employer_profile_id = ?`,
    )
    .get(applicationId, employerProfileId) as { hit: number } | undefined;
  return row !== undefined;
}

/**
 * Used by the file download route to decide whether an employer may open a
 * candidate's CV: they must have an application to a job they own, and the
 * candidate's profile must be approved (D1).
 */
export function employerMayViewCandidateFiles(
  employerProfileId: string,
  candidateUserId: string,
): boolean {
  const row = getDb()
    .prepare(
      `SELECT 1 AS hit FROM application a
       JOIN job j ON j.id = a.job_id
       JOIN candidate_profile cp ON cp.id = a.candidate_profile_id
       WHERE j.employer_profile_id = ?
         AND cp.user_id = ?
         AND cp.profile_status = 'APPROVED'
         AND cp.deleted_at IS NULL
       LIMIT 1`,
    )
    .get(employerProfileId, candidateUserId) as { hit: number } | undefined;
  return row !== undefined;
}

export function countOpenApplications(jobId: string): number {
  return (
    getDb()
      .prepare(
        `SELECT count(*) AS n FROM application
         WHERE job_id = ? AND stage IN ('APPLIED','UNDER_REVIEW')`,
      )
      .get(jobId) as { n: number }
  ).n;
}

/**
 * Undoes an auto-close. Only touches applications this system rejected with
 * JOB_CLOSED — a candidate the employer rejected on merit stays rejected.
 */
export function restoreAutoClosed(jobId: string): { id: string }[] {
  const db = getDb();
  const rows = db
    .prepare(
      `SELECT id FROM application
       WHERE job_id = ? AND stage = 'NOT_SELECTED' AND outcome_reason_code = 'JOB_CLOSED'`,
    )
    .all(jobId) as { id: string }[];

  const now = nowIso();
  const update = db.prepare(
    `UPDATE application
     SET stage = 'APPLIED', outcome_reason_code = NULL, last_stage_change_at = ?, updated_at = ?
     WHERE id = ?`,
  );
  for (const row of rows) update.run(now, now, row.id);
  return rows;
}

/** Bulk close-out when a job is closed or an employer suspended. */
export function closeOpenApplications(
  jobId: string,
  reasonCode: string,
): { id: string; fromStage: string }[] {
  const db = getDb();
  const open = db
    .prepare(
      `SELECT id, stage FROM application
       WHERE job_id = ? AND stage IN ('APPLIED','UNDER_REVIEW')`,
    )
    .all(jobId) as { id: string; stage: string }[];

  const now = nowIso();
  const update = db.prepare(
    `UPDATE application
     SET stage = 'NOT_SELECTED', outcome_reason_code = ?, last_stage_change_at = ?, updated_at = ?
     WHERE id = ?`,
  );
  for (const row of open) update.run(reasonCode, now, now, row.id);
  // The real prior stage, not null — every Phase 2 duration metric reads this.
  return open.map((r) => ({ id: r.id, fromStage: r.stage }));
}
