-- 001_init: lookup tables and identity.
--
-- Conventions used throughout the schema:
--
--   * STRICT tables — SQLite otherwise accepts a string into an INTEGER column.
--   * IDs are ULID TEXT for user-facing entities (sequential integers would let
--     an employer infer the platform's candidate count), INTEGER for lookups.
--   * Timestamps are UTC ISO-8601 with an explicit Z and millisecond precision,
--     matching nowIso(). Never datetime('now') — it emits a different format
--     that breaks lexical ordering when mixed in.
--   * Booleans are INTEGER 0/1 with a CHECK.
--   * Volatile enums (review/job/application status) are lookup tables with FKs,
--     because SQLite cannot ALTER a CHECK constraint — adding a value later
--     would otherwise mean a full table rebuild.

-- ---------------------------------------------------------------------------
-- Status lookups
-- ---------------------------------------------------------------------------

CREATE TABLE review_status (
  code        TEXT PRIMARY KEY,
  label       TEXT NOT NULL,
  sort_order  INTEGER NOT NULL
) STRICT;

INSERT INTO review_status (code, label, sort_order) VALUES
  ('DRAFT',             'Draft',             1),
  ('SUBMITTED',         'Under review',      2),
  ('APPROVED',          'Approved',          3),
  ('CHANGES_REQUESTED', 'Changes requested', 4),
  ('REJECTED',          'Rejected',          5);

CREATE TABLE job_status (
  code        TEXT PRIMARY KEY,
  label       TEXT NOT NULL,
  sort_order  INTEGER NOT NULL,
  is_public   INTEGER NOT NULL DEFAULT 0 CHECK (is_public IN (0, 1))
) STRICT;

INSERT INTO job_status (code, label, sort_order, is_public) VALUES
  ('DRAFT',             'Draft',              1, 0),
  ('PENDING_APPROVAL',  'Pending approval',   2, 0),
  ('APPROVED',          'Live',               3, 1),
  ('CHANGES_REQUESTED', 'Changes requested',  4, 0),
  ('REJECTED',          'Rejected',           5, 0),
  ('CLOSED',            'Closed',             6, 0),
  ('FILLED',            'Filled',             7, 0);

CREATE TABLE application_stage (
  code        TEXT PRIMARY KEY,
  label       TEXT NOT NULL,
  sort_order  INTEGER NOT NULL
) STRICT;

INSERT INTO application_stage (code, label, sort_order) VALUES
  ('APPLIED',             'Applied',             1),
  ('UNDER_REVIEW',        'Under review',        2),
  ('SHORTLISTED',         'Shortlisted',         3),
  ('INTERVIEW_SCHEDULED', 'Interview scheduled', 4),
  ('INTERVIEWED',         'Interviewed',         5),
  ('OFFER_MADE',          'Offer made',          6),
  ('OFFER_ACCEPTED',      'Offer accepted',      7),
  ('OFFER_DECLINED',      'Offer declined',      8),
  ('JOINED',              'Joined',              9),
  ('NOT_SELECTED',        'Not selected',       10),
  ('WITHDRAWN',           'Withdrawn',          11);

-- ---------------------------------------------------------------------------
-- Taxonomy
--
-- Sector is industry; functional_area is department. The proposal conflated the
-- two, which would force a pharma QC chemist to choose between
-- "Pharmaceuticals" and "Lab" and lose the other — and sector is Phase 2's hard
-- elimination filter. Seeded from packages/shared, editable by an admin.
-- ---------------------------------------------------------------------------

CREATE TABLE sector (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  slug        TEXT NOT NULL UNIQUE,
  name        TEXT NOT NULL,
  sort_order  INTEGER NOT NULL DEFAULT 0,
  is_active   INTEGER NOT NULL DEFAULT 1 CHECK (is_active IN (0, 1))
) STRICT;

CREATE TABLE functional_area (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  slug        TEXT NOT NULL UNIQUE,
  name        TEXT NOT NULL,
  sort_order  INTEGER NOT NULL DEFAULT 0,
  is_active   INTEGER NOT NULL DEFAULT 1 CHECK (is_active IN (0, 1))
) STRICT;

CREATE TABLE city (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  slug        TEXT NOT NULL UNIQUE,
  name        TEXT NOT NULL,
  sort_order  INTEGER NOT NULL DEFAULT 0,
  is_active   INTEGER NOT NULL DEFAULT 1 CHECK (is_active IN (0, 1))
) STRICT;

-- Skills are shared across every candidate and job, so auto-created entries
-- start unapproved and stay out of autocomplete until an admin accepts them.
-- Otherwise one authenticated account can permanently pollute the taxonomy that
-- Phase 2 scores 35 of 100 points against.
CREATE TABLE skill (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  slug        TEXT NOT NULL UNIQUE,
  name        TEXT NOT NULL,
  is_approved INTEGER NOT NULL DEFAULT 0 CHECK (is_approved IN (0, 1)),
  created_at  TEXT NOT NULL
) STRICT;

CREATE INDEX idx_skill_approved ON skill (is_approved, slug);

-- ---------------------------------------------------------------------------
-- Identity
-- ---------------------------------------------------------------------------

CREATE TABLE user (
  id                    TEXT PRIMARY KEY,
  -- NOCASE so Foo@x.com and foo@x.com cannot both register. Application code
  -- also lowercases on write; this is the constraint that actually enforces it.
  email                 TEXT NOT NULL COLLATE NOCASE,
  password_hash         TEXT NOT NULL,
  role                  TEXT NOT NULL CHECK (role IN ('CANDIDATE', 'EMPLOYER', 'ADMIN')),
  status                TEXT NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'SUSPENDED')),
  must_change_password  INTEGER NOT NULL DEFAULT 0 CHECK (must_change_password IN (0, 1)),
  last_login_at         TEXT,
  created_at            TEXT NOT NULL,
  updated_at            TEXT NOT NULL,
  deleted_at            TEXT
) STRICT;

CREATE UNIQUE INDEX idx_user_email ON user (email);
CREATE INDEX idx_user_role_status ON user (role, status);

-- Only the hash of the session token is stored, so a database read cannot mint
-- a usable session.
CREATE TABLE session (
  id           TEXT PRIMARY KEY,
  token_hash   TEXT NOT NULL UNIQUE,
  user_id      TEXT NOT NULL REFERENCES user (id) ON DELETE CASCADE,
  expires_at   TEXT NOT NULL,
  ip_address   TEXT,
  user_agent   TEXT,
  created_at   TEXT NOT NULL
) STRICT;

CREATE INDEX idx_session_user ON session (user_id);
CREATE INDEX idx_session_expires ON session (expires_at);
