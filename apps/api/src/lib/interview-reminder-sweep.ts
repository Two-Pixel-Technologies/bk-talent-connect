/**
 * The 24-hour-before interview reminder (p8 row 8 — Email + WhatsApp, no
 * Portal). There is no cron dependency here: `runInterviewReminderSweep` is
 * a plain function, atomically claiming due interviews via
 * interview.repo.ts's claimDueReminders (see that function's comment for why
 * the claim is a single UPDATE ... RETURNING rather than a SELECT then an
 * UPDATE). index.ts calls it on a setInterval in the real server; tests call
 * it directly for determinism instead of waiting on a timer.
 */

import * as interviewRepo from '../repositories/interview.repo.js';
import { interviewReminder } from '../modules/notification/notification-events.js';
import { logger } from './logger.js';

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Claims and reminds every SCHEDULED interview landing in the next 24 hours
 * that has not already been reminded. Run this on a short interval (minutes,
 * not hours) relative to 24h — see env.ts's INTERVIEW_REMINDER_SWEEP_MS — so
 * an interview crosses the window once and is caught by the next tick rather
 * than needing to land in the window at the exact moment a once-daily job
 * runs.
 */
export function runInterviewReminderSweep(now: Date = new Date()): { remindedCount: number } {
  const windowStart = now.toISOString();
  const windowEnd = new Date(now.getTime() + DAY_MS).toISOString();

  const due = interviewRepo.claimDueReminders(windowStart, windowEnd);
  for (const interview of due) {
    try {
      interviewReminder({
        applicationId: interview.application_id,
        interviewId: interview.id,
        scheduledAt: interview.scheduled_at,
      });
    } catch (error) {
      // The claim already committed (reminder_sent_at is set), so this
      // interview will not be retried — logged for visibility, not thrown,
      // since one bad row must not stop the rest of the sweep.
      logger.error({ err: error, interviewId: interview.id }, 'interview reminder dispatch failed');
    }
  }

  return { remindedCount: due.length };
}
