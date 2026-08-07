-- 008_notifications: the in-portal notification feed.

/*
 * One row per recipient per event.
 *
 * Fan-out is written at dispatch time rather than computed on read: "all
 * admins" must mean the admins who existed when the thing happened, and a
 * read/unread flag belongs to a person, not to an event.
 *
 * Recipients come from NOTIFICATION_MATRIX in packages/shared, which is a
 * verbatim transcription of the Proposal p8 matrix. Nothing in this table is
 * written except through lib/notify.ts.
 */
CREATE TABLE notification (
  id          TEXT PRIMARY KEY,
  user_id     TEXT NOT NULL REFERENCES user (id) ON DELETE CASCADE,

  -- The matrix event, not free text: the tests walk the matrix and would not
  -- be able to find rows written under an ad-hoc name.
  event       TEXT NOT NULL,

  -- Copy is composed in notification-events.ts and stored, not templated at
  -- read time. A notification is a record of what we told someone; re-rendering
  -- it later from current data would rewrite history.
  title       TEXT NOT NULL,
  body        TEXT,

  /*
   * The link, stored structurally.
   *
   * A raw URL baked into a row outlives the route that produced it — every
   * path change orphans every historical notification, and the same event has
   * a different destination for a candidate than for an admin. Storing the
   * subject lets the client resolve the route for whoever is looking.
   */
  entity_type TEXT CHECK (entity_type IS NULL OR entity_type IN
                 ('CANDIDATE','EMPLOYER','JOB','APPLICATION','INTERVIEW')),
  entity_id   TEXT,

  read_at     TEXT,
  created_at  TEXT NOT NULL
) STRICT;

-- The feed query: one user's notifications, newest first.
CREATE INDEX idx_notification_feed ON notification (user_id, created_at DESC);

-- The unread badge, which runs on every portal page load. Partial, so it stays
-- small no matter how much history accumulates.
CREATE INDEX idx_notification_unread ON notification (user_id) WHERE read_at IS NULL;
