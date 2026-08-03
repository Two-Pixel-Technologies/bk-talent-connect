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
    state: 'pending',
    summary: 'Employer profile, job posting, company page, edit-after-approval (D3).',
    checks: [
      { label: 'Pending employer blocked from posting', done: false },
      { label: 'Cross-employer job access returns 403', done: false },
      { label: 'Salary band in owner view, absent from public view', done: false },
      { label: 'Material job edit unpublishes pending re-approval', done: false },
      { label: 'Phone/email in description flagged to admin', done: false },
    ],
  },
  {
    id: 'P4',
    name: 'Admin approvals & stats',
    estimateDays: 5,
    state: 'pending',
    summary: 'Three review queues, audit log, user admin, salary-vs-band panel.',
    checks: [
      { label: 'Stats match hand-counted rows', done: false },
      { label: 'Reason required by the API, not just the UI', done: false },
      { label: 'Audit metadata contains no salary values', done: false },
      { label: 'Concurrent approval returns 409', done: false },
    ],
  },
  {
    id: 'P5',
    name: 'Applications & pipeline',
    estimateDays: 7,
    state: 'pending',
    summary: 'Browse, apply, tracker timeline, employer applicant list, stage validator.',
    checks: [
      { label: 'Unapproved candidate sees zero jobs', done: false },
      { label: 'Duplicate apply blocked at DB constraint', done: false },
      { label: 'No salary/email/mobile in employer responses', done: false },
      { label: 'Resume visible once candidate approved (D1)', done: false },
      { label: '?sort=expectedSalaryMin returns 400', done: false },
      { label: 'Recommended stay pinned on page 2', done: false },
    ],
  },
  {
    id: 'P6',
    name: 'Recommendations, interviews, notes',
    estimateDays: 4,
    state: 'pending',
    summary: 'Admin recommend with consent notice, employer interview request, scheduling.',
    checks: [
      { label: 'Recommended candidate pinned with badge', done: false },
      { label: 'Candidate notified they were put forward', done: false },
      { label: 'Interview renders in IST for both parties', done: false },
      { label: 'Past scheduledAt rejected', done: false },
    ],
  },
  {
    id: 'P7',
    name: 'Notifications',
    estimateDays: 3,
    state: 'pending',
    summary: 'In-portal bell driven by the Proposal p8 matrix.',
    checks: [
      { label: 'Every matrix row hits exactly its listed recipients', done: false },
      { label: 'No wrong-role notification', done: false },
      { label: 'No salary figures in notification text', done: false },
    ],
  },
  {
    id: 'P8',
    name: 'Portal hardening + staging',
    estimateDays: 5,
    state: 'pending',
    summary: 'Privacy suite, IDOR sweep, DPDP erasure, staging deploy. Portal-complete milestone.',
    checks: [
      { label: 'Privacy suite bites when deliberately broken', done: false },
      { label: 'Logs contain no salary or mobile', done: false },
      { label: 'Backup + uploads restore rehearsed', done: false },
      { label: 'Rollback rehearsed', done: false },
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

export const OPEN_QUESTIONS: readonly string[] = [
  'D6: Who owns the DigitalOcean account and domain? (blocks week-1 droplet provisioning)',
  'D6: Formal acceptance criteria for the ₹40,000 trigger',
  'D6: Support scope, channel, response window and hours cap',
  'D6: Backup RPO/RTO and who performs the restore',
  'D3: Confirm a material job edit unpublishes until re-approved (vs draft/published split)',
  'D5: BK to sign off the 28 sectors and 18 functions',
];
