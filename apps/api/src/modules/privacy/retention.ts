/**
 * The weekly sweep.
 *
 * Four kinds of debris accumulate, and none of them announce themselves:
 *
 *   - session rows carrying an IP and a user agent long after the session died
 *   - admin notes whose subject has been deleted (the polymorphic key cannot
 *     have a foreign key, so orphans are swept rather than prevented)
 *   - staged upload temp files from requests that failed between write and
 *     commit
 *   - files on disk with no row, which is what an interrupted erasure leaves
 *
 * The last one is the reason this is not optional: an orphaned CV on disk is
 * personal data we are still holding after being asked to erase it.
 *
 * Run from scripts/maintenance.ts on a weekly cron. Returns counts so the cron
 * output is worth reading.
 */

import fs from 'node:fs';
import { LIMITS } from '@bktc/shared';
import * as interviewRepo from '../../repositories/interview.repo.js';
import * as fileRepo from '../../repositories/file.repo.js';
import * as sessionRepo from '../../repositories/session.repo.js';
import * as fileStorage from '../../lib/file-storage.js';
import { logger } from '../../lib/logger.js';

/**
 * The session retention window, in days.
 *
 * Re-exported from LIMITS rather than restated: session.repo.deleteExpired()
 * is what actually applies it, and a second number here would drift.
 */
export const SESSION_RETENTION_DAYS = LIMITS.session.retentionMs / (24 * 60 * 60 * 1000);

/**
 * How long a replaced CV is kept before it is removed.
 *
 * Long enough that a candidate who overwrote the wrong file can ask for it
 * back, short enough that we are not holding every version of everyone's CV
 * forever.
 */
const SUPERSEDED_FILE_RETENTION_DAYS = 30;

export type SweepResult = {
  /** Expired sessions plus sessions past the retention window. */
  readonly sessionsRemoved: number;
  readonly orphanedNotes: number;
  readonly staleTempFiles: number;
  readonly orphanedFiles: number;
  /** Replaced CVs past the retention window that nothing references. */
  readonly supersededFiles: number;
};

export function runRetentionSweep(): SweepResult {
  const sessionsRemoved = sessionRepo.deleteExpired();
  const orphanedNotes = interviewRepo.deleteOrphanedNotes();
  const supersededFiles = sweepSupersededFiles();
  const staleTempFiles = fileStorage.sweepStaleTempFiles();
  // After the superseded sweep, so rows deleted above do not then count as
  // orphaned files on the same run.
  const orphanedFiles = sweepOrphanedFiles();

  logger.info(
    { sessionsRemoved, orphanedNotes, supersededFiles, staleTempFiles, orphanedFiles },
    'retention sweep complete',
  );

  return { sessionsRemoved, orphanedNotes, supersededFiles, staleTempFiles, orphanedFiles };
}

/**
 * Replaced CVs, off the disk and out of the database.
 *
 * Only ones no application snapshot and no live profile still points at — an
 * employer's record of the CV they were actually sent is never swept.
 */
function sweepSupersededFiles(): number {
  const files = fileRepo.listSweepableFiles(SUPERSEDED_FILE_RETENTION_DAYS);
  if (files.length === 0) return 0;

  for (const file of files) {
    try {
      fileStorage.remove(file.stored_path);
    } catch (error) {
      logger.warn({ err: error, fileId: file.id }, 'could not remove a superseded CV');
    }
  }

  return fileRepo.hardDelete(files.map((f) => f.id));
}

/**
 * Files on disk that no row points at.
 *
 * Deliberately one-directional: it removes files with no row, and never rows
 * with no file. A missing file is a restore problem to investigate, not
 * something to tidy away by deleting the evidence that it existed.
 */
function sweepOrphanedFiles(): number {
  const known = new Set(fileRepo.listAllStoredPaths());
  const dir = fileStorage.uploadsDirectory();

  let removed = 0;
  let entries: string[];
  try {
    entries = fs.readdirSync(dir);
  } catch {
    return 0;
  }

  for (const entry of entries) {
    if (known.has(entry)) continue;
    try {
      fs.unlinkSync(fileStorage.absolutePathOf(entry));
      removed += 1;
    } catch (error) {
      logger.warn({ err: error, entry }, 'could not remove orphaned upload');
    }
  }

  return removed;
}
