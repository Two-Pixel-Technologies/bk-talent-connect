/**
 * Candidate profile data access.
 */

import { getDb } from '../db/client.js';
import type { CandidateProfileRow, CandidateExperienceRow, Row } from '../db/rows.js';
import { newId } from '../lib/ids.js';
import { nowIso } from '@bktc/shared';

export function findByUserId(userId: string): Row<CandidateProfileRow> | undefined {
  return getDb()
    .prepare('SELECT * FROM candidate_profile WHERE user_id = ? AND deleted_at IS NULL')
    .get(userId) as Row<CandidateProfileRow> | undefined;
}

export function findById(id: string): Row<CandidateProfileRow> | undefined {
  return getDb()
    .prepare('SELECT * FROM candidate_profile WHERE id = ? AND deleted_at IS NULL')
    .get(id) as Row<CandidateProfileRow> | undefined;
}

/**
 * Including erased profiles.
 *
 * An erasure soft-deletes the candidate row, but the employer's APPLICATION
 * survives by design — so every employer screen that loads the candidate
 * behind an application has to cope with the row being a tombstone. Using the
 * filtered lookup with a non-null assertion produced a 500 *after* the stage
 * change had already committed: the employer saw "something went wrong" and
 * had no way to know their action had taken effect.
 *
 * The row it returns carries no personal data — erasure overwrote all of it.
 */
export function findByIdIncludingDeleted(id: string): Row<CandidateProfileRow> | undefined {
  return getDb()
    .prepare('SELECT * FROM candidate_profile WHERE id = ?')
    .get(id) as Row<CandidateProfileRow> | undefined;
}

export interface CreateCandidateInput {
  readonly userId: string;
  readonly fullName: string;
  readonly mobile: string;
  readonly consentVersion: string;
}

export function create(input: CreateCandidateInput): string {
  const id = newId();
  const now = nowIso();
  getDb()
    .prepare(
      `INSERT INTO candidate_profile
         (id, user_id, full_name, mobile, profile_status, completion_percent,
          consented_at, consent_version, last_active_at, created_at, updated_at)
       VALUES (?, ?, ?, ?, 'DRAFT', 0, ?, ?, ?, ?, ?)`,
    )
    .run(id, input.userId, input.fullName, input.mobile, now, input.consentVersion, now, now, now);
  return id;
}

export function touchActivity(profileId: string): void {
  getDb().prepare('UPDATE candidate_profile SET last_active_at = ? WHERE id = ?').run(nowIso(), profileId);
}

/** Column names that may be written by the profile update path. */
const UPDATABLE_COLUMNS = new Set([
  'full_name',
  'mobile',
  'city_id',
  'state',
  'open_to_relocation',
  'current_job_title',
  'current_employer',
  'years_of_experience',
  'sector_id',
  'functional_area_id',
  'education_level',
  'qualification',
  'qualification_year',
  'career_summary',
  'notice_period',
  'employment_preference',
  'current_salary',
  'expected_salary_min',
  'expected_salary_max',
  'linkedin_url',
  'resume_file_id',
  'completion_percent',
]);

/**
 * Column names are checked against an allowlist rather than interpolated
 * directly. Everything reaching SQL by name gets this treatment — it is the one
 * place hand-written SQL is genuinely dangerous.
 */
export function updateFields(profileId: string, patch: Record<string, unknown>): void {
  const entries = Object.entries(patch).filter(([column]) => UPDATABLE_COLUMNS.has(column));
  if (entries.length === 0) return;

  const assignments = entries.map(([column]) => `${column} = ?`).join(', ');
  const values = entries.map(([, value]) => value as never);

  getDb()
    .prepare(`UPDATE candidate_profile SET ${assignments}, updated_at = ? WHERE id = ?`)
    .run(...values, nowIso(), profileId);
}

export function setStatus(
  profileId: string,
  status: string,
  extra: { submittedAt?: string | null } = {},
): void {
  const db = getDb();
  if (extra.submittedAt !== undefined) {
    db.prepare(
      'UPDATE candidate_profile SET profile_status = ?, submitted_at = ?, updated_at = ? WHERE id = ?',
    ).run(status, extra.submittedAt, nowIso(), profileId);
  } else {
    db.prepare('UPDATE candidate_profile SET profile_status = ?, updated_at = ? WHERE id = ?').run(
      status,
      nowIso(),
      profileId,
    );
  }
}

// --- Skills ---------------------------------------------------------------

export function listSkillIds(profileId: string): number[] {
  const rows = getDb()
    .prepare('SELECT skill_id FROM candidate_skill WHERE candidate_profile_id = ?')
    .all(profileId) as { skill_id: number }[];
  return rows.map((r) => r.skill_id);
}

export function replaceSkills(profileId: string, skillIds: readonly number[]): void {
  const db = getDb();
  db.prepare('DELETE FROM candidate_skill WHERE candidate_profile_id = ?').run(profileId);
  const insert = db.prepare(
    'INSERT OR IGNORE INTO candidate_skill (candidate_profile_id, skill_id) VALUES (?, ?)',
  );
  for (const id of skillIds) insert.run(profileId, id);
}

// --- Experience -----------------------------------------------------------

export function listExperiences(profileId: string): Row<CandidateExperienceRow>[] {
  return getDb()
    .prepare(
      'SELECT * FROM candidate_experience WHERE candidate_profile_id = ? ORDER BY sort_order, start_year DESC',
    )
    .all(profileId) as Row<CandidateExperienceRow>[];
}

export interface ExperienceRecord {
  readonly company: string;
  readonly title: string;
  readonly startYear: number;
  readonly endYear: number | null;
  readonly isCurrent: boolean;
  readonly domainTags: readonly string[];
  readonly keyAchievement: string | null;
}

export function replaceExperiences(profileId: string, rows: readonly ExperienceRecord[]): void {
  const db = getDb();
  db.prepare('DELETE FROM candidate_experience WHERE candidate_profile_id = ?').run(profileId);
  const insert = db.prepare(
    `INSERT INTO candidate_experience
       (id, candidate_profile_id, company, title, start_year, end_year, is_current, domain_tags, key_achievement, sort_order)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  );
  rows.forEach((row, index) => {
    insert.run(
      newId(),
      profileId,
      row.company,
      row.title,
      row.startYear,
      row.endYear,
      row.isCurrent ? 1 : 0,
      JSON.stringify(row.domainTags),
      row.keyAchievement,
      index,
    );
  });
}

