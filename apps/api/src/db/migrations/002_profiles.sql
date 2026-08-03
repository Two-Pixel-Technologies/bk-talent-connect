-- 002_profiles: candidate and employer profiles, plus file storage.
--
-- Most columns are nullable because registration creates a near-empty DRAFT
-- profile and the wizard fills it in. Completeness is enforced at submit time by
-- zod, not by the schema — a NOT NULL here would make it impossible to save a
-- half-finished step, which is the whole point of a guided builder.

CREATE TABLE file_asset (
  id             TEXT PRIMARY KEY,
  owner_id       TEXT NOT NULL REFERENCES user (id) ON DELETE CASCADE,
  kind           TEXT NOT NULL CHECK (kind IN ('RESUME')),
  original_name  TEXT NOT NULL,
  stored_path    TEXT NOT NULL,
  mime_type      TEXT NOT NULL,
  size_bytes     INTEGER NOT NULL,
  checksum       TEXT NOT NULL,
  created_at     TEXT NOT NULL,
  deleted_at     TEXT
) STRICT;

-- Consulted on every download to authorise the request.
CREATE INDEX idx_file_asset_owner ON file_asset (owner_id);

CREATE TABLE candidate_profile (
  id                      TEXT PRIMARY KEY,
  -- One profile per user. Without UNIQUE a bug creates two and every
  -- SELECT ... LIMIT 1 silently picks whichever comes first.
  user_id                 TEXT NOT NULL UNIQUE REFERENCES user (id) ON DELETE CASCADE,

  full_name               TEXT NOT NULL,
  mobile                  TEXT NOT NULL,
  city_id                 INTEGER REFERENCES city (id),
  state                   TEXT,
  open_to_relocation      INTEGER NOT NULL DEFAULT 0 CHECK (open_to_relocation IN (0, 1)),

  current_job_title       TEXT,
  current_employer        TEXT,
  years_of_experience     REAL,
  sector_id               INTEGER REFERENCES sector (id),
  functional_area_id      INTEGER REFERENCES functional_area (id),
  education_level         TEXT CHECK (education_level IS NULL OR education_level IN ('DIPLOMA','BE','BTECH','MTECH','MBA','PHD')),
  qualification           TEXT,
  qualification_year      INTEGER,

  career_summary          TEXT,

  notice_period           TEXT CHECK (notice_period IS NULL OR notice_period IN ('IMMEDIATE','D15','D30','D60','D90')),
  employment_preference   TEXT CHECK (employment_preference IS NULL OR employment_preference IN ('FULL_TIME','CONTRACT','BOTH')),

  -- PRIVATE. Admin-only. Never serialised into an employer-facing view.
  -- Stored as INTEGER rupees per annum; the UI collects LPA and converts.
  current_salary          INTEGER,
  expected_salary_min     INTEGER,
  expected_salary_max     INTEGER,

  linkedin_url            TEXT,
  resume_file_id          TEXT REFERENCES file_asset (id),

  profile_status          TEXT NOT NULL DEFAULT 'DRAFT' REFERENCES review_status (code),
  submitted_at            TEXT,
  reviewed_at             TEXT,
  reviewed_by_id          TEXT REFERENCES user (id),
  review_note             TEXT,

  completion_percent      INTEGER NOT NULL DEFAULT 0,

  -- DPDP consent for admin-initiated sharing with employers.
  consented_at            TEXT,
  consent_version         TEXT,

  -- Distinct from user.last_login_at: Phase 2 flags candidates inactive 90+ days
  -- on profile activity, which logging in does not by itself indicate.
  last_active_at          TEXT,

  -- Snapshot of the last approved state, diffed to show admins what changed on
  -- re-review rather than making them re-read the whole profile (D2).
  last_approved_snapshot  TEXT,

  created_at              TEXT NOT NULL,
  updated_at              TEXT NOT NULL,
  deleted_at              TEXT
) STRICT;

CREATE INDEX idx_candidate_status ON candidate_profile (profile_status, submitted_at);
CREATE INDEX idx_candidate_sector ON candidate_profile (sector_id, functional_area_id);
CREATE INDEX idx_candidate_city ON candidate_profile (city_id);

CREATE TABLE candidate_skill (
  candidate_profile_id TEXT NOT NULL REFERENCES candidate_profile (id) ON DELETE CASCADE,
  skill_id             INTEGER NOT NULL REFERENCES skill (id),
  PRIMARY KEY (candidate_profile_id, skill_id)
) STRICT;

-- Reverse direction, for admin recommendation search by skill.
CREATE INDEX idx_candidate_skill_skill ON candidate_skill (skill_id);

CREATE TABLE candidate_experience (
  id                    TEXT PRIMARY KEY,
  candidate_profile_id  TEXT NOT NULL REFERENCES candidate_profile (id) ON DELETE CASCADE,
  company               TEXT NOT NULL,
  title                 TEXT NOT NULL,
  start_year            INTEGER NOT NULL,
  end_year              INTEGER,
  is_current            INTEGER NOT NULL DEFAULT 0 CHECK (is_current IN (0, 1)),
  domain_tags           TEXT CHECK (domain_tags IS NULL OR json_valid(domain_tags)),
  key_achievement       TEXT,
  sort_order            INTEGER NOT NULL DEFAULT 0
) STRICT;

CREATE INDEX idx_candidate_experience_profile
  ON candidate_experience (candidate_profile_id, sort_order);

CREATE TABLE employer_profile (
  id                      TEXT PRIMARY KEY,
  user_id                 TEXT NOT NULL UNIQUE REFERENCES user (id) ON DELETE CASCADE,

  company_name            TEXT NOT NULL,
  sector_id               INTEGER REFERENCES sector (id),
  -- JSON array of city slugs. json_valid keeps malformed writes out.
  locations               TEXT CHECK (locations IS NULL OR json_valid(locations)),
  website                 TEXT,
  linkedin_url            TEXT,

  hr_contact_name         TEXT NOT NULL,
  hr_contact_email        TEXT NOT NULL,
  hr_contact_phone        TEXT NOT NULL,

  company_intro           TEXT,

  account_status          TEXT NOT NULL DEFAULT 'SUBMITTED' REFERENCES review_status (code),
  reviewed_at             TEXT,
  reviewed_by_id          TEXT REFERENCES user (id),
  review_note             TEXT,

  last_approved_snapshot  TEXT,

  created_at              TEXT NOT NULL,
  updated_at              TEXT NOT NULL,
  deleted_at              TEXT
) STRICT;

CREATE INDEX idx_employer_status ON employer_profile (account_status, created_at);
