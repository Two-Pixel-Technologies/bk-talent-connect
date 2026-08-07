/**
 * File asset records.
 */

import { getDb } from '../db/client.js';
import type { FileAssetRow, Row } from '../db/rows.js';
import { nowIso } from '@bktc/shared';

/** The candidate's CURRENT file. Excludes superseded uploads. */
export function findById(id: string): Row<FileAssetRow> | undefined {
  return getDb()
    .prepare('SELECT * FROM file_asset WHERE id = ? AND deleted_at IS NULL')
    .get(id) as Row<FileAssetRow> | undefined;
}

/**
 * Any file, including ones superseded by a newer upload.
 *
 * The download route must use this. An application snapshots which CV was
 * current when it was submitted, precisely so an employer's shortlist decision
 * still points at the document they read — but the moment the candidate
 * uploaded a replacement, the old row was soft-deleted and that snapshot 404'd
 * for everyone, including admins. The file is still on disk; only the lookup
 * was hiding it.
 */
export function findByIdIncludingSuperseded(id: string): Row<FileAssetRow> | undefined {
  return getDb().prepare('SELECT * FROM file_asset WHERE id = ?').get(id) as
    | Row<FileAssetRow>
    | undefined;
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
/**
 * Superseded CVs that are past their retention window and referenced by
 * nothing.
 *
 * Replacing a CV soft-deletes the old row, and nothing ever removed it — so
 * every version a candidate had ever uploaded stayed on disk indefinitely.
 * Two problems: an authenticated candidate could fill the disk 5 MB at a time
 * on a 1 GB droplet, and DPDP storage limitation says we do not keep a
 * person's documents forever for no reason.
 *
 * The `resume_file_id_at_apply` check is what keeps this safe: an employer's
 * snapshot of the CV they actually received is not "superseded" from their
 * point of view, so those are never swept however old they are.
 */
export function listSweepableFiles(maxAgeDays: number): { id: string; stored_path: string }[] {
  const cutoff = new Date(Date.now() - maxAgeDays * 24 * 60 * 60 * 1000).toISOString();
  return getDb()
    .prepare(
      `SELECT id, stored_path FROM file_asset
        WHERE deleted_at IS NOT NULL
          AND deleted_at < ?
          AND id NOT IN (
            SELECT resume_file_id_at_apply FROM application
             WHERE resume_file_id_at_apply IS NOT NULL)
          AND id NOT IN (
            SELECT resume_file_id FROM candidate_profile
             WHERE resume_file_id IS NOT NULL)`,
    )
    .all(cutoff) as { id: string; stored_path: string }[];
}

export function hardDelete(ids: readonly string[]): number {
  if (ids.length === 0) return 0;
  const placeholders = ids.map(() => '?').join(',');
  return getDb()
    .prepare(`DELETE FROM file_asset WHERE id IN (${placeholders})`)
    .run(...ids).changes;
}

export function listAllStoredPaths(): string[] {
  const rows = getDb().prepare('SELECT stored_path FROM file_asset').all() as {
    stored_path: string;
  }[];
  return rows.map((r) => r.stored_path);
}
