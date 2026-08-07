-- 009_erasure: the DPDP right to erasure, as a reviewable request.

/*
 * Why a request and not a delete button.
 *
 * The DPDP Act gives a data principal the right to have their personal data
 * erased. It does not give them the right to erase someone else's records: an
 * employer's account of who they interviewed and why is that employer's, and a
 * candidate mid-offer pressing "delete everything" would take the hiring
 * decision with it.
 *
 * So the request is captured here, BK sees it, and the erasure is executed
 * against the personal data specifically — the person disappears, the shape of
 * the hiring process they were part of does not. The request row itself
 * survives the erasure it caused, because "we erased this account on this date
 * at their request" is the only evidence that we complied.
 */
CREATE TABLE erasure_request (
  id             TEXT PRIMARY KEY,
  user_id        TEXT NOT NULL REFERENCES user (id),

  -- Their words, kept verbatim. Not required: making someone justify a right
  -- is a way of discouraging them from exercising it.
  reason         TEXT,

  status         TEXT NOT NULL DEFAULT 'OPEN'
                   CHECK (status IN ('OPEN','COMPLETED','REJECTED')),
  -- Why we did not erase, when we did not. DPDP allows refusal only on narrow
  -- grounds, and an unexplained refusal is indefensible.
  decision_note  TEXT,

  requested_at   TEXT NOT NULL,
  handled_at     TEXT,
  handled_by_id  TEXT REFERENCES user (id)
) STRICT;

CREATE INDEX idx_erasure_request_open ON erasure_request (status, requested_at);

-- One open request per person. A second one is the same request repeated, not
-- a new obligation.
CREATE UNIQUE INDEX idx_erasure_request_one_open
  ON erasure_request (user_id) WHERE status = 'OPEN';
