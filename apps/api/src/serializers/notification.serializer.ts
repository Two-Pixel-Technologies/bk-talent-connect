/**
 * Notification serializer.
 *
 * The link is handed over as {entityType, entityId} and resolved to a route by
 * the client, which knows who is looking. `read` is derived rather than
 * exposing the timestamp — nothing in the UI needs the minute someone opened a
 * bell, and it is one less piece of behavioural data to carry around.
 */

import type { NotificationEntityType, NotificationEvent } from '@bktc/shared';
import type { NotificationRow, Row } from '../db/rows.js';
import { unbrand } from '../db/rows.js';

export function toNotificationView(row: Row<NotificationRow>) {
  const n = unbrand(row);
  return {
    id: n.id,
    event: n.event as NotificationEvent,
    title: n.title,
    body: n.body,
    link:
      n.entity_type && n.entity_id
        ? { entityType: n.entity_type as NotificationEntityType, entityId: n.entity_id }
        : null,
    read: n.read_at !== null,
    createdAt: n.created_at,
  };
}
