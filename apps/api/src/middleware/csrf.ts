/**
 * CSRF controls for a cookie-authenticated same-origin SPA.
 *
 * The cookie is SameSite=Lax rather than Strict on purpose: with a WhatsApp
 * button on every public page, Strict means an inbound WhatsApp link lands the
 * user logged-out, which is a guaranteed support ticket. Lax alone would allow
 * cross-site top-level GET navigation to carry the cookie, so state-changing
 * methods get two additional checks:
 *
 *   1. Origin / Sec-Fetch-Site must indicate a same-origin request.
 *   2. A custom X-Requested-With header must be present — a header a simple
 *      cross-origin form post cannot set without triggering CORS preflight.
 *
 * Together these are strictly stronger than SameSite=Strict alone, and they do
 * not break inbound links.
 *
 * Plan reference: MEDIUM-23.
 */

import type { RequestHandler } from 'express';
import { env } from '../config/env.js';
import { forbidden } from '../lib/errors.js';

const UNSAFE_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

export const csrfGuard: RequestHandler = (req, _res, next) => {
  if (!UNSAFE_METHODS.has(req.method)) return next();

  const secFetchSite = req.get('sec-fetch-site');
  if (secFetchSite && secFetchSite !== 'same-origin' && secFetchSite !== 'none') {
    return next(forbidden('Cross-site request blocked.'));
  }

  const origin = req.get('origin');
  if (origin && origin !== env.APP_ORIGIN) {
    return next(forbidden('Cross-origin request blocked.'));
  }

  if (!req.get('x-requested-with')) {
    return next(forbidden('Missing X-Requested-With header.'));
  }

  next();
};
