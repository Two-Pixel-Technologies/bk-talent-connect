/**
 * The email/WhatsApp delivery audit trail — see 012_notification_channels.sql
 * for why this is a separate table from the in-portal `notification` feed.
 */

import { getDb } from '../db/client.js';
import type { NotificationDeliveryRow, Row } from '../db/rows.js';
import { newId } from '../lib/ids.js';
import { nowIso } from '@bktc/shared';

export type DeliveryChannel = 'EMAIL' | 'WHATSAPP';
export type DeliveryStatus = 'SENT' | 'FAILED' | 'SKIPPED';

export interface RecordDeliveryInput {
  readonly event: string;
  readonly channel: DeliveryChannel;
  readonly userId: string;
  readonly status: DeliveryStatus;
  readonly detail?: string | undefined;
}

export function record(input: RecordDeliveryInput): string {
  const id = newId();
  getDb()
    .prepare(
      `INSERT INTO notification_delivery (id, event, channel, user_id, status, detail, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
    )
    .run(id, input.event, input.channel, input.userId, input.status, input.detail ?? null, nowIso());
  return id;
}

/** Test/ops helper: every delivery attempt for one event, newest first. */
export function listForEvent(event: string): Row<NotificationDeliveryRow>[] {
  return getDb()
    .prepare('SELECT * FROM notification_delivery WHERE event = ? ORDER BY created_at DESC')
    .all(event) as Row<NotificationDeliveryRow>[];
}

/** Test/ops helper: every delivery attempt a given user was the subject of. */
export function listForUser(userId: string): Row<NotificationDeliveryRow>[] {
  return getDb()
    .prepare('SELECT * FROM notification_delivery WHERE user_id = ? ORDER BY created_at DESC')
    .all(userId) as Row<NotificationDeliveryRow>[];
}
