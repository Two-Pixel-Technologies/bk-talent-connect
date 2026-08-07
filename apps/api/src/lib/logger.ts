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

/**
 * Written synchronously when a destination file is configured.
 *
 * The privacy suite reads this file back and greps it, so the write has to
 * have landed by the time the request finishes — a worker-thread transport
 * would flush whenever it felt like it and the grep would pass on an empty
 * file.
 */
const destination = env.LOG_DESTINATION
  ? pino.destination({ dest: env.LOG_DESTINATION, sync: true })
  : undefined;

export const logger = pino(
  {
    level: env.LOG_LEVEL,
    redact: { paths: REDACT_PATHS, censor: '[redacted]' },
    ...(env.isProduction || destination
      ? {}
      : { transport: { target: 'pino/file', options: { destination: 1 } } }),
  },
  destination,
);

/** Correlates every log line for one request. Internal to this module. */
function newRequestId(): string {
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
