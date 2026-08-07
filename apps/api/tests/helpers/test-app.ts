/**
 * Test harness: an isolated database and a mounted app per suite.
 */

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import type { Express } from 'express';

export interface TestContext {
  readonly app: Express;
  readonly dir: string;
  /** Everything the logger has written, when the suite asked for capture. */
  readLog(): string;
  cleanup(): void;
}

/**
 * Each suite gets its own SQLite file. env is set before any module that reads
 * it is imported, then modules are loaded dynamically so the config picks it up.
 */
export async function createTestContext(
  name: string,
  options: { readonly captureLogs?: boolean } = {},
): Promise<TestContext> {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), `bktc-${name}-`));

  process.env.NODE_ENV = 'test';
  process.env.DATABASE_PATH = path.join(dir, 'test.db');
  process.env.UPLOADS_DIR = path.join(dir, 'uploads');
  process.env.TMP_DIR = path.join(dir, 'tmp');

  /*
   * Suites are silent by default so a failing test's output is readable. The
   * privacy suite turns logging on and points it at a file, because "the logs
   * do not contain a candidate's salary" is only a real assertion if the logs
   * actually contain something.
   */
  if (options.captureLogs) {
    process.env.LOG_LEVEL = 'info';
    process.env.LOG_DESTINATION = path.join(dir, 'app.log');
  } else {
    process.env.LOG_LEVEL = 'silent';
    delete process.env.LOG_DESTINATION;
  }
  process.env.APP_ORIGIN = 'http://localhost:5173';
  process.env.TRUST_PROXY_HOPS = '0';

  const { openDatabase, closeDatabase } = await import('../../src/db/client.js');
  const { migrate } = await import('../../src/db/migrate.js');
  const { seed } = await import('../../src/db/seed.js');
  const { createApp } = await import('../../src/app.js');

  const db = openDatabase({ path: process.env.DATABASE_PATH });
  migrate({ db, databasePath: process.env.DATABASE_PATH, silent: true });
  db.close();

  const { getDb } = await import('../../src/db/client.js');
  seed(getDb(), { silent: true });

  const logPath = path.join(dir, 'app.log');

  return {
    app: createApp(),
    dir,
    readLog() {
      try {
        return fs.readFileSync(logPath, 'utf8');
      } catch {
        return '';
      }
    },
    cleanup() {
      closeDatabase();
      fs.rmSync(dir, { recursive: true, force: true });
    },
  };
}

/** Header set by the real client on every unsafe method; the CSRF guard requires it. */
export const CSRF_HEADER = { 'X-Requested-With': 'XMLHttpRequest' } as const;

/** Pulls the session cookie out of a Set-Cookie header for reuse. */
export function sessionCookie(res: { headers: Record<string, unknown> }): string {
  const raw = res.headers['set-cookie'];
  const cookies = Array.isArray(raw) ? raw : [raw];
  const found = cookies.find((c) => typeof c === 'string' && c.startsWith('bktc_session='));
  if (typeof found !== 'string') throw new Error('No session cookie in response');
  return found.split(';')[0]!;
}
