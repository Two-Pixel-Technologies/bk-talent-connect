/**
 * Lookup tables: sectors, functional areas, cities, skills.
 */

import { LIKE_ESCAPE_CLAUSE as LIKE, likeContains } from './like.js';
import { getDb } from '../db/client.js';
import type { TaxonomyRow, CityRow, SkillRow, Row } from '../db/rows.js';
import { nowIso, normaliseSkillSlug, isUnusableSkillName } from '@bktc/shared';
import { badRequest } from '../lib/errors.js';

/**
 * Table names reach SQL by interpolation because they cannot be parameterised.
 * This union type is the allowlist — every call site is checked by the
 * compiler, and no value from a request ever reaches these functions.
 */
type TaxonomyTable = 'sector' | 'functional_area' | 'city';

export function listActive(table: TaxonomyTable): Row<TaxonomyRow>[] {
  return getDb()
    .prepare(`SELECT * FROM ${table} WHERE is_active = 1 ORDER BY sort_order, name`)
    .all() as Row<TaxonomyRow>[];
}

/** Cities with their state, ordered so the UI can group or filter by state. */
export function listActiveCities(): Row<CityRow>[] {
  return getDb()
    .prepare(
      `SELECT * FROM city
       WHERE is_active = 1
       ORDER BY CASE WHEN state IS NULL THEN 1 ELSE 0 END, state, sort_order, name`,
    )
    .all() as Row<CityRow>[];
}

export function findBySlug(table: TaxonomyTable, slug: string): Row<TaxonomyRow> | undefined {
  return getDb().prepare(`SELECT * FROM ${table} WHERE slug = ?`).get(slug) as
    | Row<TaxonomyRow>
    | undefined;
}

const TABLE_LABEL: Record<TaxonomyTable, string> = {
  sector: 'sector',
  functional_area: 'function',
  city: 'city',
};

/**
 * An empty slug clears the field; an UNKNOWN slug is an error.
 *
 * Returning null for both meant a typo silently wiped the value and answered
 * 200 — which could publish a live job with no sector, and sector is the
 * contract's hard elimination filter.
 */
export function idBySlug(table: TaxonomyTable, slug: string | undefined): number | null {
  if (slug === undefined || slug === '') return null;
  const row = findBySlug(table, slug);
  if (!row) throw badRequest(`"${slug}" is not a ${TABLE_LABEL[table]} we recognise.`);
  return row.id;
}

export function slugById(table: TaxonomyTable, id: number | null): string | null {
  if (id == null) return null;
  const row = getDb().prepare(`SELECT slug FROM ${table} WHERE id = ?`).get(id) as
    | { slug: string }
    | undefined;
  return row?.slug ?? null;
}

export function nameById(table: TaxonomyTable, id: number | null): string | null {
  if (id == null) return null;
  const row = getDb().prepare(`SELECT name FROM ${table} WHERE id = ?`).get(id) as
    | { name: string }
    | undefined;
  return row?.name ?? null;
}

/** Every entry including inactive ones — the admin needs to see both. */
export function listAll(table: TaxonomyTable): Row<TaxonomyRow>[] {
  return getDb()
    .prepare(`SELECT * FROM ${table} ORDER BY is_active DESC, sort_order, name`)
    .all() as Row<TaxonomyRow>[];
}

export function createTaxonomyEntry(table: TaxonomyTable, slug: string, name: string): number {
  const next = (
    getDb().prepare(`SELECT COALESCE(MAX(sort_order), 0) + 1 AS n FROM ${table}`).get() as {
      n: number;
    }
  ).n;
  const result = getDb()
    .prepare(`INSERT INTO ${table} (slug, name, sort_order, is_active) VALUES (?, ?, ?, 1)`)
    .run(slug, name, next);
  return Number(result.lastInsertRowid);
}

/**
 * Entries are deactivated, never deleted — candidates and jobs already point at
 * them and a hard delete would break the foreign key.
 */
export function updateTaxonomyEntry(
  table: TaxonomyTable,
  id: number,
  input: { name?: string | undefined; isActive?: boolean | undefined },
): boolean {
  const sets: string[] = [];
  const values: unknown[] = [];
  if (input.name !== undefined) {
    sets.push('name = ?');
    values.push(input.name);
  }
  if (input.isActive !== undefined) {
    sets.push('is_active = ?');
    values.push(input.isActive ? 1 : 0);
  }
  if (sets.length === 0) return true;
  // Reports whether a row was actually touched. Discarding this meant every
  // one of these endpoints returned 204 for an id that does not exist, so an
  // admin clicking a stale row was told it worked.
  const result = getDb()
    .prepare(`UPDATE ${table} SET ${sets.join(', ')} WHERE id = ?`)
    .run(...values, id);
  return result.changes === 1;
}

// ---------------------------------------------------------------------------
// Skills
// ---------------------------------------------------------------------------

/**
 * Autocomplete source. Only approved skills are suggested: auto-created ones
 * stay invisible until an admin accepts them, so one account cannot pollute the
 * taxonomy every other candidate and employer picks from.
 */
export function searchApprovedSkills(query: string, limit = 12): Row<SkillRow>[] {
  const term = likeContains(query.toLowerCase());
  return getDb()
    .prepare(
      `SELECT * FROM skill
       WHERE is_approved = 1 AND lower(name) LIKE ? ${LIKE}
       ORDER BY length(name), name
       LIMIT ?`,
    )
    .all(term, limit) as Row<SkillRow>[];
}

export function listSkillsByIds(ids: readonly number[]): Row<SkillRow>[] {
  if (ids.length === 0) return [];
  const placeholders = ids.map(() => '?').join(', ');
  return getDb()
    .prepare(`SELECT * FROM skill WHERE id IN (${placeholders}) ORDER BY name`)
    .all(...ids) as Row<SkillRow>[];
}

/**
 * Resolves a free-text skill to an id, creating it unapproved if new.
 * Normalisation strips every non-alphanumeric character so "Auto CAD",
 * "AutoCAD" and "auto-cad" converge on one row.
 */
/** Admin listing: unapproved first, since those are what need attention. */
export function listSkillsForAdmin(options: {
  readonly approved?: boolean | undefined;
  readonly search?: string | undefined;
  readonly limit: number;
  readonly offset: number;
}): { rows: Row<SkillRow>[]; total: number } {
  const where: string[] = [];
  const params: unknown[] = [];

  if (options.approved !== undefined) {
    where.push('is_approved = ?');
    params.push(options.approved ? 1 : 0);
  }
  if (options.search) {
    where.push(`lower(name) LIKE ? ${LIKE}`);
    // likeContains, not a raw template. This site declared the ESCAPE clause
    // and then built the pattern by hand, so the escaping was announced and
    // never applied — `search=%` still returned every skill.
    params.push(likeContains(options.search.toLowerCase()));
  }
  const whereSql = where.length > 0 ? `WHERE ${where.join(' AND ')}` : '';

  const total = (
    getDb().prepare(`SELECT count(*) AS n FROM skill ${whereSql}`).get(...params) as { n: number }
  ).n;

  const rows = getDb()
    .prepare(
      `SELECT s.*,
              (SELECT count(*) FROM candidate_skill cs WHERE cs.skill_id = s.id) AS _candidate_count,
              (SELECT count(*) FROM job_skill js WHERE js.skill_id = s.id) AS _job_count
       FROM skill s ${whereSql}
       ORDER BY is_approved ASC, name
       LIMIT ? OFFSET ?`,
    )
    .all(...params, options.limit, options.offset) as Row<SkillRow>[];

  return { rows, total };
}

export function setSkillApproved(id: number, approved: boolean): boolean {
  const result = getDb()
    .prepare('UPDATE skill SET is_approved = ? WHERE id = ?')
    .run(approved ? 1 : 0, id);
  return result.changes === 1;
}

/**
 * Renaming can collide: `skill.slug` is unique, so renaming "GD&T" to "GD & T"
 * when both normalise to the same slug used to surface as a bare 500. The
 * caller gets a distinguishable answer instead, and the right advice is to
 * merge rather than rename.
 */
export function renameSkill(id: number, name: string): 'OK' | 'NOT_FOUND' | 'SLUG_TAKEN' {
  const db = getDb();
  const slug = normaliseSkillSlug(name);

  const clash = db.prepare('SELECT id FROM skill WHERE slug = ? AND id != ?').get(slug, id) as
    | { id: number }
    | undefined;
  if (clash) return 'SLUG_TAKEN';

  const result = db.prepare('UPDATE skill SET name = ?, slug = ? WHERE id = ?').run(name, slug, id);
  return result.changes === 1 ? 'OK' : 'NOT_FOUND';
}

export function skillExists(id: number): boolean {
  return getDb().prepare('SELECT 1 FROM skill WHERE id = ?').get(id) !== undefined;
}

/**
 * Folds one skill into another, repointing every candidate and job that used
 * it. Without this the taxonomy can only ever grow — and a fragmented taxonomy
 * directly degrades the Phase 2 match score.
 */
export function mergeSkills(sourceId: number, targetId: number): { moved: number } {
  if (sourceId === targetId) return { moved: 0 };
  const db = getDb();

  const moved = db.transaction(() => {
    // INSERT OR IGNORE handles a candidate who already has both skills.
    const c = db
      .prepare(
        'INSERT OR IGNORE INTO candidate_skill (candidate_profile_id, skill_id) SELECT candidate_profile_id, ? FROM candidate_skill WHERE skill_id = ?',
      )
      .run(targetId, sourceId);
    db.prepare('DELETE FROM candidate_skill WHERE skill_id = ?').run(sourceId);

    const j = db
      .prepare(
        'INSERT OR IGNORE INTO job_skill (job_id, skill_id, requirement) SELECT job_id, ?, requirement FROM job_skill WHERE skill_id = ?',
      )
      .run(targetId, sourceId);
    db.prepare('DELETE FROM job_skill WHERE skill_id = ?').run(sourceId);

    db.prepare('DELETE FROM skill WHERE id = ?').run(sourceId);
    return c.changes + j.changes;
  })();

  return { moved };
}

export function resolveSkillId(rawName: string): number {
  const name = rawName.trim();
  if (isUnusableSkillName(name)) {
    throw badRequest(`"${name}" is not a skill we can record. Use letters or numbers.`);
  }
  const slug = normaliseSkillSlug(name);
  const db = getDb();

  const existing = db.prepare('SELECT id FROM skill WHERE slug = ?').get(slug) as
    | { id: number }
    | undefined;
  if (existing) return existing.id;

  const result = db
    .prepare('INSERT INTO skill (slug, name, is_approved, created_at) VALUES (?, ?, 0, ?)')
    .run(slug, name, nowIso());
  return Number(result.lastInsertRowid);
}
