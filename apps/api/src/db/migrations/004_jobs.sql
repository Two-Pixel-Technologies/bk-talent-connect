-- 004_jobs: job postings and their skills.

CREATE TABLE job (
  id                      TEXT PRIMARY KEY,
  employer_profile_id     TEXT NOT NULL REFERENCES employer_profile (id) ON DELETE CASCADE,

  title                   TEXT NOT NULL,
  department              TEXT,
  number_of_positions     INTEGER NOT NULL DEFAULT 1,
  sector_id               INTEGER REFERENCES sector (id),
  functional_area_id      INTEGER REFERENCES functional_area (id),
  city_id                 INTEGER REFERENCES city (id),
  state                   TEXT,
  work_type               TEXT CHECK (work_type IS NULL OR work_type IN ('ONSITE','HYBRID','REMOTE')),

  min_experience          REAL,
  max_experience          REAL,
  education_requirement   TEXT CHECK (education_requirement IS NULL OR education_requirement IN ('ANY','DIPLOMA','BE','BTECH','MTECH')),

  description             TEXT,
  target_joining_date     TEXT,

  -- CONFIDENTIAL. Admin and the owning employer only. Never serialised into a
  -- candidate-facing or public view — the proposal makes this a hard guarantee
  -- in the same way candidate salary expectations are.
  salary_band_min         INTEGER,
  salary_band_max         INTEGER,

  status                  TEXT NOT NULL DEFAULT 'DRAFT' REFERENCES job_status (code),
  published_at            TEXT,
  closed_at               TEXT,
  reviewed_at             TEXT,
  reviewed_by_id          TEXT REFERENCES user (id),
  review_note             TEXT,

  -- Contact details found in the description at submit time, surfaced to the
  -- admin reviewer. Flagged rather than blocked: "ISO 9001" and "10 years" look
  -- like numbers too, so a human decides.
  contact_flags           TEXT CHECK (contact_flags IS NULL OR json_valid(contact_flags)),

  -- Snapshot of the last approved state, so a re-review shows what changed (D3).
  last_approved_snapshot  TEXT,

  created_at              TEXT NOT NULL,
  updated_at              TEXT NOT NULL,
  deleted_at              TEXT
) STRICT;

-- Every employer page load lists that employer's own jobs by status.
CREATE INDEX idx_job_employer ON job (employer_profile_id, status, created_at);

-- Public/candidate listing: filter on status, then sector/function/city, and
-- order by publication date. published_at is in the index so the listing does
-- not filesort on every page.
CREATE INDEX idx_job_public ON job (status, sector_id, city_id, published_at);
CREATE INDEX idx_job_status_published ON job (status, published_at);

CREATE TABLE job_skill (
  job_id       TEXT NOT NULL REFERENCES job (id) ON DELETE CASCADE,
  skill_id     INTEGER NOT NULL REFERENCES skill (id),
  requirement  TEXT NOT NULL CHECK (requirement IN ('REQUIRED','GOOD_TO_HAVE')),
  PRIMARY KEY (job_id, skill_id)
) STRICT;

-- Reverse direction, for finding jobs by skill.
CREATE INDEX idx_job_skill_skill ON job_skill (skill_id, requirement);
