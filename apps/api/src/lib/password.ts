/**
 * Password hashing.
 *
 * Parameters are pinned to the OWASP minimum argon2id profile rather than the
 * library defaults. node-argon2 defaults to m=65536 KiB — 64MB per concurrent
 * hash — on a droplet with 1GB total shared with nginx, Node and SQLite's page
 * cache. A handful of simultaneous logins is enough to cause memory pressure,
 * and with no swap that is an OOM kill.
 *
 * Plan reference: MEDIUM-21.
 */

import argon2 from 'argon2';

const OPTIONS = {
  type: argon2.argon2id,
  memoryCost: 19456, // 19 MiB
  timeCost: 2,
  parallelism: 1,
} as const;

export function hashPassword(plain: string): Promise<string> {
  return argon2.hash(plain, OPTIONS);
}

export async function verifyPassword(hash: string, plain: string): Promise<boolean> {
  try {
    return await argon2.verify(hash, plain);
  } catch {
    // A malformed hash must read as "wrong password", never as an error that
    // distinguishes this account from any other.
    return false;
  }
}
