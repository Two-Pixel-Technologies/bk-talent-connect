/**
 * Numbered-migration runner.
 *
 * Applies `migrations/NNN_name.sql` in filename order, once each, recording
 * them in `schema_migrations`. Re-running is a no-op.
 *
 * Safety properties, in order of importance:
 *
 * 1. A backup is taken before ANY pending migration is applied, using SQLite's
 *    own .backup (via VACUUM INTO) rather than a file copy — under WAL a plain
 *    cp silently omits uncheckpointed data and can tear mid-write.
 * 2. Each migration's DDL and its schema_migrations row commit in the SAME
 *    transaction, so a crash can never leave a migration half-recorded.
 * 3. foreign_key_check and integrity_check run afterwards; either failing
 *    aborts the run and points at the backup.
 *
 * Table rebuilds: SQLite cannot ALTER a CHECK constraint, so changing one means
 * the 12-step rebuild — and `PRAGMA foreign_keys` is a NO-OP inside a
 * transaction. A migration needing FKs off must declare it with the directive
 * `-- @foreign-keys-off` on its first line; the runner then toggles the pragma
 * outside the transaction where it actually takes effect.
 *
 * Plan reference: HIGH-7.
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { openDatabase, type Db } from './client.js';
import { env } from '../config/env.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const MIGRATIONS_DIR = path.join(here, 'migrations');

const FOREIGN_KEYS_OFF_DIRECTIVE = '-- @foreign-keys-off';

export interface MigrationFile {
  readonly id: string;
  readonly filename: string;
  readonly sql: string;
  readonly needsForeignKeysOff: boolean;
}

export interface MigrateResult {
  readonly applied: string[];
  readonly skipped: string[];
  readonly backupPath: string | null;
}

function ensureMigrationsTable(db: Db): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      id          TEXT PRIMARY KEY,
      filename    TEXT NOT NULL,
      applied_at  TEXT NOT NULL
    ) STRICT;
  `);
}

export function readMigrations(dir: string = MIGRATIONS_DIR): MigrationFile[] {
  if (!fs.existsSync(dir)) return [];
  return fs
    .readdirSync(dir)
    .filter((f) => f.endsWith('.sql'))
    .sort()
    .map((filename) => {
      const sql = fs.readFileSync(path.join(dir, filename), 'utf8');
      const id = filename.replace(/\.sql$/, '');
      return {
        id,
        filename,
        sql,
        needsForeignKeysOff: sql.trimStart().startsWith(FOREIGN_KEYS_OFF_DIRECTIVE),
      };
    });
}

function appliedIds(db: Db): Set<string> {
  const rows = db.prepare('SELECT id FROM schema_migrations').all() as { id: string }[];
  return new Set(rows.map((r) => r.id));
}

/** Consistent snapshot of a live database. Safe against a concurrent writer. */
function backup(db: Db, databasePath: string): string {
  const dir = path.join(path.dirname(databasePath), 'backups');
  fs.mkdirSync(dir, { recursive: true });
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const target = path.join(dir, `pre-migrate-${stamp}.db`);
  db.prepare('VACUUM INTO ?').run(target);
  return target;
}

function verifyIntegrity(db: Db): void {
  const fkViolations = db.pragma('foreign_key_check') as unknown[];
  if (fkViolations.length > 0) {
    throw new Error(
      `foreign_key_check reported ${fkViolations.length} violation(s): ${JSON.stringify(fkViolations.slice(0, 5))}`,
    );
  }
  const integrity = db.pragma('integrity_check') as { integrity_check: string }[];
  const result = integrity[0]?.integrity_check;
  if (result !== 'ok') {
    throw new Error(`integrity_check failed: ${result}`);
  }
}

export function migrate(options: { db?: Db; databasePath?: string; silent?: boolean } = {}): MigrateResult {
  const databasePath = options.databasePath ?? env.databasePath;
  const db = options.db ?? openDatabase({ path: databasePath });
  const ownsConnection = !options.db;
  const log = (msg: string) => {
    if (!options.silent) console.log(msg);
  };

  try {
    ensureMigrationsTable(db);

    const all = readMigrations();
    const done = appliedIds(db);
    const pending = all.filter((m) => !done.has(m.id));
    const skipped = all.filter((m) => done.has(m.id)).map((m) => m.id);

    if (pending.length === 0) {
      log('No pending migrations.');
      return { applied: [], skipped, backupPath: null };
    }

    // Only back up when there is real work, and only if the DB already has content.
    const hasContent = (db.prepare("SELECT count(*) AS n FROM sqlite_master WHERE type='table'").get() as { n: number }).n > 1;
    const backupPath = hasContent ? backup(db, databasePath) : null;
    if (backupPath) log(`Backed up to ${backupPath}`);

    const record = db.prepare(
      'INSERT INTO schema_migrations (id, filename, applied_at) VALUES (?, ?, ?)',
    );

    const applied: string[] = [];

    for (const migration of pending) {
      const toggleForeignKeys = migration.needsForeignKeysOff;

      // Must sit outside the transaction — the pragma is ignored inside one.
      if (toggleForeignKeys) db.pragma('foreign_keys = OFF');

      try {
        // DDL and its bookkeeping row commit together, or neither does.
        const apply = db.transaction(() => {
          db.exec(migration.sql);
          record.run(migration.id, migration.filename, new Date().toISOString());
        });
        apply();
        applied.push(migration.id);
        log(`Applied ${migration.filename}`);
      } catch (error) {
        const detail = error instanceof Error ? error.message : String(error);
        throw new Error(
          `Migration ${migration.filename} failed: ${detail}` +
            (backupPath ? `\nDatabase unchanged by this migration. Backup: ${backupPath}` : ''),
        );
      } finally {
        if (toggleForeignKeys) db.pragma('foreign_keys = ON');
      }
    }

    verifyIntegrity(db);
    log(`${applied.length} migration(s) applied.`);
    return { applied, skipped, backupPath };
  } finally {
    if (ownsConnection) db.close();
  }
}

// CLI entry point: `npm run db:migrate`
const invokedDirectly = process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1]);
if (invokedDirectly) {
  try {
    migrate();
  } catch (error) {
    console.error(error instanceof Error ? error.message : error);
    process.exit(1);
  }
}
