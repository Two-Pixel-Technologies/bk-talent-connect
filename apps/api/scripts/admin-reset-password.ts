/**
 * Resets any user's password from the command line and revokes their sessions.
 *
 * The second half of the break-glass procedure. Sets must_change_password so
 * the temporary credential cannot become permanent.
 *
 *   npm run admin:reset-password -- --email a@b.com --password 'newsecret12'
 */

import { getDb, closeDatabase } from '../src/db/client.js';
import * as userRepo from '../src/repositories/user.repo.js';
import * as sessionRepo from '../src/repositories/session.repo.js';
import { hashPassword } from '../src/lib/password.js';
import { LIMITS } from '@bktc/shared';

function arg(name: string): string | undefined {
  const index = process.argv.indexOf(`--${name}`);
  return index !== -1 ? process.argv[index + 1] : undefined;
}

async function main(): Promise<void> {
  const email = arg('email');
  const password = arg('password');

  if (!email || !password) {
    console.error('Usage: npm run admin:reset-password -- --email <email> --password <password>');
    process.exit(1);
  }

  if (password.length < LIMITS.password.min) {
    console.error(`Password must be at least ${LIMITS.password.min} characters.`);
    process.exit(1);
  }

  getDb();

  const user = userRepo.findByEmail(email);
  if (!user) {
    console.error(`No account found for ${email}.`);
    process.exit(1);
  }

  const passwordHash = await hashPassword(password);
  userRepo.updatePassword(user.id, passwordHash, true);
  const revoked = sessionRepo.deleteAllForUser(user.id);

  console.log(`Password reset for ${email}.`);
  console.log(`Revoked ${revoked} active session(s). They must change it at next sign-in.`);
  closeDatabase();
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
