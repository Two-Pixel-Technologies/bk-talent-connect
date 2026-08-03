/**
 * Server bootstrap.
 *
 * The SIGTERM handler is the reason deploys can use `pm2 reload` rather than
 * `restart`: without draining in-flight requests, a deploy during a 5MB resume
 * upload kills the write mid-stream and leaves a temp file with no database row.
 *
 * Plan reference: BLOCKER-6.
 */

import { createApp } from './app.js';
import { env } from './config/env.js';
import { logger } from './lib/logger.js';
import { closeDatabase, getDb } from './db/client.js';

const app = createApp();

// Open the database at boot so a misconfigured path fails immediately rather
// than on the first request.
getDb();

const server = app.listen(env.PORT, () => {
  logger.info(
    { port: env.PORT, env: env.NODE_ENV, version: env.APP_VERSION },
    'BK Talent Connect API listening',
  );
});

let shuttingDown = false;

function shutdown(signal: string): void {
  if (shuttingDown) return;
  shuttingDown = true;
  logger.info({ signal }, 'Shutting down');

  server.close((err) => {
    if (err) {
      logger.error({ err }, 'Error while closing the HTTP server');
      process.exit(1);
    }
    closeDatabase();
    logger.info('Shutdown complete');
    process.exit(0);
  });

  // Don't let a hung connection block a deploy indefinitely.
  setTimeout(() => {
    logger.warn('Forcing shutdown after timeout');
    closeDatabase();
    process.exit(1);
  }, 10_000).unref();
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));

process.on('unhandledRejection', (reason) => {
  logger.error({ reason }, 'Unhandled promise rejection');
});
