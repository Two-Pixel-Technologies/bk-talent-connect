/**
 * Structured logging.
 *
 * The redact list is a privacy control, not hygiene. The serializer layer keeps
 * salaries and contact details out of API responses, but logs bypass it
 * entirely — better-sqlite3 error messages include the SQL text, and zod
 * validation errors carry the offending values. Without redaction a candidate's
 * CTC ends up in plaintext in pm2's log files, and the pre-launch privacy audit
 * (which only inspects DevTools) would pass while leaking.
 *
 * Plan reference: HIGH-23.
 */

import pino from 'pino';
import { randomUUID } from 'node:crypto';
import type { IncomingMessage, ServerResponse } from 'node:http';
import { env } from '../config/env.js';

const REDACT_PATHS = [
  'req.headers.cookie',
  'req.headers.authorization',
  'res.headers["set-cookie"]',
  '*.password',
  '*.passwordHash',
  '*.password_hash',
  '*.currentSalary',
  '*.current_salary',
  '*.expectedSalaryMin',
  '*.expected_salary_min',
  '*.expectedSalaryMax',
  '*.expected_salary_max',
  '*.salaryBandMin',
  '*.salary_band_min',
  '*.salaryBandMax',
  '*.salary_band_max',
  '*.mobile',
  '*.email',
  '*.token',
  '*.tokenHash',
  '*.token_hash',
];

export const logger = pino({
  level: env.LOG_LEVEL,
  redact: { paths: REDACT_PATHS, censor: '[redacted]' },
  ...(env.isProduction
    ? {}
    : { transport: { target: 'pino/file', options: { destination: 1 } } }),
});

export function newRequestId(): string {
  return randomUUID();
}

export const httpLoggerOptions = {
  logger,
  genReqId: (req: IncomingMessage, res: ServerResponse) => {
    const existing = req.headers['x-request-id'];
    const id = typeof existing === 'string' && existing.length > 0 ? existing : newRequestId();
    res.setHeader('X-Request-Id', id);
    return id;
  },
  // Health checks would otherwise dominate the log at info level.
  autoLogging: {
    ignore: (req: IncomingMessage) => req.url === '/api/health',
  },
  customLogLevel: (_req: IncomingMessage, res: ServerResponse, err?: Error) => {
    if (err || res.statusCode >= 500) return 'error';
    if (res.statusCode >= 400) return 'warn';
    return 'info';
  },
};
