/**
 * Admin action log.
 *
 * The metadata rule is a privacy control, not bookkeeping. The obvious way to
 * write an audit log is to dump the before/after of the record — which for a
 * candidate approval means writing their current CTC and expected range into a
 * table that has no serializer and gets read directly during support work. That
 * bypasses the entire privacy boundary the serializers exist to enforce.
 *
 * So metadata records THAT a field changed, never its value.
 *
 * Plan reference: HIGH-23.
 */

import { getDb } from '../db/client.js';
import type { AuditLogRow, Row } from '../db/rows.js';
import { nowIso } from '@bktc/shared';

export type AuditEntityType = 'CANDIDATE' | 'EMPLOYER' | 'JOB' | 'USER' | 'ENQUIRY' | 'SKILL';

/**
 * Values allowed into metadata. Deliberately narrow — anything not on this list
 * is dropped rather than serialised, so adding a field to a record cannot
 * silently start leaking it into the log.
 */
export type AuditMetadata = {
  /** Names of fields that changed. Never their values. */
  readonly changedFields?: readonly string[];
  readonly fromStatus?: string;
  readonly toStatus?: string;
  /** Admin-authored review note. Written by staff for the user to read. */
  readonly reason?: string;
  readonly count?: number;
};

const ALLOWED_KEYS = new Set(['changedFields', 'fromStatus', 'toStatus', 'reason', 'count']);

function sanitise(metadata: AuditMetadata | undefined): string | null {
  if (!metadata) return null;
  const clean: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(metadata)) {
    if (!ALLOWED_KEYS.has(key)) continue;
    if (value === undefined) continue;
    clean[key] = value;
  }
  return Object.keys(clean).length > 0 ? JSON.stringify(clean) : null;
}

export interface RecordInput {
  readonly actorId: string | null;
  readonly action: string;
  readonly entityType: AuditEntityType;
  readonly entityId: string;
  readonly metadata?: AuditMetadata;
  readonly ipAddress?: string | undefined;
}

export function record(input: RecordInput): void {
  getDb()
    .prepare(
      `INSERT INTO audit_log (actor_id, action, entity_type, entity_id, metadata, ip_address, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
    )
    .run(
      input.actorId,
      input.action,
      input.entityType,
      input.entityId,
      sanitise(input.metadata),
      input.ipAddress ?? null,
      nowIso(),
    );
}

export function listForEntity(
  entityType: AuditEntityType,
  entityId: string,
  limit = 50,
): Row<AuditLogRow>[] {
  return getDb()
    .prepare(
      `SELECT * FROM audit_log
       WHERE entity_type = ? AND entity_id = ?
       ORDER BY created_at DESC, id DESC
       LIMIT ?`,
    )
    .all(entityType, entityId, limit) as Row<AuditLogRow>[];
}
