/**
 * Resolves a recipient's email/mobile for channel dispatch (lib/channels.ts).
 *
 * Email always exists (user.email, NOT NULL). Mobile only exists for
 * candidates and employers — admins have no mobile column anywhere — so a
 * WhatsApp send to an admin is always a 'SKIPPED' delivery row, not a
 * failure.
 */

import * as userRepo from '../repositories/user.repo.js';
import * as candidateRepo from '../repositories/candidate.repo.js';
import * as employerRepo from '../repositories/employer.repo.js';
import type { Role } from '@bktc/shared';

export interface RecipientContact {
  readonly email: string | null;
  readonly mobile: string | null;
}

export function resolveContact(userId: string, role: Role): RecipientContact {
  const user = userRepo.findById(userId);
  const email = user?.email ?? null;

  if (role === 'CANDIDATE') {
    const profile = candidateRepo.findByUserId(userId);
    return { email, mobile: profile?.mobile ?? null };
  }
  if (role === 'EMPLOYER') {
    const profile = employerRepo.findByUserId(userId);
    return { email, mobile: profile?.hr_contact_phone ?? null };
  }
  // ADMIN: no mobile number is collected anywhere in the product today.
  return { email, mobile: null };
}
