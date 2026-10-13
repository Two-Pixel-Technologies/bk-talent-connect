/**
 * Admin queues, stats and review actions.
 *
 * Every review action is a CONDITIONAL update: the expected current status is
 * part of the WHERE clause, so if two admins open the same pending candidate
 * and both click Approve, exactly one UPDATE matches. The other gets
 * changes === 0 and the caller turns that into a 409 rather than silently
 * overwriting — which matters most when one clicked Approve and the other
 * Reject.
 *
 * Plan reference: MEDIUM-9.
 */

import {
  LIKE_ESCAPE_CLAUSE as LIKE,
  likeContains,
  digitsOnlyLikeContains,
  digitsOnlyColumn,
} from './like.js';
import { getDb } from '../db/client.js';
import type { CandidateProfileRow, EmployerProfileRow, JobRow, Row } from '../db/rows.js';
import {
  nowIso,
  SORT_DIRECTIONS,
  REVIEW_STATUS_PRIORITY,
  JOB_STATUS_PRIORITY,
  UNKNOWN_STATUS_PRIORITY,
  type SortDirection,
} from '@bktc/shared';

/**
 * Builds a deterministic `CASE <column> WHEN 'X' THEN 1 ... ELSE 99 END`
 * fragment from a priority map, so the queue's ORDER BY always ranks
 * "needs a decision" above "already resolved" above "rejected" — regardless
 * of which column a caller also asked to sort by. Status values only ever
 * come from the fixed enum maps below, never from request input, so this is
 * safe to inline directly into the SQL string.
 */
function statusPriorityCase(column: string, priority: Record<string, number>): string {
  const cases = Object.entries(priority)
    .map(([status, rank]) => `WHEN '${status}' THEN ${rank}`)
    .join(' ');
  return `CASE ${column} ${cases} ELSE ${UNKNOWN_STATUS_PRIORITY} END`;
}

const CANDIDATE_STATUS_PRIORITY_SQL = statusPriorityCase('cp.profile_status', REVIEW_STATUS_PRIORITY);
const EMPLOYER_STATUS_PRIORITY_SQL = statusPriorityCase('ep.account_status', REVIEW_STATUS_PRIORITY);
const JOB_STATUS_PRIORITY_SQL = statusPriorityCase('j.status', JOB_STATUS_PRIORITY);

// ---------------------------------------------------------------------------
// Sort allowlists
//
// ORDER BY cannot be parameterised. These maps are the only values that ever
// reach the SQL string; anything else is a 400. Note what is deliberately
// ABSENT: expected_salary_min, current_salary, salary_band_min. Allowing a sort
// on a hidden column leaks its ordering even though the serializer strips the
// value — an employer could binary-search a candidate's expectations.
// ---------------------------------------------------------------------------

const CANDIDATE_SORTS = {
  submitted: 'cp.submitted_at',
  name: 'cp.full_name',
  experience: 'cp.years_of_experience',
  completion: 'cp.completion_percent',
  created: 'cp.created_at',
} as const;

const EMPLOYER_SORTS = {
  created: 'ep.created_at',
  company: 'ep.company_name',
} as const;

const JOB_SORTS = {
  created: 'j.created_at',
  updated: 'j.updated_at',
  title: 'j.title',
} as const;

export type CandidateSortKey = keyof typeof CANDIDATE_SORTS;
export type EmployerSortKey = keyof typeof EMPLOYER_SORTS;
export type AdminJobSortKey = keyof typeof JOB_SORTS;

export const isCandidateSort = (v: unknown): v is CandidateSortKey =>
  typeof v === 'string' && v in CANDIDATE_SORTS;
export const isEmployerSort = (v: unknown): v is EmployerSortKey =>
  typeof v === 'string' && v in EMPLOYER_SORTS;
export const isAdminJobSort = (v: unknown): v is AdminJobSortKey =>
  typeof v === 'string' && v in JOB_SORTS;
export const isSortDirection = (v: unknown): v is SortDirection =>
  typeof v === 'string' && (SORT_DIRECTIONS as readonly string[]).includes(v);

export interface QueueOptions {
  readonly status?: string | undefined;
  readonly search?: string | undefined;
  readonly sort?: string | undefined;
  readonly dir?: SortDirection | undefined;
  readonly limit: number;
  readonly offset: number;
}

function direction(dir: SortDirection | undefined): string {
  return dir === 'ASC' ? 'ASC' : 'DESC';
}

// ---------------------------------------------------------------------------
// Candidate queue
// ---------------------------------------------------------------------------

export interface CandidateQueueRow {
  readonly profile: Row<CandidateProfileRow>;
  readonly email: string;
  readonly userStatus: string;
}

export function listCandidates(options: QueueOptions): {
  rows: CandidateQueueRow[];
  total: number;
} {
  const where = ['cp.deleted_at IS NULL', 'u.deleted_at IS NULL'];
  const params: unknown[] = [];

  if (options.status) {
    where.push('cp.profile_status = ?');
    params.push(options.status);
  }
  if (options.search) {
    const digits = digitsOnlyLikeContains(options.search);
    const hasDigits = digits !== '%%';
    const term = likeContains(options.search);
    if (hasDigits) {
      where.push(
        `(cp.full_name LIKE ? ${LIKE} OR u.email LIKE ? ${LIKE} OR ${digitsOnlyColumn('cp.mobile')} LIKE ?)`,
      );
      params.push(term, term, digits);
    } else {
      where.push(`(cp.full_name LIKE ? ${LIKE} OR u.email LIKE ? ${LIKE})`);
      params.push(term, term);
    }
  }
  const whereSql = where.join(' AND ');
  const column = CANDIDATE_SORTS[(options.sort as CandidateSortKey) ?? 'submitted'];

  const total = (
    getDb()
      .prepare(
        `SELECT count(*) AS n FROM candidate_profile cp JOIN user u ON u.id = cp.user_id WHERE ${whereSql}`,
      )
      .get(...params) as { n: number }
  ).n;

  const rows = getDb()
    .prepare(
      `SELECT cp.*, u.email AS _email, u.status AS _user_status
       FROM candidate_profile cp
       JOIN user u ON u.id = cp.user_id
       WHERE ${whereSql}
       ORDER BY ${CANDIDATE_STATUS_PRIORITY_SQL} ASC, ${column} ${direction(options.dir)}, cp.id DESC
       LIMIT ? OFFSET ?`,
    )
    .all(...params, options.limit, options.offset) as (CandidateProfileRow & {
    _email: string;
    _user_status: string;
  })[];

  return {
    rows: rows.map((row) => ({
      profile: row as Row<CandidateProfileRow>,
      email: row._email,
      userStatus: row._user_status,
    })),
    total,
  };
}

/** Approve / request changes / reject, conditional on the current status. */
export function reviewCandidate(
  profileId: string,
  next: string,
  expectedCurrent: readonly string[],
  reviewerId: string,
  note: string | null,
): boolean {
  const placeholders = expectedCurrent.map(() => '?').join(', ');
  const result = getDb()
    .prepare(
      `UPDATE candidate_profile
       SET profile_status = ?, reviewed_at = ?, reviewed_by_id = ?, review_note = ?, updated_at = ?
       WHERE id = ? AND profile_status IN (${placeholders}) AND deleted_at IS NULL`,
    )
    .run(next, nowIso(), reviewerId, note, nowIso(), profileId, ...expectedCurrent);
  return result.changes === 1;
}

/** Snapshot taken on approval, so a later re-review can show what changed (D2). */
export function snapshotCandidate(profileId: string): void {
  const db = getDb();
  const profile = db
    .prepare('SELECT * FROM candidate_profile WHERE id = ?')
    .get(profileId) as CandidateProfileRow | undefined;
  if (!profile) return;

  const skills = db
    .prepare(
      `SELECT s.name FROM candidate_skill cs JOIN skill s ON s.id = cs.skill_id
       WHERE cs.candidate_profile_id = ? ORDER BY s.name`,
    )
    .all(profileId) as { name: string }[];

  const snapshot = {
    careerSummary: profile.career_summary,
    yearsOfExperience: profile.years_of_experience,
    sectorId: profile.sector_id,
    functionalAreaId: profile.functional_area_id,
    educationLevel: profile.education_level,
    qualification: profile.qualification,
    currentJobTitle: profile.current_job_title,
    resumeFileId: profile.resume_file_id,
    skills: skills.map((s) => s.name),
  };

  db.prepare('UPDATE candidate_profile SET last_approved_snapshot = ? WHERE id = ?').run(
    JSON.stringify(snapshot),
    profileId,
  );
}

// ---------------------------------------------------------------------------
// Employer queue
// ---------------------------------------------------------------------------

export interface EmployerQueueRow {
  readonly profile: Row<EmployerProfileRow>;
  readonly email: string;
  readonly userStatus: string;
  readonly jobCount: number;
}

export function listEmployers(options: QueueOptions): { rows: EmployerQueueRow[]; total: number } {
  const where = ['ep.deleted_at IS NULL', 'u.deleted_at IS NULL'];
  const params: unknown[] = [];

  if (options.status) {
    where.push('ep.account_status = ?');
    params.push(options.status);
  }
  if (options.search) {
    const digits = digitsOnlyLikeContains(options.search);
    const hasDigits = digits !== '%%';
    const term = likeContains(options.search);
    if (hasDigits) {
      where.push(
        `(ep.company_name LIKE ? ${LIKE} OR u.email LIKE ? ${LIKE} OR ${digitsOnlyColumn('ep.hr_contact_phone')} LIKE ?)`,
      );
      params.push(term, term, digits);
    } else {
      where.push(`(ep.company_name LIKE ? ${LIKE} OR u.email LIKE ? ${LIKE})`);
      params.push(term, term);
    }
  }
  const whereSql = where.join(' AND ');
  const column = EMPLOYER_SORTS[(options.sort as EmployerSortKey) ?? 'created'];

  const total = (
    getDb()
      .prepare(
        `SELECT count(*) AS n FROM employer_profile ep JOIN user u ON u.id = ep.user_id WHERE ${whereSql}`,
      )
      .get(...params) as { n: number }
  ).n;

  const rows = getDb()
    .prepare(
      `SELECT ep.*, u.email AS _email, u.status AS _user_status,
              (SELECT count(*) FROM job j WHERE j.employer_profile_id = ep.id AND j.deleted_at IS NULL) AS _job_count
       FROM employer_profile ep
       JOIN user u ON u.id = ep.user_id
       WHERE ${whereSql}
       ORDER BY ${EMPLOYER_STATUS_PRIORITY_SQL} ASC, ${column} ${direction(options.dir)}, ep.id DESC
       LIMIT ? OFFSET ?`,
    )
    .all(...params, options.limit, options.offset) as (EmployerProfileRow & {
    _email: string;
    _user_status: string;
    _job_count: number;
  })[];

  return {
    rows: rows.map((row) => ({
      profile: row as Row<EmployerProfileRow>,
      email: row._email,
      userStatus: row._user_status,
      jobCount: row._job_count,
    })),
    total,
  };
}

export function reviewEmployer(
  profileId: string,
  next: string,
  expectedCurrent: readonly string[],
  reviewerId: string,
  note: string | null,
): boolean {
  const placeholders = expectedCurrent.map(() => '?').join(', ');
  const result = getDb()
    .prepare(
      `UPDATE employer_profile
       SET account_status = ?, reviewed_at = ?, reviewed_by_id = ?, review_note = ?, updated_at = ?
       WHERE id = ? AND account_status IN (${placeholders}) AND deleted_at IS NULL`,
    )
    .run(next, nowIso(), reviewerId, note, nowIso(), profileId, ...expectedCurrent);
  return result.changes === 1;
}

// ---------------------------------------------------------------------------
// Job queue
// ---------------------------------------------------------------------------

export function listJobs(options: QueueOptions): { rows: Row<JobRow>[]; total: number } {
  const where = ['j.deleted_at IS NULL'];
  const params: unknown[] = [];

  if (options.status) {
    where.push('j.status = ?');
    params.push(options.status);
  }
  if (options.search) {
    where.push(`(j.title LIKE ? ${LIKE} OR ep.company_name LIKE ? ${LIKE})`);
    const term = likeContains(options.search);
    params.push(term, term);
  }
  const whereSql = where.join(' AND ');
  const column = JOB_SORTS[(options.sort as AdminJobSortKey) ?? 'updated'];

  const total = (
    getDb()
      .prepare(
        `SELECT count(*) AS n FROM job j
         JOIN employer_profile ep ON ep.id = j.employer_profile_id
         WHERE ${whereSql}`,
      )
      .get(...params) as { n: number }
  ).n;

  const rows = getDb()
    .prepare(
      `SELECT j.* FROM job j
       JOIN employer_profile ep ON ep.id = j.employer_profile_id
       WHERE ${whereSql}
       ORDER BY ${JOB_STATUS_PRIORITY_SQL} ASC, ${column} ${direction(options.dir)}, j.id DESC
       LIMIT ? OFFSET ?`,
    )
    .all(...params, options.limit, options.offset) as Row<JobRow>[];

  return { rows, total };
}

export function reviewJob(
  jobId: string,
  next: string,
  expectedCurrent: readonly string[],
  reviewerId: string,
  note: string | null,
  publishedAt: string | null,
): boolean {
  const placeholders = expectedCurrent.map(() => '?').join(', ');
  const result = getDb()
    .prepare(
      `UPDATE job
       SET status = ?, reviewed_at = ?, reviewed_by_id = ?, review_note = ?, published_at = ?, updated_at = ?
       WHERE id = ? AND status IN (${placeholders}) AND deleted_at IS NULL`,
    )
    .run(next, nowIso(), reviewerId, note, publishedAt, nowIso(), jobId, ...expectedCurrent);
  return result.changes === 1;
}

// ---------------------------------------------------------------------------
// Stats
// ---------------------------------------------------------------------------

/**
 * A `type`, not an `interface` — response DTOs must satisfy the Serialized
 * constraint in lib/respond.ts, and TypeScript withholds the implicit index
 * signature from interfaces. Same convention as packages/shared/src/api.ts.
 */
export type PlatformStats = {
  readonly candidates: { total: number; pending: number; approved: number };
  readonly employers: { total: number; pending: number; approved: number };
  readonly jobs: { total: number; pending: number; live: number };
  /** Named in the Phased Plan's "simple stats" alongside the other three. */
  readonly applications: { total: number; active: number };
  readonly enquiries: { unhandled: number };
};

export function stats(): PlatformStats {
  const db = getDb();
  const one = (sql: string, ...params: unknown[]) =>
    (db.prepare(sql).get(...params) as { n: number }).n;

  return {
    candidates: {
      total: one('SELECT count(*) AS n FROM candidate_profile WHERE deleted_at IS NULL'),
      pending: one(
        "SELECT count(*) AS n FROM candidate_profile WHERE profile_status = 'SUBMITTED' AND deleted_at IS NULL",
      ),
      approved: one(
        "SELECT count(*) AS n FROM candidate_profile WHERE profile_status = 'APPROVED' AND deleted_at IS NULL",
      ),
    },
    employers: {
      total: one('SELECT count(*) AS n FROM employer_profile WHERE deleted_at IS NULL'),
      pending: one(
        "SELECT count(*) AS n FROM employer_profile WHERE account_status = 'SUBMITTED' AND deleted_at IS NULL",
      ),
      approved: one(
        "SELECT count(*) AS n FROM employer_profile WHERE account_status = 'APPROVED' AND deleted_at IS NULL",
      ),
    },
    jobs: {
      total: one('SELECT count(*) AS n FROM job WHERE deleted_at IS NULL'),
      pending: one("SELECT count(*) AS n FROM job WHERE status = 'PENDING_APPROVAL' AND deleted_at IS NULL"),
      live: one("SELECT count(*) AS n FROM job WHERE status = 'APPROVED' AND deleted_at IS NULL"),
    },
    applications: {
      total: one('SELECT count(*) AS n FROM application'),
      active: one(
        `SELECT count(*) AS n FROM application
         WHERE stage NOT IN ('NOT_SELECTED','WITHDRAWN','OFFER_DECLINED','JOINED')`,
      ),
    },
    enquiries: {
      unhandled: one('SELECT count(*) AS n FROM contact_enquiry WHERE handled_at IS NULL'),
    },
  };
}
