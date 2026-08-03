/**
 * File asset records.
 */

import { getDb } from '../db/client.js';
import type { FileAssetRow, Row } from '../db/rows.js';
import { nowIso } from '@bktc/shared';

export function findById(id: string): Row<FileAssetRow> | undefined {
  return getDb()
    .prepare('SELECT * FROM file_asset WHERE id = ? AND deleted_at IS NULL')
    .get(id) as Row<FileAssetRow> | undefined;
}

export interface CreateFileInput {
  readonly id: string;
  readonly ownerId: string;
  readonly kind: 'RESUME';
  readonly originalName: string;
  readonly storedPath: string;
  readonly mimeType: string;
  readonly sizeBytes: number;
  readonly checksum: string;
}

export function create(input: CreateFileInput): void {
  getDb()
    .prepare(
      `INSERT INTO file_asset
         (id, owner_id, kind, original_name, stored_path, mime_type, size_bytes, checksum, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .run(
      input.id,
      input.ownerId,
      input.kind,
      input.originalName,
      input.storedPath,
      input.mimeType,
      input.sizeBytes,
      input.checksum,
      nowIso(),
    );
}

/**
 * Soft delete. Rows stay because an application may reference the exact CV an
 * employer evaluated; the file on disk is removed separately once nothing
 * points at it.
 */
export function softDelete(id: string): void {
  getDb().prepare('UPDATE file_asset SET deleted_at = ? WHERE id = ?').run(nowIso(), id);
}

/** Files with no live row, for the orphan sweeper. */
export function listAllStoredPaths(): string[] {
  const rows = getDb().prepare('SELECT stored_path FROM file_asset').all() as {
    stored_path: string;
  }[];
  return rows.map((r) => r.stored_path);
}
