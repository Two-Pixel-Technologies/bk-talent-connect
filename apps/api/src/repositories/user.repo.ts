/**
 * User data access. All SQL touching `user` lives here.
 */

import { getDb } from '../db/client.js';
import type { UserRow, Row } from '../db/rows.js';
import { newId } from '../lib/ids.js';
import { nowIso } from '@bktc/shared';
import type { Role, UserStatus } from '@bktc/shared';

/** Single normalisation point, used by register, login, admin-create and seed. */
function normaliseEmail(email: string): string {
  return email.trim().toLowerCase();
}

export function findById(id: string): Row<UserRow> | undefined {
  return getDb()
    .prepare('SELECT * FROM user WHERE id = ? AND deleted_at IS NULL')
    .get(id) as Row<UserRow> | undefined;
}

/**
 * Including erased and soft-deleted accounts.
 *
 * Only for screens that must describe an account that no longer exists — the
 * erasure queue, which otherwise shows "(unknown)" against every completed
 * request and leaves BK unable to tell which one they actioned. Never use this
 * on an authentication or authorisation path.
 */
export function findByIdIncludingDeleted(id: string): Row<UserRow> | undefined {
  return getDb().prepare('SELECT * FROM user WHERE id = ?').get(id) as Row<UserRow> | undefined;
}

export function findByEmail(email: string): Row<UserRow> | undefined {
  return getDb()
    .prepare('SELECT * FROM user WHERE email = ? AND deleted_at IS NULL')
    .get(normaliseEmail(email)) as Row<UserRow> | undefined;
}

export function emailExists(email: string): boolean {
  const row = getDb()
    .prepare('SELECT 1 AS hit FROM user WHERE email = ? AND deleted_at IS NULL')
    .get(normaliseEmail(email)) as { hit: number } | undefined;
  return row !== undefined;
}

export interface CreateUserInput {
  readonly email: string;
  readonly passwordHash: string;
  readonly role: Role;
  readonly mustChangePassword?: boolean;
}

export function create(input: CreateUserInput): string {
  const id = newId();
  const now = nowIso();
  getDb()
    .prepare(
      `INSERT INTO user (id, email, password_hash, role, status, must_change_password, created_at, updated_at)
       VALUES (?, ?, ?, ?, 'ACTIVE', ?, ?, ?)`,
    )
    .run(id, normaliseEmail(input.email), input.passwordHash, input.role, input.mustChangePassword ? 1 : 0, now, now);
  return id;
}

export function updatePassword(userId: string, passwordHash: string, mustChange = false): void {
  getDb()
    .prepare(
      `UPDATE user SET password_hash = ?, must_change_password = ?, updated_at = ? WHERE id = ?`,
    )
    .run(passwordHash, mustChange ? 1 : 0, nowIso(), userId);
}

export function recordLogin(userId: string): void {
  getDb().prepare('UPDATE user SET last_login_at = ? WHERE id = ?').run(nowIso(), userId);
}

/**
 * Conditional update — the WHERE clause carries the precondition so two admins
 * acting at once cannot both succeed. Returns false when the row had already
 * moved, which the caller turns into a 409.
 */
export function setStatus(userId: string, status: UserStatus, expectedCurrent: UserStatus): boolean {
  const result = getDb()
    .prepare('UPDATE user SET status = ?, updated_at = ? WHERE id = ? AND status = ?')
    .run(status, nowIso(), userId, expectedCurrent);
  return result.changes === 1;
}

/**
 * Guards the last way in. Suspending or deleting the final active admin leaves
 * recovery to SSH plus a hand-generated argon2 hash — at which point there is
 * also no password reset, because email is Phase 2.
 *
 * Plan reference: HIGH-18.
 */
export function countActiveAdmins(excludingUserId?: string): number {
  const sql = excludingUserId
    ? `SELECT count(*) AS n FROM user WHERE role = 'ADMIN' AND status = 'ACTIVE' AND deleted_at IS NULL AND id != ?`
    : `SELECT count(*) AS n FROM user WHERE role = 'ADMIN' AND status = 'ACTIVE' AND deleted_at IS NULL`;
  const stmt = getDb().prepare(sql);
  const row = (excludingUserId ? stmt.get(excludingUserId) : stmt.get()) as { n: number };
  return row.n;
}

export function listAdminIds(): string[] {
  const rows = getDb()
    .prepare(`SELECT id FROM user WHERE role = 'ADMIN' AND status = 'ACTIVE' AND deleted_at IS NULL`)
    .all() as { id: string }[];
  return rows.map((r) => r.id);
}
