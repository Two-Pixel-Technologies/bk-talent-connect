/**
 * Auth routes.
 */

import { Router, type Request } from 'express';
import {
  loginSchema,
  registerCandidateSchema,
  registerEmployerSchema,
  changePasswordSchema,
  LIMITS,
} from '@bktc/shared';
import * as authService from './auth.service.js';
import * as userRepo from '../../repositories/user.repo.js';
import * as candidateRepo from '../../repositories/candidate.repo.js';
import * as employerRepo from '../../repositories/employer.repo.js';
import { toSelfView } from '../../serializers/user.serializer.js';
import { handle } from '../../lib/handle.js';
import { sendSerialized, sendNoContent } from '../../lib/respond.js';
import {
  SESSION_COOKIE,
  setSessionCookie,
  requireAuth,
  currentUser,
} from '../../middleware/auth.js';
import { loginByEmailLimiter, loginByIpLimiter, registerLimiter } from '../../middleware/rate-limit.js';
import { unauthenticated } from '../../lib/errors.js';

export const authRouter = Router();

function metaOf(req: Request) {
  return { ip: req.ip, userAgent: req.get('user-agent') };
}

authRouter.post(
  '/register/candidate',
  registerLimiter,
  handle(async (req, res) => {
    const input = registerCandidateSchema.parse(req.body);
    const result = await authService.registerCandidate(input, metaOf(req));
    setSessionCookie(res, result.token, result.expiresAt);
    sendSerialized(res, { userId: result.userId, role: 'CANDIDATE' }, 201);
  }),
);

authRouter.post(
  '/register/employer',
  registerLimiter,
  handle(async (req, res) => {
    const input = registerEmployerSchema.parse(req.body);
    const result = await authService.registerEmployer(input, metaOf(req));
    setSessionCookie(res, result.token, result.expiresAt);
    sendSerialized(res, { userId: result.userId, role: 'EMPLOYER' }, 201);
  }),
);

authRouter.post(
  '/login',
  loginByIpLimiter,
  loginByEmailLimiter,
  handle(async (req, res) => {
    const input = loginSchema.parse(req.body);
    const result = await authService.login(input, metaOf(req));
    setSessionCookie(res, result.token, result.expiresAt);

    const user = userRepo.findById(result.userId);
    if (!user) throw unauthenticated();
    sendSerialized(res, toSelfView(user));
  }),
);

authRouter.post('/logout', (req, res) => {
  if (req.sessionToken) authService.logout(req.sessionToken);
  res.clearCookie(SESSION_COOKIE, { path: '/' });
  sendNoContent(res);
});

/**
 * Returns the signed-in user plus the one piece of state every portal shell
 * needs on load: whether this account has cleared its approval gate.
 */
authRouter.get('/me', requireAuth, (req, res) => {
  const auth = currentUser(req);
  const user = userRepo.findById(auth.id);
  if (!user) throw unauthenticated();

  let approvalStatus: string | null = null;
  if (auth.role === 'CANDIDATE') {
    approvalStatus = candidateRepo.findByUserId(auth.id)?.profile_status ?? null;
  } else if (auth.role === 'EMPLOYER') {
    approvalStatus = employerRepo.findByUserId(auth.id)?.account_status ?? null;
  }

  sendSerialized(res, { ...toSelfView(user), approvalStatus });
});

authRouter.post(
  '/change-password',
  requireAuth,
  handle(async (req, res) => {
    const auth = currentUser(req);
    const input = changePasswordSchema.parse(req.body);
    if (!req.sessionToken) throw unauthenticated();
    await authService.changePassword(auth.id, input, req.sessionToken);
    sendNoContent(res);
  }),
);

/** Consent wording version and password rules, so the client never hardcodes them. */
authRouter.get('/policy', (_req, res) => {
  sendSerialized(res, {
    consentVersion: authService.CONSENT_VERSION,
    passwordMinLength: LIMITS.password.min,
  });
});
