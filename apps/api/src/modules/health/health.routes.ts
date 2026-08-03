/**
 * Health and version endpoints.
 *
 * /api/health actually checks its dependencies. A health endpoint that returns
 * ok from a process which cannot read its database is worse than none at all —
 * it is what the uptime monitor polls, so a false ok means an outage nobody is
 * told about.
 *
 * Plan reference: MEDIUM-33, HIGH-9.
 */

import { Router } from 'express';
import fs from 'node:fs';
import type { HealthBody } from '@bktc/shared';
import { checkDatabase } from '../../db/client.js';
import { env } from '../../config/env.js';
import { sendSerialized } from '../../lib/respond.js';

export const healthRouter = Router();

function uploadsWritable(): boolean {
  try {
    fs.mkdirSync(env.uploadsDir, { recursive: true });
    fs.accessSync(env.uploadsDir, fs.constants.W_OK);
    return true;
  } catch {
    return false;
  }
}

healthRouter.get('/health', (_req, res) => {
  const checks = {
    database: checkDatabase(),
    uploadsWritable: uploadsWritable(),
  };
  const healthy = checks.database && checks.uploadsWritable;

  const body: HealthBody = {
    status: healthy ? 'ok' : 'degraded',
    version: env.APP_VERSION,
    checks,
  };

  sendSerialized(res, body, healthy ? 200 : 503);
});

/**
 * Compared by the SPA against its build-time version. A mismatch means the user
 * is running a bundle from before the last deploy and should reload — otherwise
 * they hit 404s on chunks that no longer exist.
 */
healthRouter.get('/version', (_req, res) => {
  sendSerialized(res, { version: env.APP_VERSION });
});
