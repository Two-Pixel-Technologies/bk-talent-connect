/**
 * Authentication and authorisation middleware.
 */

import type { Request, RequestHandler, Response } from 'express';
import type { Role } from '@bktc/shared';
import * as sessionRepo from '../repositories/session.repo.js';
import * as userRepo from '../repositories/user.repo.js';
import { forbidden, unauthenticated } from '../lib/errors.js';
import { env } from '../config/env.js';

export const SESSION_COOKIE = 'bktc_session';

export interface AuthUser {
  readonly id: string;
  readonly email: string;
  readonly role: Role;
  readonly mustChangePassword: boolean;
}

declare module 'express-serve-static-core' {
  interface Request {
    user?: AuthUser;
    sessionToken?: string;
  }
}

/** Routes reachable while a forced password change is outstanding. */
const PASSWORD_CHANGE_EXEMPT = new Set([
  '/api/auth/change-password',
  '/api/auth/logout',
  '/api/auth/me',
]);

/**
 * Populates req.user when a valid session cookie is present. Does not reject —
 * requireAuth does that — so optional-auth routes can use the same lookup.
 */
/**
 * Writes the session cookie.
 *
 * Lives here rather than in auth.routes because two callers need it: login,
 * and the sliding-expiry refresh below. A cookie whose `Expires` is only ever
 * written at login cannot slide, whatever the database row says.
 */
export function setSessionCookie(res: Response, token: string, expiresAt: string): void {
  res.cookie(SESSION_COOKIE, token, {
    httpOnly: true,
    // Lax, not Strict: a WhatsApp link into the portal must not land the user
    // logged-out. CSRF is covered by the Origin + X-Requested-With checks.
    sameSite: 'lax',
    secure: env.isProduction,
    path: '/',
    expires: new Date(expiresAt),
  });
}

export const loadSession: RequestHandler = (req, res, next) => {
  const token = (req.cookies as Record<string, string> | undefined)?.[SESSION_COOKIE];
  if (!token) return next();

  const session = sessionRepo.findValidByToken(token);
  if (!session) return next();

  const user = userRepo.findById(session.user_id);
  // A suspended user's existing session stops working on its next request
  // rather than lasting until expiry.
  if (!user || user.status !== 'ACTIVE') return next();

  // Sliding expiry, as documented on LIMITS.session.lifetimeMs. Throttled
  // inside touchExpiry so this is neither a write nor a Set-Cookie on every
  // request — only when the expiry has actually moved by more than an hour.
  const extendedTo = sessionRepo.touchExpiry(session);
  if (extendedTo) setSessionCookie(res, token, extendedTo);

  req.user = {
    id: user.id,
    email: user.email,
    role: user.role as Role,
    mustChangePassword: user.must_change_password === 1,
  };
  req.sessionToken = token;
  next();
};

export const requireAuth: RequestHandler = (req, _res, next) => {
  if (!req.user) return next(unauthenticated());

  // Enforced here, not by a React redirect — a client-side guard is trivially
  // bypassed by calling the API directly.
  if (req.user.mustChangePassword && !PASSWORD_CHANGE_EXEMPT.has(req.path === '/' ? req.baseUrl : req.originalUrl.split('?')[0]!)) {
    return next(
      forbidden('You must change your password before continuing.'),
    );
  }
  next();
};

export function requireRole(...roles: readonly Role[]): RequestHandler {
  return (req, _res, next) => {
    if (!req.user) return next(unauthenticated());
    if (!roles.includes(req.user.role)) return next(forbidden());
    next();
  };
}

export function currentUser(req: Request): AuthUser {
  if (!req.user) throw unauthenticated();
  return req.user;
}
