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
import { runInterviewReminderSweep } from './lib/interview-reminder-sweep.js';

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

/*
 * The 24-hour interview reminder sweep. Not started under `test` — the test
 * suite calls runInterviewReminderSweep() directly for deterministic timing
 * instead of racing a live interval (see interview-reminder-sweep.ts).
 * `.unref()` so this interval alone never keeps the process alive.
 */
const reminderInterval = env.isTest
  ? undefined
  : setInterval(() => {
      try {
        const { remindedCount } = runInterviewReminderSweep();
        if (remindedCount > 0) logger.info({ remindedCount }, 'interview reminder sweep sent reminders');
      } catch (error) {
        logger.error({ err: error }, 'interview reminder sweep failed');
      }
    }, env.INTERVIEW_REMINDER_SWEEP_MS).unref();

let shuttingDown = false;

function shutdown(signal: string): void {
  if (shuttingDown) return;
  shuttingDown = true;
  logger.info({ signal }, 'Shutting down');

  if (reminderInterval) clearInterval(reminderInterval);

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
