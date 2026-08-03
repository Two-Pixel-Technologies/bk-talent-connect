/**
 * Creates an admin account from the command line.
 *
 * This is the break-glass procedure. There is no self-serve password reset in
 * Phase 1 (email is Phase 2), so if the last admin is locked out the only route
 * back in is this script over SSH. It exists so that route does not involve
 * hand-generating an argon2 hash at 11pm.
 *
 *   npm run admin:create -- --email a@b.com --password 'secret1234'
 *   SEED_ADMIN_EMAIL=... SEED_ADMIN_PASSWORD=... npm run admin:create
 *
 * Plan reference: HIGH-6, HIGH-18.
 */

import { getDb, closeDatabase } from '../src/db/client.js';
import * as userRepo from '../src/repositories/user.repo.js';
import { hashPassword } from '../src/lib/password.js';
import { env } from '../src/config/env.js';
import { LIMITS } from '@bktc/shared';

function arg(name: string): string | undefined {
  const index = process.argv.indexOf(`--${name}`);
  return index !== -1 ? process.argv[index + 1] : undefined;
}

async function main(): Promise<void> {
  const email = arg('email') ?? env.SEED_ADMIN_EMAIL;
  const password = arg('password') ?? env.SEED_ADMIN_PASSWORD;

  if (!email || !password) {
    console.error(
      'Usage: npm run admin:create -- --email <email> --password <password>\n' +
        '   or set SEED_ADMIN_EMAIL and SEED_ADMIN_PASSWORD.',
    );
    process.exit(1);
  }

  if (password.length < LIMITS.password.min) {
    console.error(`Password must be at least ${LIMITS.password.min} characters.`);
    process.exit(1);
  }

  getDb();

  if (userRepo.emailExists(email)) {
    console.error(`An account already exists for ${email}.`);
    process.exit(1);
  }

  const passwordHash = await hashPassword(password);
  const id = userRepo.create({ email, passwordHash, role: 'ADMIN' });

  console.log(`Created admin ${email} (${id}).`);
  console.log(`Active admins: ${userRepo.countActiveAdmins()}`);
  closeDatabase();
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
