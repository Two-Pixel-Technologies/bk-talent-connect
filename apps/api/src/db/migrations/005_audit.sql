-- 005_audit: admin action log and public contact enquiries.

CREATE TABLE audit_log (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  actor_id      TEXT REFERENCES user (id),
  action        TEXT NOT NULL,
  entity_type   TEXT NOT NULL,
  entity_id     TEXT NOT NULL,

  -- Metadata is an ALLOWLIST of non-sensitive facts, written through
  -- lib/audit.ts. Never a before/after dump of the record: the obvious
  -- implementation of that would put candidate CTC and employer salary bands
  -- into a table that has no serializer and is read straight out during
  -- support work — bypassing the entire privacy boundary.
  metadata      TEXT CHECK (metadata IS NULL OR json_valid(metadata)),

  ip_address    TEXT,
  created_at    TEXT NOT NULL
) STRICT;

-- The lookup pattern during support: "what happened to this record?"
CREATE INDEX idx_audit_entity ON audit_log (entity_type, entity_id, created_at);
CREATE INDEX idx_audit_actor ON audit_log (actor_id, created_at);

CREATE TABLE contact_enquiry (
  id            TEXT PRIMARY KEY,
  name          TEXT NOT NULL,
  email         TEXT NOT NULL,
  phone         TEXT,
  enquiry_type  TEXT NOT NULL CHECK (enquiry_type IN ('CANDIDATE','EMPLOYER','OTHER')),
  message       TEXT NOT NULL,
  handled_at    TEXT,
  handled_by_id TEXT REFERENCES user (id),
  created_at    TEXT NOT NULL
) STRICT;

-- Admin queue: unhandled first, newest first.
CREATE INDEX idx_enquiry_queue ON contact_enquiry (handled_at, created_at);
