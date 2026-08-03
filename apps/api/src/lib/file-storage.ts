/**
 * Resume storage.
 *
 * Two correctness properties:
 *
 * 1. CONTENT IS VERIFIED, NOT TRUSTED. The declared MIME type and the file
 *    extension are both attacker-controlled. We read the leading bytes and
 *    check the actual container signature, so an executable renamed to .pdf is
 *    rejected regardless of what the client claims.
 *
 * 2. WRITES ARE ATOMIC WITH RESPECT TO THE DATABASE. better-sqlite3
 *    transactions are synchronous and cannot contain async filesystem work, so
 *    a file cannot be written inside the same transaction as its row. Instead
 *    the upload lands in tmp/, the row is inserted, and only then is the file
 *    renamed into place. If the insert fails the temp file is unlinked, so
 *    there is never a row pointing at a missing file.
 *
 * Files are stored under a generated id, never the client's filename — that
 * would be a path-traversal vector.
 *
 * Plan reference: MEDIUM-11, HIGH-22.
 */

import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { env } from '../config/env.js';
import { unsupportedMedia } from './errors.js';

export type VerifiedFileType = { readonly mime: string; readonly extension: string };

/** Container signatures we accept. Checked against real bytes. */
const SIGNATURES: readonly {
  readonly bytes: readonly number[];
  readonly type: VerifiedFileType;
}[] = [
  // %PDF
  { bytes: [0x25, 0x50, 0x44, 0x46], type: { mime: 'application/pdf', extension: '.pdf' } },
  // PK.. — .docx is a zip container
  {
    bytes: [0x50, 0x4b, 0x03, 0x04],
    type: {
      mime: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      extension: '.docx',
    },
  },
  // Legacy OLE compound document — .doc
  {
    bytes: [0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1],
    type: { mime: 'application/msword', extension: '.doc' },
  },
];

export function detectFileType(buffer: Buffer): VerifiedFileType | null {
  for (const signature of SIGNATURES) {
    if (buffer.length < signature.bytes.length) continue;
    const matches = signature.bytes.every((byte, index) => buffer[index] === byte);
    if (matches) return signature.type;
  }
  return null;
}

export function ensureDirectories(): void {
  fs.mkdirSync(env.uploadsDir, { recursive: true });
  fs.mkdirSync(env.tmpDir, { recursive: true });
}

export function checksumOf(buffer: Buffer): string {
  return createHash('sha256').update(buffer).digest('hex');
}

export interface StagedFile {
  readonly tempPath: string;
  readonly storedName: string;
  readonly type: VerifiedFileType;
  readonly checksum: string;
  readonly sizeBytes: number;
}

/**
 * Verifies the buffer and writes it to tmp/. The caller inserts the database
 * row, then calls commit() or discard().
 */
export function stage(fileId: string, buffer: Buffer): StagedFile {
  ensureDirectories();

  const type = detectFileType(buffer);
  if (!type) {
    throw unsupportedMedia('That file is not a PDF or Word document. Please upload a PDF or DOCX.');
  }

  const storedName = `${fileId}${type.extension}`;
  const tempPath = path.join(env.tmpDir, storedName);
  fs.writeFileSync(tempPath, buffer, { mode: 0o600 });

  return {
    tempPath,
    storedName,
    type,
    checksum: checksumOf(buffer),
    sizeBytes: buffer.byteLength,
  };
}

/** Moves a staged file into permanent storage. Same filesystem, so atomic. */
export function commit(staged: StagedFile): string {
  const finalPath = path.join(env.uploadsDir, staged.storedName);
  fs.renameSync(staged.tempPath, finalPath);
  return staged.storedName;
}

export function discard(staged: StagedFile): void {
  try {
    fs.unlinkSync(staged.tempPath);
  } catch {
    // Already gone; the sweeper below is the backstop.
  }
}

export function absolutePathOf(storedName: string): string {
  // basename strips any traversal a corrupted row might contain.
  return path.join(env.uploadsDir, path.basename(storedName));
}

export function exists(storedName: string): boolean {
  return fs.existsSync(absolutePathOf(storedName));
}

export function remove(storedName: string): void {
  try {
    fs.unlinkSync(absolutePathOf(storedName));
  } catch {
    // Nothing to remove.
  }
}

/**
 * Deletes temp files older than a day. A crash between stage() and commit()
 * leaves an orphan; without this they accumulate until the disk fills, at which
 * point every SQLite write starts failing.
 */
export function sweepStaleTempFiles(maxAgeMs = 24 * 60 * 60 * 1000): number {
  ensureDirectories();
  const cutoff = Date.now() - maxAgeMs;
  let removed = 0;

  for (const name of fs.readdirSync(env.tmpDir)) {
    const filePath = path.join(env.tmpDir, name);
    try {
      if (fs.statSync(filePath).mtimeMs < cutoff) {
        fs.unlinkSync(filePath);
        removed += 1;
      }
    } catch {
      // Raced with another sweep; ignore.
    }
  }
  return removed;
}
