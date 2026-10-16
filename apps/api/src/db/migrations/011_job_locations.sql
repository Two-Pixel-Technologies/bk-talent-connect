-- 011_job_locations: additional hiring locations per job posting.

/*
 * `job.city_id`/`job.state` stay exactly as they are — the primary hiring
 * location, required at submission, unchanged by this migration. This table
 * holds only the EXTRA locations an employer adds beyond that one, so an
 * existing job with a single legacy location needs no backfill here at all:
 * it already has its one location on the job row, and simply has zero rows
 * in this table until someone adds more.
 *
 * A plain additive CREATE TABLE — no existing table or CHECK constraint is
 * touched, so this needs no foreign-keys-off rebuild.
 */
CREATE TABLE job_location (
  id          TEXT PRIMARY KEY,
  job_id      TEXT NOT NULL REFERENCES job (id),
  city_id     INTEGER REFERENCES city (id),
  state       TEXT NOT NULL,
  sort_order  INTEGER NOT NULL DEFAULT 0,
  created_at  TEXT NOT NULL
) STRICT;

CREATE INDEX idx_job_location_job ON job_location (job_id, sort_order);

-- A city+state pair appears at most once per job's extra-location list (the
-- primary city_id/state on the job row is a separate slot, not checked
-- here). Keyed on state too, not just city_id: the taxonomy's "Other" city
-- row is shared across every state as a wildcard, so city_id alone would
-- wrongly treat "Other, Punjab" and "Other, Kerala" as the same location.
CREATE UNIQUE INDEX idx_job_location_unique ON job_location (job_id, city_id, state);
