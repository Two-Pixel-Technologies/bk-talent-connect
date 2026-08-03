/**
 * Transaction boundary for services.
 *
 * Services must not import the database client — the lint rule keeps SQL inside
 * repositories. But a service still needs to compose several repository calls
 * into one atomic write (registering a user creates both a user row and a
 * profile row; a user with no profile is a permanently broken account).
 *
 * This is the sanctioned seam: services get atomicity, and still cannot issue a
 * query of their own.
 *
 * Note better-sqlite3 transactions are synchronous and cannot contain async
 * work. Anything awaited — password hashing, file writes — happens before the
 * transaction opens.
 */

import { getDb } from '../db/client.js';

export function transaction<T>(fn: () => T): T {
  return getDb().transaction(fn)();
}
