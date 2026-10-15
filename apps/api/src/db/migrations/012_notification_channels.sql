-- 012_notification_channels: email/WhatsApp delivery audit trail, and the
-- 24-hour interview reminder's idempotency marker.

/*
 * One row per (event, recipient, channel) delivery attempt.
 *
 * This is NOT the in-portal feed (see 008_notifications.sql's `notification`
 * table) — it exists so email/WhatsApp dispatch (currently a logging-only
 * transport pending real provider credentials, see apps/api/src/lib/
 * channels.ts) has an audit trail and so tests can assert a send was
 * attempted exactly once, without depending on a real provider being
 * configured. `status = 'SKIPPED'` covers a channel genuinely not
 * applicable (e.g. no mobile number on file for WhatsApp) rather than a
 * failure.
 */
CREATE TABLE notification_delivery (
  id          TEXT PRIMARY KEY,
  event       TEXT NOT NULL,
  channel     TEXT NOT NULL CHECK (channel IN ('EMAIL', 'WHATSAPP')),
  user_id     TEXT NOT NULL REFERENCES user (id) ON DELETE CASCADE,
  status      TEXT NOT NULL CHECK (status IN ('SENT', 'FAILED', 'SKIPPED')),
  detail      TEXT,
  created_at  TEXT NOT NULL
) STRICT;

CREATE INDEX idx_notification_delivery_event ON notification_delivery (event, created_at DESC);
CREATE INDEX idx_notification_delivery_user ON notification_delivery (user_id, created_at DESC);

/*
 * Idempotency marker for the 24-hour-before reminder sweep.
 *
 * NULL = not yet reminded. Set exactly once, atomically (UPDATE ... WHERE
 * reminder_sent_at IS NULL ... RETURNING id), so two overlapping sweep runs
 * cannot both claim the same interview and double-send.
 */
ALTER TABLE interview ADD COLUMN reminder_sent_at TEXT;
