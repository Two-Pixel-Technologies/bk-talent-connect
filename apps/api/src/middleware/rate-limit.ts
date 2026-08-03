/**
 * Rate limiting.
 *
 * The login limiter is keyed on email + IP, not IP alone. India's mobile
 * networks use CGNAT heavily, so thousands of legitimate users share an egress
 * address — a 5-per-IP limit would lock out real candidates on a shared
 * connection. Keying on the email bounds an attack on any single account while
 * leaving the IP ceiling generous enough for shared networks.
 *
 * This depends on `trust proxy` being set correctly in app.ts. Without it every
 * request appears to originate from 127.0.0.1 and five failed logins by anyone
 * lock out the entire platform.
 *
 * Plan reference: HIGH-21.
 */

import rateLimit from 'express-rate-limit';
import type { Request } from 'express';
import { env } from '../config/env.js';
import type { ApiErrorBody } from '@bktc/shared';

const limitedBody: ApiErrorBody = {
  error: { code: 'RATE_LIMITED', message: 'Too many attempts. Please try again shortly.' },
};

const shared = {
  standardHeaders: true as const,
  legacyHeaders: false as const,
  message: limitedBody,
  // Disabled entirely in tests, which fire many requests from one address.
  skip: () => env.isTest,
};

function emailOf(req: Request): string {
  const body = req.body as { email?: unknown } | undefined;
  return typeof body?.email === 'string' ? body.email.trim().toLowerCase() : 'anonymous';
}

/**
 * IPv6 addresses are bucketed to a /64 prefix. A single subscriber is routinely
 * handed a whole /64, so keying on the full address lets one client rotate
 * through billions of addresses and bypass the limit entirely.
 */
function ipKey(req: Request): string {
  const ip = req.ip ?? 'unknown';
  if (!ip.includes(':')) return ip;
  return ip.split(':').slice(0, 4).join(':') + '::/64';
}

/** Tight per-account bound: the control that actually stops credential stuffing. */
export const loginByEmailLimiter = rateLimit({
  ...shared,
  windowMs: 15 * 60 * 1000,
  limit: 5,
  keyGenerator: emailOf,
});

/** Loose per-IP ceiling, sized for CGNAT rather than per-user. */
export const loginByIpLimiter = rateLimit({
  ...shared,
  windowMs: 15 * 60 * 1000,
  limit: 30,
  keyGenerator: ipKey,
});

export const registerLimiter = rateLimit({
  ...shared,
  windowMs: 60 * 60 * 1000,
  limit: 10,
  keyGenerator: ipKey,
});

export const contactLimiter = rateLimit({
  ...shared,
  windowMs: 60 * 60 * 1000,
  limit: 5,
  keyGenerator: ipKey,
});
