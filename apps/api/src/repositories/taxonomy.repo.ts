/**
 * Lookup tables: sectors, functional areas, cities, skills.
 */

import { getDb } from '../db/client.js';
import type { TaxonomyRow, SkillRow, Row } from '../db/rows.js';
import { nowIso, normaliseSkillSlug } from '@bktc/shared';

type TaxonomyTable = 'sector' | 'functional_area' | 'city';

export function listActive(table: TaxonomyTable): Row<TaxonomyRow>[] {
  return getDb()
    .prepare(`SELECT * FROM ${table} WHERE is_active = 1 ORDER BY sort_order, name`)
    .all() as Row<TaxonomyRow>[];
}

export function findBySlug(table: TaxonomyTable, slug: string): Row<TaxonomyRow> | undefined {
  return getDb().prepare(`SELECT * FROM ${table} WHERE slug = ?`).get(slug) as
    | Row<TaxonomyRow>
    | undefined;
}

export function idBySlug(table: TaxonomyTable, slug: string | undefined): number | null {
  if (!slug) return null;
  const row = findBySlug(table, slug);
  return row ? row.id : null;
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

// ---------------------------------------------------------------------------
// Skills
// ---------------------------------------------------------------------------

/**
 * Autocomplete source. Only approved skills are suggested: auto-created ones
 * stay invisible until an admin accepts them, so one account cannot pollute the
 * taxonomy every other candidate and employer picks from.
 */
export function searchApprovedSkills(query: string, limit = 12): Row<SkillRow>[] {
  const term = `%${query.trim().toLowerCase()}%`;
  return getDb()
    .prepare(
      `SELECT * FROM skill
       WHERE is_approved = 1 AND lower(name) LIKE ?
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
export function resolveSkillId(rawName: string): number {
  const name = rawName.trim();
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
