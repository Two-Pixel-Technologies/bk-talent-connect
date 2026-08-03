/**
 * Candidate profile data access.
 */

import { getDb } from '../db/client.js';
import type { CandidateProfileRow, Row } from '../db/rows.js';
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

export function isApproved(userId: string): boolean {
  const row = getDb()
    .prepare(
      `SELECT 1 AS hit FROM candidate_profile
       WHERE user_id = ? AND profile_status = 'APPROVED' AND deleted_at IS NULL`,
    )
    .get(userId) as { hit: number } | undefined;
  return row !== undefined;
}
