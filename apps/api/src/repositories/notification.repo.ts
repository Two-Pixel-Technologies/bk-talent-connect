/**
 * The notification feed.
 */

import { getDb } from '../db/client.js';
import type { NotificationRow, Row } from '../db/rows.js';
import { newId } from '../lib/ids.js';
import { nowIso } from '@bktc/shared';

export interface CreateNotificationInput {
  readonly userId: string;
  readonly event: string;
  readonly title: string;
  readonly body?: string | undefined;
  readonly entityType?: string | undefined;
  readonly entityId?: string | undefined;
}

export function create(input: CreateNotificationInput): string {
  const id = newId();
  getDb()
    .prepare(
      `INSERT INTO notification
         (id, user_id, event, title, body, entity_type, entity_id, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .run(
      id,
      input.userId,
      input.event,
      input.title,
      input.body ?? null,
      input.entityType ?? null,
      input.entityId ?? null,
      nowIso(),
    );
  return id;
}

export function findById(id: string): Row<NotificationRow> | undefined {
  return getDb().prepare('SELECT * FROM notification WHERE id = ?').get(id) as
    | Row<NotificationRow>
    | undefined;
}

export function listForUser(options: {
  readonly userId: string;
  readonly unreadOnly: boolean;
  readonly limit: number;
  readonly offset: number;
}): { rows: Row<NotificationRow>[]; total: number } {
  const db = getDb();
  // No sort parameter is accepted here at all — the feed has exactly one useful
  // order, so there is nothing for a caller to inject into.
  const where = options.unreadOnly ? 'WHERE user_id = ? AND read_at IS NULL' : 'WHERE user_id = ?';

  const total = (
    db.prepare(`SELECT COUNT(*) AS n FROM notification ${where}`).get(options.userId) as {
      n: number;
    }
  ).n;

  const rows = db
    .prepare(`SELECT * FROM notification ${where} ORDER BY created_at DESC, id DESC LIMIT ? OFFSET ?`)
    .all(options.userId, options.limit, options.offset) as Row<NotificationRow>[];

  return { rows, total };
}

export function countUnread(userId: string): number {
  return (
    getDb()
      .prepare('SELECT COUNT(*) AS n FROM notification WHERE user_id = ? AND read_at IS NULL')
      .get(userId) as { n: number }
  ).n;
}

/**
 * Marks one notification read.
 *
 * Scoped by user_id, not just id: the id is the only thing the client sends,
 * and without the ownership term in the WHERE clause any signed-in user could
 * clear someone else's badge.
 */
export function markRead(id: string, userId: string): boolean {
  const result = getDb()
    .prepare('UPDATE notification SET read_at = ? WHERE id = ? AND user_id = ? AND read_at IS NULL')
    .run(nowIso(), id, userId);
  return result.changes === 1;
}

export function markAllRead(userId: string): number {
  const result = getDb()
    .prepare('UPDATE notification SET read_at = ? WHERE user_id = ? AND read_at IS NULL')
    .run(nowIso(), userId);
  return result.changes;
}

