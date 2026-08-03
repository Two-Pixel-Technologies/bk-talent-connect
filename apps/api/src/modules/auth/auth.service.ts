/**
 * Authentication use cases.
 */

import { transaction } from '../../repositories/tx.js';
import * as userRepo from '../../repositories/user.repo.js';
import * as sessionRepo from '../../repositories/session.repo.js';
import * as candidateRepo from '../../repositories/candidate.repo.js';
import * as employerRepo from '../../repositories/employer.repo.js';
import { hashPassword, verifyPassword } from '../../lib/password.js';
import { conflict, unauthenticated, badRequest } from '../../lib/errors.js';
import type {
  RegisterCandidateInput,
  RegisterEmployerInput,
  LoginInput,
  ChangePasswordInput,
} from '@bktc/shared';

/** Bumped when the consent wording changes, so old consents stay identifiable. */
export const CONSENT_VERSION = '2026-08-v1';

export interface SessionMeta {
  readonly ip?: string | undefined;
  readonly userAgent?: string | undefined;
}

export interface AuthResult {
  readonly userId: string;
  readonly token: string;
  readonly expiresAt: string;
}

export async function registerCandidate(
  input: RegisterCandidateInput,
  meta: SessionMeta,
): Promise<AuthResult> {
  if (userRepo.emailExists(input.email)) {
    // Registration necessarily confirms an address is in use. Avoiding this
    // needs email verification, which is Phase 2. Rate-limited and accepted;
    // login itself stays generic. See docs/SECURITY_NOTES.md.
    throw conflict('An account with that email already exists.');
  }

  const passwordHash = await hashPassword(input.password);

  // User row and profile row commit together — a user with no profile would be
  // a permanently broken account with no route to fix it from the UI.
  const userId = transaction(() => {
    const id = userRepo.create({ email: input.email, passwordHash, role: 'CANDIDATE' });
    candidateRepo.create({
      userId: id,
      fullName: input.fullName,
      mobile: input.mobile,
      consentVersion: CONSENT_VERSION,
    });
    return id;
  });

  const session = sessionRepo.create(userId, meta);
  return { userId, ...session };
}

export async function registerEmployer(
  input: RegisterEmployerInput,
  meta: SessionMeta,
): Promise<AuthResult> {
  if (userRepo.emailExists(input.email)) {
    throw conflict('An account with that email already exists.');
  }

  const passwordHash = await hashPassword(input.password);

  const userId = transaction(() => {
    const id = userRepo.create({ email: input.email, passwordHash, role: 'EMPLOYER' });
    employerRepo.create({
      userId: id,
      companyName: input.companyName,
      hrContactName: input.hrContactName,
      hrContactEmail: input.email,
      hrContactPhone: input.hrContactPhone,
    });
    return id;
  });

  const session = sessionRepo.create(userId, meta);
  return { userId, ...session };
}

/**
 * Deliberately uniform: a wrong password and an unknown address produce the
 * same error, and both paths run a hash comparison so response timing does not
 * distinguish them either.
 */
export async function login(input: LoginInput, meta: SessionMeta): Promise<AuthResult> {
  const user = userRepo.findByEmail(input.email);

  if (!user) {
    // Burn comparable time against a dummy hash so a missing account is not
    // detectable by how fast the request fails.
    await verifyPassword(
      '$argon2id$v=19$m=19456,t=2,p=1$c29tZXNhbHR2YWx1ZQ$0000000000000000000000000000000000000000000',
      input.password,
    );
    throw unauthenticated('Email or password is incorrect.');
  }

  const ok = await verifyPassword(user.password_hash, input.password);
  if (!ok) throw unauthenticated('Email or password is incorrect.');

  if (user.status !== 'ACTIVE') {
    throw unauthenticated('This account has been suspended. Please contact BK Talent Connect.');
  }

  userRepo.recordLogin(user.id);
  const session = sessionRepo.create(user.id, meta);
  return { userId: user.id, ...session };
}

export function logout(token: string): void {
  sessionRepo.deleteByToken(token);
}

export async function changePassword(
  userId: string,
  input: ChangePasswordInput,
  currentToken: string,
): Promise<void> {
  const user = userRepo.findById(userId);
  if (!user) throw unauthenticated();

  const ok = await verifyPassword(user.password_hash, input.currentPassword);
  if (!ok) throw badRequest('Your current password is incorrect.', [
    { path: 'currentPassword', message: 'Incorrect password.' },
  ]);

  const passwordHash = await hashPassword(input.newPassword);
  userRepo.updatePassword(userId, passwordHash, false);

  // Every other session dies. Otherwise resetting a compromised account's
  // password leaves the attacker signed in.
  sessionRepo.deleteAllForUser(userId, currentToken);
}
