/**
 * Build progress, rendered at /status in the running app.
 *
 * Updated as each sub-phase lands so progress is visible in the browser rather
 * than buried in a document. `checks` are the plan's exit criteria — each one
 * is only marked done after it has actually been observed passing.
 */

export type PhaseState = 'done' | 'in_progress' | 'pending';

export type PhaseCheck = {
  readonly label: string;
  readonly done: boolean;
};

export type Phase = {
  readonly id: string;
  readonly name: string;
  readonly estimateDays: number;
  readonly state: PhaseState;
  readonly summary: string;
  readonly checks: readonly PhaseCheck[];
};

export const BUILD_PHASES: readonly Phase[] = [
  {
    id: 'P0',
    name: 'Foundations',
    estimateDays: 3,
    state: 'done',
    summary: 'Monorepo, shared contracts, db layer, migration runner, CI, lint guards.',
    checks: [
      { label: 'Dev servers start clean', done: true },
      { label: 'Health check reports DB + uploads honestly (503 when degraded)', done: true },
      { label: 'WAL mode + foreign keys enforced', done: true },
      { label: 'FK violation rejected', done: true },
      { label: 'Migrations idempotent', done: true },
      { label: 'Schema-parity guard fails on injected drift', done: true },
      { label: 'Built API starts outside workspace root', done: true },
      { label: 'Lint / typecheck / test / build green', done: true },
    ],
  },
  {
    id: 'P1',
    name: 'Auth & accounts',
    estimateDays: 3.5,
    state: 'done',
    summary:
      'argon2id (OWASP params), opaque-token sessions, role middleware, CSRF guard, admin break-glass CLI. 19 tests.',
    checks: [
      { label: 'Generic 401 — no user enumeration on login', done: true },
      { label: 'Cookie httpOnly + SameSite=Lax + Origin check', done: true },
      { label: 'Role guards return 403', done: true },
      { label: 'Logout invalidates server-side', done: true },
      { label: 'Rate limit keyed on email + IP', done: true },
      { label: 'Last active admin cannot be suspended', done: true },
      { label: 'Password change kills other sessions', done: true },
      { label: 'Explicit DPDP consent captured at registration', done: true },
    ],
  },
  {
    id: 'P2',
    name: 'Candidate profile builder',
    estimateDays: 6,
    state: 'done',
    summary:
      '5-step wizard, skill autocomplete, career history, verified CV upload, edit-after-approval (D2). 18 tests.',
    checks: [
      { label: 'Every proposal field present', done: true },
      { label: 'Magic-byte check rejects renamed executables', done: true },
      { label: 'Candidate A cannot fetch B’s resume', done: true },
      { label: 'Non-material edit stays approved; material edit re-queues', done: true },
      { label: 'Input bounds enforced (skills, summary length)', done: true },
      { label: 'Sector and function captured as separate fields', done: true },
      { label: 'CV served as attachment with nosniff, never inline', done: true },
      { label: 'Salary round-trips LPA↔rupees without drift', done: true },
    ],
  },
  {
    id: 'P3',
    name: 'Employer & jobs',
    estimateDays: 5,
    state: 'done',
    summary:
      'Company profile, job posting form with confidential salary band, D3 edit-after-approval, contact-detail scan, sort allowlist. 27 tests.',
    checks: [
      { label: 'Pending employer blocked from posting', done: true },
      { label: 'Cross-employer job access returns 403 (not 404)', done: true },
      { label: 'Salary band in owner view, absent from public view', done: true },
      { label: 'Public view is anonymous — no employer identity', done: true },
      { label: 'Material job edit unpublishes pending re-approval', done: true },
      { label: 'Non-material edit stays live', done: true },
      { label: 'Phone/email in description flagged to admin', done: true },
      { label: '?sort=salary_band_min returns 400', done: true },
    ],
  },
  {
    id: 'P4',
    name: 'Admin approvals & stats',
    estimateDays: 5,
    state: 'done',
    summary:
      'Three review queues with optimistic concurrency, audit log with a metadata allowlist, salary-vs-band panel, user suspension. 25 tests.',
    checks: [
      { label: 'Stats match hand-counted rows', done: true },
      { label: 'Reason required by the API, not just the UI', done: true },
      { label: 'Rejection reason shown to the user verbatim', done: true },
      { label: 'Audit metadata contains no salary values', done: true },
      { label: 'Concurrent approval returns 409', done: true },
      { label: 'Stale review screen rejected', done: true },
      { label: 'Salary-vs-band comparison (admin only)', done: true },
      { label: 'Last active admin cannot be suspended', done: true },
    ],
  },
  {
    id: 'QA',
    name: 'Independent audit fixes',
    estimateDays: 2,
    state: 'done',
    summary:
      'Independent QA audit found 52 issues (5.5/10). All 4 CRITICALs, all 15 HIGHs and the significant MEDIUMs are fixed with regression tests.',
    checks: [
      { label: 'CRIT-1 admin pipeline — applications no longer dead-end at Shortlisted', done: true },
      { label: 'CRIT-2 a replaced CV no longer 404s the employer’s snapshot', done: true },
      { label: 'CRIT-3 candidate in re-review stays visible, marked unavailable', done: true },
      { label: 'CRIT-4 the tracker survives re-review', done: true },
      { label: 'Five 500s on ordinary user errors now correct 4xx', done: true },
      { label: 'Unknown taxonomy slug rejected instead of silently nulled', done: true },
      { label: 'Admin can open the CV they are approving', done: true },
      { label: 'Replacing a CV re-queues an approved profile', done: true },
      { label: 'Mobile numbers must be dialable', done: true },
      { label: 'Withdrawn applicants leave the employer board', done: true },
      { label: 'Pagination on every list in the web app', done: true },
      { label: 'Employer suspension takes their live jobs down', done: true },
      { label: 'Close posting confirms, reports impact, and is reversible', done: true },
      { label: 'Skill slugs keep P&ID ≠ PID and preserve non-Latin names', done: true },
      { label: 'Employers must complete a profile before verification', done: true },
      { label: 'Gate messages tell DRAFT and CHANGES_REQUESTED to act, not wait', done: true },
      { label: 'Admin screens for pipeline, skills, taxonomy and enquiries', done: true },
      { label: 'Error states on every query-backed page', done: true },
    ],
  },
  {
    id: 'P5',
    name: 'Applications & pipeline',
    estimateDays: 7,
    state: 'done',
    summary:
      'Anonymous browsing, one-click apply, tracker timeline, employer applicant list, stage validator from the D4 matrix, re-apply after withdraw. 33 tests.',
    checks: [
      { label: 'Unapproved candidate sees zero jobs (403, not an empty list)', done: true },
      { label: 'Duplicate apply blocked at the DB constraint', done: true },
      { label: 'No salary/email/mobile in employer responses', done: true },
      { label: 'Resume visible once candidate approved (D1) — and only with an application', done: true },
      { label: '?sort=expectedSalaryMin returns 400', done: true },
      { label: 'Recommended pinned in SQL, stable across pages', done: true },
      { label: 'Every transition checked against the shared matrix', done: true },
      { label: 'Employer cannot schedule an interview themselves', done: true },
      { label: 'Withdraw is reversible — re-apply reuses the row', done: true },
      { label: 'Company revealed only from shortlist onward', done: true },
      { label: 'Closing a job resolves untouched applications', done: true },
    ],
  },
  {
    id: 'P6',
    name: 'Recommendations, interviews, notes',
    estimateDays: 4,
    state: 'done',
    summary:
      'Admin recommendation gated on DPDP consent, ranked candidate search, employer interview requests, scheduling with both-party confirmation, private notes. 26 tests.',
    checks: [
      { label: 'Recommended candidate pinned with badge', done: true },
      { label: 'Recommending requires the candidate’s recorded consent', done: true },
      { label: 'Candidate can decline a role they did not choose', done: true },
      { label: 'Recommending twice is idempotent', done: true },
      { label: 'Employer can request an interview but never book one', done: true },
      { label: 'Interview renders in IST for both parties, identically', done: true },
      { label: 'Both parties confirm independently', done: true },
      { label: 'Rescheduling supersedes rather than overwrites', done: true },
      { label: 'Past scheduledAt rejected', done: true },
      { label: 'Admin notes invisible to candidates and employers', done: true },
    ],
  },
  {
    id: 'P7',
    name: 'Notifications',
    estimateDays: 3,
    state: 'done',
    summary:
      'In-portal bell driven verbatim by the Proposal p8 matrix — recipients come from that table and nowhere else. Per-role copy, structural links, unread badge. 29 tests.',
    checks: [
      { label: 'All 15 matrix rows hit exactly their listed recipients', done: true },
      { label: 'Every matrix row is actually reachable — none is dead', done: true },
      { label: 'Employers still not told about new applications (p8 marks it “–”)', done: true },
      { label: 'No salary figure in any notification, in any role’s copy', done: true },
      { label: 'Candidate-facing copy never names the employer', done: true },
      { label: 'Interview time identical for both parties, in IST', done: true },
      { label: 'Actor not notified of their own action', done: true },
      { label: 'Link stored as {entityType, entityId}, never a URL', done: true },
      { label: 'Feed scoped to the caller; cannot read or clear another’s', done: true },
      { label: 'Closing a posting tells each candidate without flooding the bell', done: true },
    ],
  },
  {
    id: 'P8',
    name: 'Portal hardening + staging',
    estimateDays: 5,
    state: 'in_progress',
    summary:
      'Privacy suite asserted against raw responses, IDOR sweep, DPDP erasure with a retention sweep, deploy/rollback/backup/restore scripts and a staging server block. 36 tests. Portal-complete milestone.',
    checks: [
      { label: 'Privacy suite bites when a salary field is re-added', done: true },
      { label: 'Logs carry no salary, mobile, email, password or cookie', done: true },
      { label: 'Log assertion is non-vacuous — logging is actually on', done: true },
      { label: 'Sort allowlist blocks ranking by a hidden field', done: true },
      { label: 'IDOR sweep across employer, candidate and admin routes', done: true },
      { label: 'Erasure overwrites every personal column, verified individually', done: true },
      { label: 'Erasure takes the CV off disk, not just out of the database', done: true },
      { label: 'Applications and audit trail survive, detached from the person', done: true },
      { label: 'Retention sweep clears old sessions, orphan notes and orphan files', done: true },
      { label: 'Backup covers the database AND the uploads, verified before upload', done: true },
      { label: 'Restore rehearsed; fails loudly when a CV is missing', done: true },
      { label: 'Rollback rehearsed on the droplet', done: false },
      { label: 'Deployed to staging and walked through by BK', done: false },
    ],
  },
  {
    id: 'P9',
    name: 'Public website',
    estimateDays: 6,
    state: 'pending',
    summary: '7 pages, anonymous job listing, contact form. Deliberately last.',
    checks: [
      { label: 'All 7 pages responsive', done: false },
      { label: 'Public cards show no company, no salary', done: false },
      { label: 'Build fails if any [TBC] string remains', done: false },
    ],
  },
  {
    id: 'P10',
    name: 'Production deploy & go-live',
    estimateDays: 4,
    state: 'pending',
    summary: 'Droplet, DNS, SSL, monitoring, backups, runbook handover.',
    checks: [
      { label: 'Valid cert, SSL Labs A', done: false },
      { label: 'Deep link + hard refresh works', done: false },
      { label: 'Reboot brings everything back', done: false },
    ],
  },
];

/** Findings from the independent QA audit that are still outstanding. */
export const OPEN_AUDIT_ITEMS: readonly string[] = [
  'MED-20: no unsaved-changes guard when navigating away mid-form',
  'completionPercent is stored, not derived, so it can lag the visible profile',
  'Employer stage transitions are still hardcoded client-side rather than read from availableStages',
];

export const OPEN_QUESTIONS: readonly string[] = [
  'D6: Who owns the DigitalOcean account and domain? (blocks week-1 droplet provisioning)',
  'D6: Formal acceptance criteria for the ₹40,000 trigger',
  'D6: Support scope, channel, response window and hours cap',
  'D6: Backup RPO/RTO and who performs the restore',
  'D3: Confirm a material job edit unpublishes until re-approved (vs draft/published split)',
  'D5: BK to sign off the 28 sectors and 18 functions',
];
