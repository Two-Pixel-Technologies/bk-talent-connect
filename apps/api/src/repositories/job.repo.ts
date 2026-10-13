/**
 * Job data access.
 */

import { LIKE_ESCAPE_CLAUSE as LIKE, likeContains } from './like.js';
import { getDb } from '../db/client.js';
import type { JobRow, JobLocationRow, JobSkillRow, Row } from '../db/rows.js';
import { newId } from '../lib/ids.js';
import { nowIso, SORT_DIRECTIONS, type SortDirection } from '@bktc/shared';

export function findById(id: string): Row<JobRow> | undefined {
  return getDb().prepare('SELECT * FROM job WHERE id = ? AND deleted_at IS NULL').get(id) as
    | Row<JobRow>
    | undefined;
}

export function create(employerProfileId: string, title: string): string {
  const id = newId();
  const now = nowIso();
  getDb()
    .prepare(
      `INSERT INTO job (id, employer_profile_id, title, number_of_positions, status, created_at, updated_at)
       VALUES (?, ?, ?, 1, 'DRAFT', ?, ?)`,
    )
    .run(id, employerProfileId, title, now, now);
  return id;
}

/**
 * Sort keys are an allowlist, never the raw query parameter.
 *
 * ORDER BY cannot be parameterised, so interpolating a user-supplied value here
 * would be direct SQL injection into a table holding confidential salary bands.
 * `id` is always the final tiebreak — SQLite gives no ordering guarantee for
 * ties, so without it paginated results can repeat or skip rows.
 */
const JOB_SORTS = {
  created: 'j.created_at',
  updated: 'j.updated_at',
  title: 'j.title',
  status: 'j.status',
  published: 'j.published_at',
} as const;
export type JobSortKey = keyof typeof JOB_SORTS;

export function isJobSortKey(value: unknown): value is JobSortKey {
  return typeof value === 'string' && value in JOB_SORTS;
}

export function isSortDirection(value: unknown): value is SortDirection {
  return typeof value === 'string' && (SORT_DIRECTIONS as readonly string[]).includes(value);
}

export interface ListJobsOptions {
  readonly employerProfileId: string;
  readonly status?: string | undefined;
  readonly sort?: JobSortKey | undefined;
  readonly dir?: SortDirection | undefined;
  readonly limit: number;
  readonly offset: number;
}

export function listForEmployer(options: ListJobsOptions): { rows: Row<JobRow>[]; total: number } {
  const column = JOB_SORTS[options.sort ?? 'created'];
  const direction = options.dir === 'ASC' ? 'ASC' : 'DESC';

  const where = ['j.employer_profile_id = ?', 'j.deleted_at IS NULL'];
  const params: unknown[] = [options.employerProfileId];
  if (options.status) {
    where.push('j.status = ?');
    params.push(options.status);
  }
  const whereSql = where.join(' AND ');

  const total = (
    getDb()
      .prepare(`SELECT count(*) AS n FROM job j WHERE ${whereSql}`)
      .get(...params) as { n: number }
  ).n;

  const rows = getDb()
    .prepare(
      `SELECT * FROM job j
       WHERE ${whereSql}
       ORDER BY ${column} ${direction}, j.id DESC
       LIMIT ? OFFSET ?`,
    )
    .all(...params, options.limit, options.offset) as Row<JobRow>[];

  return { rows, total };
}

export function countForEmployer(employerProfileId: string): Record<string, number> {
  const rows = getDb()
    .prepare(
      `SELECT status, count(*) AS n FROM job
       WHERE employer_profile_id = ? AND deleted_at IS NULL
       GROUP BY status`,
    )
    .all(employerProfileId) as { status: string; n: number }[];
  return Object.fromEntries(rows.map((r) => [r.status, r.n]));
}

const UPDATABLE_COLUMNS = new Set([
  'title',
  'department',
  'number_of_positions',
  'sector_id',
  'functional_area_id',
  'city_id',
  'state',
  'work_type',
  'min_experience',
  'max_experience',
  'education_requirement',
  'description',
  'target_joining_date',
  'salary_band_min',
  'salary_band_max',
  'contact_flags',
  'last_approved_snapshot',
]);

export function updateFields(jobId: string, patch: Record<string, unknown>): void {
  const entries = Object.entries(patch).filter(([column]) => UPDATABLE_COLUMNS.has(column));
  if (entries.length === 0) return;

  const assignments = entries.map(([column]) => `${column} = ?`).join(', ');
  const values = entries.map(([, value]) => value as never);

  getDb()
    .prepare(`UPDATE job SET ${assignments}, updated_at = ? WHERE id = ?`)
    .run(...values, nowIso(), jobId);
}

/**
 * Conditional status change. The expected-current set is part of the WHERE
 * clause, so two people acting at once cannot both succeed — the second gets
 * changes === 0 and the caller turns that into a 409.
 */
export function setStatus(
  jobId: string,
  next: string,
  expectedCurrent: readonly string[],
  extra: { publishedAt?: string | null; closedAt?: string | null } = {},
): boolean {
  const placeholders = expectedCurrent.map(() => '?').join(', ');
  const sets = ['status = ?', 'updated_at = ?'];
  const values: unknown[] = [next, nowIso()];

  if (extra.publishedAt !== undefined) {
    sets.push('published_at = ?');
    values.push(extra.publishedAt);
  }
  if (extra.closedAt !== undefined) {
    sets.push('closed_at = ?');
    values.push(extra.closedAt);
  }

  const result = getDb()
    .prepare(
      `UPDATE job SET ${sets.join(', ')}
       WHERE id = ? AND status IN (${placeholders}) AND deleted_at IS NULL`,
    )
    .run(...values, jobId, ...expectedCurrent);

  return result.changes === 1;
}

// --- Browsing -------------------------------------------------------------

/**
 * Sort allowlist for the candidate/public job list. Deliberately excludes
 * anything derived from the salary band — the serializer strips the values, but
 * sorting by them would leak their ordering.
 */
const BROWSE_SORTS = {
  recent: 'j.published_at',
  experience: 'j.min_experience',
  title: 'j.title',
} as const;
export type BrowseSortKey = keyof typeof BROWSE_SORTS;

export const isBrowseSort = (v: unknown): v is BrowseSortKey =>
  typeof v === 'string' && v in BROWSE_SORTS;

export interface BrowseOptions {
  readonly sectorSlug?: string | undefined;
  readonly functionSlug?: string | undefined;
  readonly citySlug?: string | undefined;
  readonly minExperience?: number | undefined;
  readonly search?: string | undefined;
  readonly sort?: BrowseSortKey | undefined;
  readonly dir?: SortDirection | undefined;
  readonly limit: number;
  readonly offset: number;
}

/**
 * Live jobs only. The status filter is applied here in the repository rather
 * than being left to callers — a caller who forgets it would expose drafts and
 * rejected postings to candidates.
 */
export function browseLive(options: BrowseOptions): { rows: Row<JobRow>[]; total: number } {
  const where = [
    "j.status = 'APPROVED'",
    'j.deleted_at IS NULL',
    // The employer must still be verified and active. Belt and braces alongside
    // the suspension cascade in admin.service.
    "ep.account_status = 'APPROVED'",
    "u.status = 'ACTIVE'",
  ];
  const params: unknown[] = [];

  if (options.sectorSlug) {
    where.push('j.sector_id = (SELECT id FROM sector WHERE slug = ?)');
    params.push(options.sectorSlug);
  }
  if (options.functionSlug) {
    where.push('j.functional_area_id = (SELECT id FROM functional_area WHERE slug = ?)');
    params.push(options.functionSlug);
  }
  if (options.citySlug) {
    // Matches the primary location OR any of the job's extra locations —
    // a candidate filtering by city should see every job hiring there, not
    // only the ones where that city happens to be the first one listed.
    where.push(
      `(j.city_id = (SELECT id FROM city WHERE slug = ?)
        OR EXISTS (
          SELECT 1 FROM job_location jl
          WHERE jl.job_id = j.id AND jl.city_id = (SELECT id FROM city WHERE slug = ?)
        ))`,
    );
    params.push(options.citySlug, options.citySlug);
  }
  if (options.minExperience !== undefined) {
    // A candidate with N years should see roles whose range includes them.
    where.push('(j.min_experience IS NULL OR j.min_experience <= ?)');
    params.push(options.minExperience);
  }
  if (options.search) {
    where.push(`(j.title LIKE ? ${LIKE} OR j.description LIKE ? ${LIKE})`);
    const term = likeContains(options.search);
    params.push(term, term);
  }

  const whereSql = where.join(' AND ');
  const column = BROWSE_SORTS[options.sort ?? 'recent'];
  const dir = options.dir === 'ASC' ? 'ASC' : 'DESC';

  const joins = `
    JOIN employer_profile ep ON ep.id = j.employer_profile_id
    JOIN user u ON u.id = ep.user_id`;

  const total = (
    getDb()
      .prepare(`SELECT count(*) AS n FROM job j ${joins} WHERE ${whereSql}`)
      .get(...params) as { n: number }
  ).n;

  const rows = getDb()
    .prepare(
      `SELECT j.* FROM job j ${joins} WHERE ${whereSql}
       ORDER BY ${column} ${dir}, j.id DESC
       LIMIT ? OFFSET ?`,
    )
    .all(...params, options.limit, options.offset) as Row<JobRow>[];

  return { rows, total };
}

/** A single live job. Returns undefined for anything not publicly visible. */
export function findLiveById(id: string): Row<JobRow> | undefined {
  return getDb()
    .prepare(
      `SELECT j.* FROM job j
       JOIN employer_profile ep ON ep.id = j.employer_profile_id
       JOIN user u ON u.id = ep.user_id
       WHERE j.id = ? AND j.status = 'APPROVED' AND j.deleted_at IS NULL
         AND ep.account_status = 'APPROVED' AND u.status = 'ACTIVE'`,
    )
    .get(id) as Row<JobRow> | undefined;
}

/** Unpublishes every live job for an employer. Used by the suspension cascade. */
export function unpublishAllForEmployer(employerProfileId: string): string[] {
  const db = getDb();
  const live = db
    .prepare("SELECT id FROM job WHERE employer_profile_id = ? AND status = 'APPROVED'")
    .all(employerProfileId) as { id: string }[];

  const update = db.prepare(
    "UPDATE job SET status = 'PENDING_APPROVAL', published_at = NULL, updated_at = ? WHERE id = ?",
  );
  for (const row of live) update.run(nowIso(), row.id);
  return live.map((r) => r.id);
}

/**
 * Postings a suspension could have taken down — and only those.
 *
 * The discriminator is the status. Suspending an employer sets their live jobs
 * to PENDING_APPROVAL (see unpublishAllForEmployer); an employer closing a job
 * themselves sets CLOSED. Both write the same JOB_CLOSED outcome code on the
 * applications, so without this filter reactivating an account also
 * resurrected applicants from roles the employer had genuinely closed.
 */
export function listSuspendableIdsForEmployer(employerProfileId: string): string[] {
  const rows = getDb()
    .prepare(
      `SELECT id FROM job
        WHERE employer_profile_id = ?
          AND deleted_at IS NULL
          AND status NOT IN ('CLOSED', 'FILLED')`,
    )
    .all(employerProfileId) as { id: string }[];
  return rows.map((r) => r.id);
}

// --- Additional hiring locations -------------------------------------------
//
// The primary location stays on job.city_id/job.state, unchanged — this
// table only ever holds the EXTRA locations an employer adds beyond that
// one. Same replace-all pattern as replaceSkills below: delete then insert,
// inside the caller's transaction.

export function listAdditionalLocations(jobId: string): Row<JobLocationRow>[] {
  return getDb()
    .prepare('SELECT * FROM job_location WHERE job_id = ? ORDER BY sort_order')
    .all(jobId) as Row<JobLocationRow>[];
}

export function replaceAdditionalLocations(
  jobId: string,
  locations: readonly { cityId: number | null; state: string }[],
): void {
  const db = getDb();
  db.prepare('DELETE FROM job_location WHERE job_id = ?').run(jobId);
  const insert = db.prepare(
    'INSERT INTO job_location (id, job_id, city_id, state, sort_order, created_at) VALUES (?, ?, ?, ?, ?, ?)',
  );
  const now = nowIso();
  locations.forEach((loc, index) => {
    insert.run(newId(), jobId, loc.cityId, loc.state, index, now);
  });
}

// --- Skills ---------------------------------------------------------------

export function listSkills(jobId: string): Row<JobSkillRow>[] {
  return getDb().prepare('SELECT * FROM job_skill WHERE job_id = ?').all(jobId) as Row<JobSkillRow>[];
}

export function replaceSkills(
  jobId: string,
  requirement: 'REQUIRED' | 'GOOD_TO_HAVE',
  skillIds: readonly number[],
): void {
  const db = getDb();
  db.prepare('DELETE FROM job_skill WHERE job_id = ? AND requirement = ?').run(jobId, requirement);
  const insert = db.prepare(
    'INSERT OR IGNORE INTO job_skill (job_id, skill_id, requirement) VALUES (?, ?, ?)',
  );
  for (const id of skillIds) insert.run(jobId, id, requirement);
}
