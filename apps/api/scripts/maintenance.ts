/**
 * The weekly maintenance run.
 *
 *   npm run maintenance          # from the app directory, weekly cron
 *
 * Prints what it removed, so the cron mail is worth reading. It is deliberately
 * a script and not a setInterval inside the API process: a sweep that only runs
 * while the server happens to be up is a sweep nobody can prove ran, and pm2
 * restarts would reset the clock every deploy.
 *
 * Plan reference: HIGH-5, MEDIUM-8.
 */

import { getDb, closeDatabase } from '../src/db/client.js';
import { runRetentionSweep } from '../src/modules/privacy/retention.js';

function main(): void {
  // Touch the connection first so a broken DATABASE_PATH fails here rather
  // than halfway through the sweep.
  getDb().prepare('SELECT 1').get();

  const result = runRetentionSweep();

  process.stdout.write(
    [
      'Retention sweep:',
      `  sessions removed         : ${result.sessionsRemoved}`,
      `  orphaned notes removed   : ${result.orphanedNotes}`,
      `  superseded CVs removed   : ${result.supersededFiles}`,
      `  stale temp files removed : ${result.staleTempFiles}`,
      `  orphaned uploads removed : ${result.orphanedFiles}`,
      '',
    ].join('\n'),
  );

  closeDatabase();
}

main();
