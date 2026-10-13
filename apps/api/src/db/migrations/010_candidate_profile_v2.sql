-- @foreign-keys-off
-- 010_candidate_profile_v2: widen education_level, add free-text "Other"
-- companions for sector and education.
--
-- Two candidate-facing changes drove this:
--
--   1. The candidate "Sector" field gained an "Other" option (the `sector`
--      taxonomy table already has its own 'other' row, so sector_id itself
--      needed no change — but there was nowhere to store what the candidate
--      actually typed when they picked it).
--   2. The six-value education_level CHECK (DIPLOMA/BE/BTECH/MTECH/MBA/PHD)
--      is being presented to candidates as a simpler five-option list
--      (Diploma/Degree/Postgraduate/Doctorate/Other). BE and BTECH already
--      rank identically in EDUCATION_RANK (packages/shared/src/enums.ts), as
--      do MTECH and MBA, so DEGREE/POSTGRADUATE are not new concepts, just
--      the names candidates now see — the specific degree itself is still
--      captured in full in the separate `qualification` text field, which
--      this does not touch. OTHER is a genuinely new value, for a
--      qualification that fits none of the above.
--
-- SQLite cannot ALTER a CHECK constraint, so this is the table rebuild the
-- migration runner documents (migrate.ts): new table, copy, drop, rename.
-- Every existing row — including DRAFT/SUBMITTED/APPROVED candidates with
-- BE/BTECH/MTECH/MBA already saved — is copied verbatim and stays valid: the
-- widened CHECK is the old six values plus the three new ones, not a
-- replacement list. Nothing is reseeded or reset.

CREATE TABLE candidate_profile_new (
  id                      TEXT PRIMARY KEY,
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
  -- What the candidate typed when sector_id resolved to the taxonomy's
  -- 'other' row. NULL whenever sector_id is anything else — see
  -- candidate.service.ts toColumns(), which clears it on every save that
  -- changes sectorSlug away from 'other'.
  sector_other            TEXT,
  functional_area_id      INTEGER REFERENCES functional_area (id),
  education_level         TEXT CHECK (education_level IS NULL OR education_level IN
                             ('DIPLOMA','BE','BTECH','MTECH','MBA','PHD','DEGREE','POSTGRADUATE','OTHER')),
  -- What the candidate typed when education_level = 'OTHER'. Same clearing
  -- rule as sector_other.
  education_level_other   TEXT,
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

  consented_at            TEXT,
  consent_version         TEXT,

  last_active_at          TEXT,

  last_approved_snapshot  TEXT,

  created_at              TEXT NOT NULL,
  updated_at              TEXT NOT NULL,
  deleted_at              TEXT
) STRICT;

INSERT INTO candidate_profile_new (
  id, user_id, full_name, mobile, city_id, state, open_to_relocation,
  current_job_title, current_employer, years_of_experience, sector_id, sector_other,
  functional_area_id, education_level, education_level_other, qualification, qualification_year,
  career_summary, notice_period, employment_preference,
  current_salary, expected_salary_min, expected_salary_max,
  linkedin_url, resume_file_id,
  profile_status, submitted_at, reviewed_at, reviewed_by_id, review_note,
  completion_percent, consented_at, consent_version, last_active_at,
  last_approved_snapshot, created_at, updated_at, deleted_at
)
SELECT
  id, user_id, full_name, mobile, city_id, state, open_to_relocation,
  current_job_title, current_employer, years_of_experience, sector_id, NULL,
  functional_area_id, education_level, NULL, qualification, qualification_year,
  career_summary, notice_period, employment_preference,
  current_salary, expected_salary_min, expected_salary_max,
  linkedin_url, resume_file_id,
  profile_status, submitted_at, reviewed_at, reviewed_by_id, review_note,
  completion_percent, consented_at, consent_version, last_active_at,
  last_approved_snapshot, created_at, updated_at, deleted_at
FROM candidate_profile;

DROP TABLE candidate_profile;
ALTER TABLE candidate_profile_new RENAME TO candidate_profile;

CREATE INDEX idx_candidate_status ON candidate_profile (profile_status, submitted_at);
CREATE INDEX idx_candidate_sector ON candidate_profile (sector_id, functional_area_id);
CREATE INDEX idx_candidate_city ON candidate_profile (city_id);
