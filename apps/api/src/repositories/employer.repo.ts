/**
 * Employer profile data access.
 */

import { getDb } from '../db/client.js';
import type { EmployerProfileRow, Row } from '../db/rows.js';
import { newId } from '../lib/ids.js';
import { nowIso } from '@bktc/shared';

export function findByUserId(userId: string): Row<EmployerProfileRow> | undefined {
  return getDb()
    .prepare('SELECT * FROM employer_profile WHERE user_id = ? AND deleted_at IS NULL')
    .get(userId) as Row<EmployerProfileRow> | undefined;
}

export function findById(id: string): Row<EmployerProfileRow> | undefined {
  return getDb()
    .prepare('SELECT * FROM employer_profile WHERE id = ? AND deleted_at IS NULL')
    .get(id) as Row<EmployerProfileRow> | undefined;
}

export interface CreateEmployerInput {
  readonly userId: string;
  readonly companyName: string;
  readonly hrContactName: string;
  readonly hrContactEmail: string;
  readonly hrContactPhone: string;
}

export function create(input: CreateEmployerInput): string {
  const id = newId();
  const now = nowIso();
  getDb()
    .prepare(
      `INSERT INTO employer_profile
         (id, user_id, company_name, hr_contact_name, hr_contact_email, hr_contact_phone,
          account_status, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, 'SUBMITTED', ?, ?)`,
    )
    .run(
      id,
      input.userId,
      input.companyName,
      input.hrContactName,
      input.hrContactEmail,
      input.hrContactPhone,
      now,
      now,
    );
  return id;
}

const UPDATABLE_COLUMNS = new Set([
  'company_name',
  'sector_id',
  'locations',
  'website',
  'linkedin_url',
  'hr_contact_name',
  'hr_contact_phone',
  'company_intro',
  'last_approved_snapshot',
]);

export function updateFields(profileId: string, patch: Record<string, unknown>): void {
  const entries = Object.entries(patch).filter(([column]) => UPDATABLE_COLUMNS.has(column));
  if (entries.length === 0) return;

  const assignments = entries.map(([column]) => `${column} = ?`).join(', ');
  const values = entries.map(([, value]) => value as never);

  getDb()
    .prepare(`UPDATE employer_profile SET ${assignments}, updated_at = ? WHERE id = ?`)
    .run(...values, nowIso(), profileId);
}

export function setStatus(profileId: string, status: string): void {
  getDb()
    .prepare('UPDATE employer_profile SET account_status = ?, updated_at = ? WHERE id = ?')
    .run(status, nowIso(), profileId);
}

export function isApproved(userId: string): boolean {
  const row = getDb()
    .prepare(
      `SELECT 1 AS hit FROM employer_profile
       WHERE user_id = ? AND account_status = 'APPROVED' AND deleted_at IS NULL`,
    )
    .get(userId) as { hit: number } | undefined;
  return row !== undefined;
}
