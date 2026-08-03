/**
 * Schema-parity guard.
 *
 * Without an ORM, row types in db/rows.ts are hand-written and can silently
 * drift from the schema: rename a column in a migration, TypeScript still
 * compiles, and the bug surfaces in production as `undefined`.
 *
 * This test reads PRAGMA table_info for every table and asserts the live column
 * set exactly matches TABLE_COLUMNS — in both directions, so a column added to
 * the schema without being declared fails just as loudly as one removed.
 *
 * If this test is failing, do not weaken it. Update rows.ts to match the
 * migration, or fix the migration.
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { openDatabase, type Db } from '../src/db/client.js';
import { migrate } from '../src/db/migrate.js';
import { TABLE_COLUMNS } from '../src/db/rows.js';

interface ColumnInfo {
  cid: number;
  name: string;
  type: string;
  notnull: number;
  dflt_value: string | null;
  pk: number;
}

let db: Db;
let tempDir: string;

beforeAll(() => {
  tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'bktc-parity-'));
  const dbPath = path.join(tempDir, 'test.db');
  db = openDatabase({ path: dbPath });
  migrate({ db, databasePath: dbPath, silent: true });
});

afterAll(() => {
  db?.close();
  fs.rmSync(tempDir, { recursive: true, force: true });
});

function liveColumns(table: string): ColumnInfo[] {
  return db.pragma(`table_info(${table})`) as ColumnInfo[];
}

function liveTableNames(): string[] {
  const rows = db
    .prepare(
      `SELECT name FROM sqlite_master
       WHERE type = 'table'
         AND name NOT LIKE 'sqlite_%'
       ORDER BY name`,
    )
    .all() as { name: string }[];
  return rows.map((r) => r.name);
}

describe('schema parity', () => {
  it('declares every table that exists in the database', () => {
    const live = liveTableNames();
    const declared = Object.keys(TABLE_COLUMNS);
    const undeclared = live.filter((t) => !declared.includes(t));

    expect(
      undeclared,
      `Tables exist in the schema but are not declared in db/rows.ts: ${undeclared.join(', ')}`,
    ).toEqual([]);
  });

  it('does not declare tables that no longer exist', () => {
    const live = liveTableNames();
    const declared = Object.keys(TABLE_COLUMNS);
    const missing = declared.filter((t) => !live.includes(t));

    expect(
      missing,
      `Tables declared in db/rows.ts do not exist in the schema: ${missing.join(', ')}`,
    ).toEqual([]);
  });

  describe.each(Object.keys(TABLE_COLUMNS))('%s', (table) => {
    it('column names match exactly', () => {
      const spec = TABLE_COLUMNS[table]!;
      const live = liveColumns(table).map((c) => c.name).sort();
      const declared = Object.keys(spec.columns).sort();

      const missingFromRows = live.filter((c) => !declared.includes(c));
      const missingFromSchema = declared.filter((c) => !live.includes(c));

      expect(
        missingFromRows,
        `${table}: columns in the database but not in rows.ts — ${missingFromRows.join(', ')}`,
      ).toEqual([]);
      expect(
        missingFromSchema,
        `${table}: columns in rows.ts but not in the database — ${missingFromSchema.join(', ')}`,
      ).toEqual([]);
    });

    it('nullability matches', () => {
      const spec = TABLE_COLUMNS[table]!;
      const mismatches: string[] = [];

      for (const column of liveColumns(table)) {
        const declaredNotNull = spec.columns[column.name];
        if (declaredNotNull === undefined) continue; // covered by the names test

        // A PK is implicitly NOT NULL except for INTEGER PRIMARY KEY rowid
        // aliases, which SQLite allows to be null on insert (it autofills).
        const isRowidAlias = column.pk === 1 && column.type.toUpperCase() === 'INTEGER';
        const actualNotNull = column.notnull === 1 || (column.pk === 1 && !isRowidAlias);

        if (actualNotNull !== declaredNotNull) {
          mismatches.push(
            `${column.name}: schema says ${actualNotNull ? 'NOT NULL' : 'nullable'}, rows.ts says ${declaredNotNull ? 'NOT NULL' : 'nullable'}`,
          );
        }
      }

      expect(mismatches, `${table}: ${mismatches.join('; ')}`).toEqual([]);
    });
  });
});

describe('database configuration', () => {
  it('runs in WAL mode', () => {
    const [row] = db.pragma('journal_mode') as { journal_mode: string }[];
    expect(row?.journal_mode).toBe('wal');
  });

  it('enforces foreign keys', () => {
    const [row] = db.pragma('foreign_keys') as { foreign_keys: number }[];
    expect(row?.foreign_keys).toBe(1);
  });

  it('rejects a foreign key violation', () => {
    // session.user_id references user.id. FKs are OFF by default in SQLite, so
    // this asserts the pragma in client.ts actually took effect.
    expect(() =>
      db
        .prepare(
          `INSERT INTO session (id, token_hash, user_id, expires_at, created_at)
           VALUES ('s1', 'hash1', 'no-such-user', '2030-01-01T00:00:00.000Z', '2026-01-01T00:00:00.000Z')`,
        )
        .run(),
    ).toThrow(/FOREIGN KEY constraint failed/i);
  });

  it('rejects a bad enum value via CHECK constraint', () => {
    expect(() =>
      db
        .prepare(
          `INSERT INTO user (id, email, password_hash, role, status, must_change_password, created_at, updated_at)
           VALUES ('u1', 'x@example.com', 'hash', 'SUPERUSER', 'ACTIVE', 0, '2026-01-01T00:00:00.000Z', '2026-01-01T00:00:00.000Z')`,
        )
        .run(),
    ).toThrow(/CHECK constraint failed/i);
  });

  it('treats email as case-insensitive for uniqueness', () => {
    const insert = db.prepare(
      `INSERT INTO user (id, email, password_hash, role, status, must_change_password, created_at, updated_at)
       VALUES (?, ?, 'hash', 'CANDIDATE', 'ACTIVE', 0, '2026-01-01T00:00:00.000Z', '2026-01-01T00:00:00.000Z')`,
    );
    insert.run('u-case-1', 'Case@Example.com');
    expect(() => insert.run('u-case-2', 'case@example.com')).toThrow(/UNIQUE constraint failed/i);
  });
});

describe('migration runner', () => {
  it('is idempotent', () => {
    const result = migrate({ db, silent: true });
    expect(result.applied).toEqual([]);
    expect(result.skipped.length).toBeGreaterThan(0);
  });
});
