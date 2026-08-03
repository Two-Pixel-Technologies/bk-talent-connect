/**
 * Session storage.
 *
 * The cookie carries a random opaque token; only its SHA-256 hash is stored, so
 * a database read (a leaked backup, a SQL injection elsewhere) cannot be turned
 * into a usable session.
 */

import { createHash, randomBytes } from 'node:crypto';
import { getDb } from '../db/client.js';
import type { SessionRow, Row } from '../db/rows.js';
import { newId } from '../lib/ids.js';
import { nowIso, LIMITS } from '@bktc/shared';

export function generateToken(): string {
  return randomBytes(32).toString('base64url');
}

export function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

export interface CreateSessionResult {
  readonly token: string;
  readonly expiresAt: string;
}

export function create(
  userId: string,
  meta: { ip?: string | undefined; userAgent?: string | undefined },
): CreateSessionResult {
  const token = generateToken();
  const expiresAt = new Date(Date.now() + LIMITS.session.lifetimeMs).toISOString();

  getDb()
    .prepare(
      `INSERT INTO session (id, token_hash, user_id, expires_at, ip_address, user_agent, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
    )
    .run(newId(), hashToken(token), userId, expiresAt, meta.ip ?? null, meta.userAgent ?? null, nowIso());

  return { token, expiresAt };
}

export function findValidByToken(token: string): Row<SessionRow> | undefined {
  return getDb()
    .prepare('SELECT * FROM session WHERE token_hash = ? AND expires_at > ?')
    .get(hashToken(token), nowIso()) as Row<SessionRow> | undefined;
}

export function deleteByToken(token: string): void {
  getDb().prepare('DELETE FROM session WHERE token_hash = ?').run(hashToken(token));
}

/**
 * Used on password change and admin reset. Without it, resetting a compromised
 * account's password leaves the attacker's session alive.
 *
 * Plan reference: MEDIUM-20.
 */
export function deleteAllForUser(userId: string, exceptToken?: string): number {
  const db = getDb();
  const result = exceptToken
    ? db
        .prepare('DELETE FROM session WHERE user_id = ? AND token_hash != ?')
        .run(userId, hashToken(exceptToken))
    : db.prepare('DELETE FROM session WHERE user_id = ?').run(userId);
  return result.changes;
}

/** Nightly cron. Expired rows also hold ip/user-agent, which are personal data. */
export function deleteExpired(): number {
  const cutoff = new Date(Date.now() - LIMITS.session.retentionMs).toISOString();
  const db = getDb();
  const expired = db.prepare('DELETE FROM session WHERE expires_at < ?').run(nowIso());
  const old = db.prepare('DELETE FROM session WHERE created_at < ?').run(cutoff);
  return expired.changes + old.changes;
}
