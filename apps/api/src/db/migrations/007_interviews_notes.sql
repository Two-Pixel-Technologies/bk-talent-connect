-- 007_interviews_notes: interview coordination, employer interview requests,
-- and private admin notes.

CREATE TABLE interview (
  id                      TEXT PRIMARY KEY,
  application_id          TEXT NOT NULL REFERENCES application (id) ON DELETE CASCADE,

  -- UTC ISO-8601 with an explicit Z, like every other timestamp. Rendered in
  -- Asia/Kolkata with an "IST" suffix everywhere it is shown: this app
  -- schedules interviews, and a 5.5-hour error means a candidate misses one.
  scheduled_at            TEXT NOT NULL,
  duration_minutes        INTEGER NOT NULL DEFAULT 45,
  mode                    TEXT NOT NULL CHECK (mode IN ('PHONE','VIDEO','ONSITE')),
  location_or_link        TEXT NOT NULL,
  instructions            TEXT,

  status                  TEXT NOT NULL DEFAULT 'SCHEDULED'
                            CHECK (status IN ('SCHEDULED','COMPLETED','CANCELLED','RESCHEDULED')),

  -- The proposal says BK "schedules and confirms with both parties". Without
  -- these, confirming is something that happens over the phone and is invisible
  -- to whoever picks the conversation up next.
  candidate_confirmed_at  TEXT,
  employer_confirmed_at   TEXT,

  -- Set when this interview is replaced by a rescheduled one, so the original
  -- time survives rather than being overwritten in place.
  superseded_by_id        TEXT REFERENCES interview (id),

  created_by_id           TEXT NOT NULL REFERENCES user (id),
  created_at              TEXT NOT NULL,
  updated_at              TEXT NOT NULL
) STRICT;

CREATE INDEX idx_interview_application ON interview (application_id, scheduled_at);
CREATE INDEX idx_interview_upcoming ON interview (status, scheduled_at);

-- One live interview per application. A partial index is the right tool: an
-- application may accumulate several cancelled or superseded rows over time,
-- but only ever one that is actually happening.
CREATE UNIQUE INDEX idx_interview_one_scheduled
  ON interview (application_id) WHERE status = 'SCHEDULED';

/*
 * The employer's way of saying "I want to meet this person".
 *
 * The proposal's REVIEWING column says an employer "can request an interview",
 * but BK does the scheduling. Without this the employer's only signal was to
 * shortlist and hope somebody noticed.
 */
CREATE TABLE interview_request (
  id               TEXT PRIMARY KEY,
  application_id   TEXT NOT NULL REFERENCES application (id) ON DELETE CASCADE,
  requested_by_id  TEXT NOT NULL REFERENCES user (id),
  preferred_slots  TEXT CHECK (preferred_slots IS NULL OR json_valid(preferred_slots)),
  note             TEXT,
  status           TEXT NOT NULL DEFAULT 'OPEN' CHECK (status IN ('OPEN','ARRANGED','DECLINED')),
  resolved_at      TEXT,
  created_at       TEXT NOT NULL
) STRICT;

CREATE INDEX idx_interview_request_open ON interview_request (status, created_at);
CREATE INDEX idx_interview_request_application ON interview_request (application_id);

/*
 * Private admin notes.
 *
 * Polymorphic by design, so one table serves candidates, employers, jobs and
 * applications. There is no foreign key to the target — that is the trade-off,
 * and the weekly cron sweeps orphans.
 *
 * These are never serialised into any candidate- or employer-facing view.
 */
CREATE TABLE admin_note (
  id           TEXT PRIMARY KEY,
  author_id    TEXT NOT NULL REFERENCES user (id),
  entity_type  TEXT NOT NULL CHECK (entity_type IN ('CANDIDATE','EMPLOYER','JOB','APPLICATION')),
  entity_id    TEXT NOT NULL,
  body         TEXT NOT NULL,
  created_at   TEXT NOT NULL,
  updated_at   TEXT NOT NULL
) STRICT;

CREATE INDEX idx_admin_note_entity ON admin_note (entity_type, entity_id, created_at);
