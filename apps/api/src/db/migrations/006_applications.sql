-- 006_applications: the pipeline.

CREATE TABLE application (
  id                       TEXT PRIMARY KEY,
  job_id                   TEXT NOT NULL REFERENCES job (id) ON DELETE CASCADE,
  candidate_profile_id     TEXT NOT NULL REFERENCES candidate_profile (id) ON DELETE CASCADE,

  source                   TEXT NOT NULL DEFAULT 'APPLIED'
                             CHECK (source IN ('APPLIED','ADMIN_RECOMMENDED')),
  stage                    TEXT NOT NULL DEFAULT 'APPLIED' REFERENCES application_stage (code),

  -- "Recommended by Us": pinned to the top of the employer's list. Set when an
  -- admin puts a candidate forward for a role they did not apply to (P6).
  is_recommended           INTEGER NOT NULL DEFAULT 0 CHECK (is_recommended IN (0, 1)),
  recommended_by_id        TEXT REFERENCES user (id),
  recommended_at           TEXT,

  applied_at               TEXT NOT NULL,
  last_stage_change_at     TEXT NOT NULL,

  -- Phase 2 reports "employer response time", which needs the FIRST action, not
  -- the last view. Cannot be reconstructed later, so it is captured now.
  first_employer_action_at TEXT,
  employer_last_viewed_at  TEXT,

  -- Structured, because Phase 2 breaks rejections down by stage and a free-text
  -- note cannot be aggregated after the fact.
  outcome_reason_code      TEXT,

  -- Which CV the employer actually evaluated. A candidate can replace their
  -- resume at any time; without this snapshot an employer's shortlist decision
  -- would silently refer to a document that no longer exists.
  resume_file_id_at_apply  TEXT REFERENCES file_asset (id),

  created_at               TEXT NOT NULL,
  updated_at               TEXT NOT NULL,

  -- One application per candidate per job. Re-applying after withdrawing
  -- reuses this row rather than creating a second one.
  UNIQUE (job_id, candidate_profile_id)
) STRICT;

-- The employer's applicant list: filter by job and stage, recommended pinned
-- first, then by date. id is the final tiebreak — SQLite gives no ordering
-- guarantee for ties, so without it paginated rows can repeat or vanish.
CREATE INDEX idx_application_job ON application (job_id, is_recommended DESC, applied_at DESC, id);
CREATE INDEX idx_application_job_stage ON application (job_id, stage, applied_at);

-- The candidate's own list.
CREATE INDEX idx_application_candidate ON application (candidate_profile_id, applied_at DESC);

-- Append-only. Drives the candidate's tracker timeline, the admin 360° view,
-- and every Phase 2 duration metric (time-to-shortlist, time-to-hire). Writing
-- it now is what makes those computable retroactively.
CREATE TABLE application_stage_event (
  id               INTEGER PRIMARY KEY AUTOINCREMENT,
  application_id   TEXT NOT NULL REFERENCES application (id) ON DELETE CASCADE,
  from_stage       TEXT REFERENCES application_stage (code),
  to_stage         TEXT NOT NULL REFERENCES application_stage (code),
  changed_by_id    TEXT REFERENCES user (id),
  changed_by_role  TEXT NOT NULL CHECK (changed_by_role IN ('CANDIDATE','EMPLOYER','ADMIN','SYSTEM')),
  note             TEXT,
  created_at       TEXT NOT NULL
) STRICT;

-- The candidate's timeline is the flagship candidate-facing feature.
CREATE INDEX idx_stage_event_application ON application_stage_event (application_id, created_at);
