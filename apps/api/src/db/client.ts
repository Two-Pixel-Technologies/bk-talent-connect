/**
 * SQLite connection.
 *
 * Two pragmas here are load-bearing rather than tuning:
 *
 * - foreign_keys is OFF by default in SQLite. Without this line every FK in the
 *   schema is decorative, and the P0 exit checklist verifies a violation is
 *   actually rejected.
 * - busy_timeout is deliberately low. better-sqlite3 is synchronous, so a
 *   blocked write spins the event loop — the timeout stalls the entire API for
 *   its duration, not just the one request. 2s is a compromise between
 *   surviving a checkpoint and not freezing every user behind one lock.
 *
 * Plan reference: HIGH-13.
 */

import Database from 'better-sqlite3';
import fs from 'node:fs';
import path from 'node:path';
import { env } from '../config/env.js';

export type Db = Database.Database;

let instance: Db | null = null;

export interface OpenOptions {
  readonly path?: string;
  readonly readonly?: boolean;
}

export function openDatabase(options: OpenOptions = {}): Db {
  const file = options.path ?? env.databasePath;
  fs.mkdirSync(path.dirname(file), { recursive: true });

  const db = new Database(file, { readonly: options.readonly ?? false });

  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');
  db.pragma('busy_timeout = 2000');
  // NORMAL is safe under WAL: a crash can lose the last transaction, never the
  // database. FULL costs an fsync per commit for a durability guarantee this
  // application does not need.
  db.pragma('synchronous = NORMAL');
  // Cap the WAL so a long-running read cannot let it grow without bound.
  db.pragma('wal_autocheckpoint = 1000');
  db.pragma('foreign_keys = ON');

  return db;
}

/** Process-wide connection. SQLite is embedded; one handle is correct. */
export function getDb(): Db {
  instance ??= openDatabase();
  return instance;
}

export function closeDatabase(): void {
  if (instance) {
    // Truncate the WAL on a clean shutdown so backups do not need to replay it.
    try {
      instance.pragma('wal_checkpoint(TRUNCATE)');
    } catch {
      // A checkpoint failure must not block shutdown.
    }
    instance.close();
    instance = null;
  }
}

/** Verifies the connection can actually read. Used by /api/health. */
export function checkDatabase(): boolean {
  try {
    const row = getDb().prepare('SELECT 1 AS ok').get() as { ok: number } | undefined;
    return row?.ok === 1;
  } catch {
    return false;
  }
}
