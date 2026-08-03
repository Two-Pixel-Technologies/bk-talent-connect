# BK Talent Connect — Phase 1 Build Plan (v2, post-review)

> **v2 supersedes v1.** It incorporates a full critical review (63 findings) saved alongside this
> document as `docs/PHASE_1_PLAN_REVIEW.md`. Findings are cited inline as `[BLOCKER-n]` / `[HIGH-n]`.

## Context

BK Talent Acquisition & Advisory has contracted Takai Labs to build **bktalentconnect.com**, a managed
recruitment portal connecting technical professionals with hiring companies across India's industrial
sectors. Contract: ₹55,000, ~5 weeks, with 1 year of complimentary support.

The defining characteristic is that it is **managed, not self-serve**. Admins sit in the middle of every
interaction: candidates see no jobs until profile-approved, employers cannot post until verified, jobs go
live only after review, and employers can never contact candidates directly. The software must enforce
that intermediary role — it is the client's entire business model.

Sources: `BK_TalentConnect_Proposal (1).pdf` (product design, field-level specs) and
`BK_TalentConnect_Phased_Plan.pdf` (Phase 1/2 split, costing, T&C). Greenfield — no code exists.

### Decisions taken

| Decision | Choice |
|---|---|
| Frontend | Vite + React SPA (static build, served by nginx) |
| Backend | Node.js + Express, standalone API service |
| Database | SQLite via `better-sqlite3` — hand-written SQL, no ORM |
| UI primitives | shadcn/ui (Tailwind + Radix, copy-paste) — not hand-rolled `[HIGH-24]` |
| Admin scope | Recommendations, interview scheduling, private notes; everything else minimal |
| Public page content | Placeholder copy in one editable file, every string prefixed `[TBC]` |

### Out of scope (Phase 2)

AI matching · match scores · email notifications · WhatsApp notifications · analytics dashboard ·
Kanban board · AI pre-fill · **24-hour interview reminder** (its channels are email/WhatsApp only, so it
is legitimately Phase 2 — but say so to BK rather than let it be assumed) `[LOW-3]`.

---

## Resolved decisions

All five blocking questions are answered. Implement exactly as below.

### D1. Resume visibility — **visible to employers as soon as the admin approves the candidate** `[BLOCKER-1]`

Resolves the contradiction toward the permissive reading (Phased Plan p1 and the Proposal's Kanban NEW
column). The gate is **profile approval, not application stage**: any employer with an application from an
`APPROVED` candidate can view the resume, including at `APPLIED`.

Still implement it as `RESUME_VISIBLE_FROM_STAGE = 'APPLIED'` in `packages/shared`, read by both the guard
and the privacy test, so the rule is one constant rather than scattered conditionals.

**Consequences to build:** the P5 exit check "resume at APPLIED → 403" is **deleted**. The guard becomes
*candidate profile is `APPROVED` AND the requesting employer owns the job*. And since a full CV now
reaches employers earlier, the DPDP consent text (D-consent, `[HIGH-15]`) must cover it explicitly.

### D2. Candidate profile edits after approval — **Option A** `[BLOCKER-7]`

- **Non-material** → applies immediately, no re-approval: mobile, city/state, open-to-relocation, notice
  period, employment preference, LinkedIn URL, current employer, key achievements.
- **Material** → flips `profileStatus` to `SUBMITTED`, pauses job browsing until re-approved: skills,
  years of experience, sector, function, education, career summary, resume, salary fields, experience rows.

The admin review queue must show **what changed** since last approval — otherwise re-reviews are a
full re-read every time. Store a `lastApprovedSnapshot` JSON blob on the profile and diff against it.

### D3. Job edits after approval — **same rule as D2** `[BLOCKER-8]`

- **Non-material** → applies live: `numberOfPositions`, `targetJoiningDate`, good-to-have skills.
- **Material** → flips `job.status` to `PENDING_APPROVAL` and **the job leaves public listings until
  re-approved**: title, description, required skills, experience range, sector, function, city, work type,
  education requirement, salary band.

> Assumption stated for BK: a material edit unpublishes the job until re-approved. The alternative
> (keep the last-approved version live while the edit is pending) is a draft/published split — correct,
> but ~1 extra day. Flag it; don't decide it silently.

Existing applications are untouched by either path. **Plus** a phone/email scan of `description` at submit
time, flagged to admin — otherwise the no-direct-contact rule is bypassable via the JD.

### D4. Stage-transition matrix — **approved as proposed** `[BLOCKER-9]`

Write `packages/shared/stages.ts` before P5 starts; derive the validator *and* the tests from it.

| From | To | Who |
|---|---|---|
| `APPLIED` | `UNDER_REVIEW`, `NOT_SELECTED` | employer, admin |
| `APPLIED` | `WITHDRAWN` | candidate |
| `UNDER_REVIEW` | `SHORTLISTED`, `NOT_SELECTED` | employer, admin |
| `UNDER_REVIEW` | `APPLIED` | admin only (regression) |
| `SHORTLISTED` | `INTERVIEW_SCHEDULED` | **admin only** |
| `SHORTLISTED` | `NOT_SELECTED` | employer, admin |
| `INTERVIEW_SCHEDULED` | `INTERVIEWED`, `NOT_SELECTED` | admin |
| `INTERVIEWED` | `OFFER_MADE`, `NOT_SELECTED` | employer, admin |
| `OFFER_MADE` | `OFFER_ACCEPTED`, `OFFER_DECLINED` | admin |
| `OFFER_ACCEPTED` | `JOINED` | admin |
| `NOT_SELECTED` | previous stage | admin only, within 24h |
| `WITHDRAWN` | `APPLIED` | candidate, via re-apply `[HIGH-11]` |
| any | `WITHDRAWN` | candidate |

`OFFER_ACCEPTED` / `OFFER_DECLINED` / `JOINED` exist because without them BK can never compute offer
acceptance rate — and that is unrecoverable retroactively `[HIGH-3]`.

### D5. Sector taxonomy — **split into Sector (industry) + Function (department)** `[MEDIUM-1]`

Naukri and Indeed both block automated fetches (HTTP 403), so their lists could not be extracted
verbatim; searches confirmed Naukri's naming convention (Industrial Automation, Auto Components,
Metals & Mining) but not the full taxonomy. The list below is built from Naukri's known industry
structure, filtered to BK's industrial/technical remit.

**The problem this fixes.** The proposal's seven "sectors" are two different concepts in one field:

| Proposal value | Actually a… |
|---|---|
| Engineering · Pharma · Manufacturing · Machine Building | **Industry** |
| Operations · Lab · Drafting · Sales | **Job function** |

A QC chemist at a pharma plant must choose between "Pharmaceuticals" and "Lab", and whichever they pick,
the other is lost. Because sector is Phase 2's **hard elimination filter**, that misclassification
silently drops candidates from matching. Naukri and Indeed both avoid this with two fields — Industry and
Department/Functional Area. Splitting absorbs all seven original values without losing any.

Both fields are single-select, required, on **both** the candidate profile and the job posting, seeded
from one `SECTORS` / `FUNCTIONS` constant in `packages/shared` so the two dropdowns can never diverge.

**Sector — industry (28 + Other)**

| | | |
|---|---|---|
| Engineering, Procurement & Construction | Pharmaceuticals & Life Sciences | Metals, Iron & Steel |
| Automobile & Auto Components | Biotechnology | Mining & Minerals |
| Industrial Machinery & Equipment | Medical Devices | Cement & Building Materials |
| Machine Building & Special Purpose Machines | Chemicals & Petrochemicals | Plastics, Polymers & Rubber |
| Electrical Equipment & Power Systems | Fertilisers & Agrochemicals | Packaging |
| Electronics & Semiconductor Manufacturing | Oil & Gas | Textiles & Apparel |
| Industrial Automation & Instrumentation | Power Generation & Renewable Energy | Food Processing & FMCG Manufacturing |
| Paper & Pulp | Glass & Ceramics | Aerospace & Defence |
| Railways & Rolling Stock | Shipbuilding & Marine | Water & Waste Treatment |
| Logistics, Supply Chain & Warehousing | *Other* | |

**Function — department (18 + Other)**

| | | |
|---|---|---|
| Design & Drafting | Process Engineering | Automation & Controls |
| Production & Manufacturing | R&D and Product Development | Planning (PPC) & Industrial Engineering |
| Quality Assurance & Quality Control | Laboratory & Testing | Tool Room & Tooling |
| Maintenance & Reliability | Project Management | Supply Chain, Purchase & Stores |
| Installation & Commissioning | Service & Field Engineering | EHS (Environment, Health & Safety) |
| Regulatory Affairs & Compliance | Technical Sales & Business Development | Operations & Plant Management |
| *Other* | | |

Both are lookup tables with `sortOrder` + `isActive` and an admin CRUD screen, so BK can extend them
without a deploy. Show BK the two lists for sign-off in week 1 — cheap to change now, painful once
candidate rows reference them.

### D6. Commercial and ownership questions — **still open** `[HIGH-27..30]`

Settle in writing in week 1, before any of it is on the critical path:

- **Who owns the DigitalOcean account and the domain?** Recommend BK owns both; Takai gets a deploy user
  + SSH key. Verify DNS control with a TXT record in week 1, not week 5.
- **Acceptance criteria.** ₹40,000 (73%) triggers on "go-live and handover," which is defined nowhere.
  Send the "Definition of done" below as a formal annexe and get it acknowledged.
- **Support scope.** T&C §3 promises a year of unbounded "bug fixes, minor issues and platform
  monitoring." Agree channel, response window, bug-vs-change-request definition, and a soft hours cap.
- **Backup responsibility.** T&C §5 disclaims data-loss liability while the plan runs nightly backups.
  Define RPO (24h), RTO (4h), destination, and who performs the restore.

---

## Timeline — the honest number

v1 self-estimated 34 days against a 25-day contract. The review re-scored it at **~62 developer-days**
including design, content gathering, client review cycles, UAT and the client's bug list — none of which
v1 budgeted `[HIGH-25, HIGH-26]`. Solo, that is 12–14 calendar weeks.

**Recommendation: re-phase, and raise it in week 1.** Raising this in week 1 is a negotiation; raising it
in week 4 is an apology.

| | Scope | Est. |
|---|---|---|
| **Phase 1a** | Public site + candidate portal + admin candidate approval | ~5 weeks |
| **Phase 1b** | Employer portal + pipeline + interviews + notifications | quoted separately |

If BK insists on a single phase, apply the real cut list (~6.75 days): shadcn/ui instead of hand-rolled
primitives (−2d), no FTS5 (−0.75d), no `viewCount` (−0.25d), no `API.md`/`SCHEMA.md` (−0.5d), 3 page
templates instead of 7 bespoke (−1.5d), no admin cross-job view (−0.5d), save-on-advance instead of
autosave (−0.5d), drop the Lighthouse numeric gate (−0.5d), notes on candidates/applications only
(−0.25d). Note this still does not close the gap — which is the point.

**Never cut:** any approval gate, any privacy serializer, the stage-transition validator, the schema-parity
test, the sort allowlist, backups, or SSL.

---

## Architecture

### Repository layout

```
bk_talent_connect/
├── apps/
│   ├── api/
│   │   ├── src/
│   │   │   ├── index.ts             bootstrap + SIGTERM graceful shutdown
│   │   │   ├── config/env.ts        zod-validated, fails fast at boot
│   │   │   ├── db/
│   │   │   │   ├── client.ts        better-sqlite3 + pragmas
│   │   │   │   ├── migrate.ts       numbered-migration runner
│   │   │   │   ├── migrations/      001_init.sql · …
│   │   │   │   ├── rows.ts     ◀── branded row types
│   │   │   │   └── seed.ts
│   │   │   ├── repositories/   ◀── ALL SQL lives here, nowhere else
│   │   │   ├── serializers/    ◀── THE privacy boundary
│   │   │   ├── middleware/          auth · requireRole · requireApproved
│   │   │   │                        · errorHandler · rateLimit · upload
│   │   │   ├── modules/             routes + services per domain
│   │   │   └── lib/                 password · session · audit · notify
│   │   │                            · sortAllowlist · logger · nowIso
│   │   ├── scripts/                 admin:create · admin:reset-password
│   │   └── tests/
│   └── web/
│       ├── src/
│       │   ├── pages/{public,candidate,employer,admin}/
│       │   ├── components/ui/       shadcn/ui
│       │   ├── features/            TanStack Query hooks
│       │   ├── lib/                 apiClient · auth · formatDateTime
│       │   └── content/site.ts ◀── all public copy, [TBC]-prefixed
├── packages/shared/            zod schemas · enums · stages.ts
│                               · notifications.ts · sectors · labels
├── deploy/                     nginx.conf · ecosystem.config.js
│                               · deploy.sh · backup.sh
├── .github/workflows/          ci.yml · deploy.yml
└── docs/                       RUNBOOK.md · PHASE_1_PLAN_REVIEW.md
```

`packages/shared` is imported by both apps so client and server can never disagree about validation.
**P0 must prove it resolves at runtime in the built API**, not just in the type graph — a bare
`@bktc/shared` import that Node can't resolve from `dist/` is the classic failure `[MEDIUM-32]`.

### Stack

| Layer | Choice | Note |
|---|---|---|
| Frontend | React 19 + Vite + TS | |
| UI | Tailwind v4 + **shadcn/ui** | Accessible primitives, saves ~2d `[HIGH-24]` |
| Server state | TanStack Query v5 | |
| Forms | react-hook-form + zod | |
| Backend | Node 22 LTS + Express 5 + TS | Version pinned in `.nvmrc` **and** pm2 config |
| DB | SQLite (WAL) via `better-sqlite3` | Native addon — see deployment `[BLOCKER-4]` |
| Migrations | Numbered `.sql` + runner | Backup → apply → `foreign_key_check` → verify |
| Search | `LIKE` on title | **FTS5 cut** — unpromised, and `MATCH` 500s on ordinary user input like `R&D` `[MEDIUM-16]` |
| Auth | Opaque token, httpOnly cookie | Instant revocation |
| Passwords | argon2id, `m=19456,t=2,p=1` | OWASP minimum — defaults use 64MB *per hash* on a 1GB box `[MEDIUM-21]` |
| Logging | pino + request-id + `redact()` | Contractually promised monitoring `[HIGH-4]` |
| CI | GitHub Actions | v1 claimed "runs in CI" with no CI `[MEDIUM-6]` |

### Conventions — decide before migration 001, not retrofittable

- **IDs:** ULID `TEXT PRIMARY KEY` for `user`, `candidate_profile`, `employer_profile`, `job`,
  `application`, `file_asset`. Integer PKs are fine for `skill`, `sector`, `notification`, `audit_log`.
  Sequential integers leak business volume — an employer seeing candidate `#37` learns the platform has
  ~37 candidates `[MEDIUM-22]`.
- **Timestamps:** UTC ISO-8601 with explicit `Z` and millisecond precision, written *only* through
  `nowIso()`. SQLite's `datetime('now')` returns a space-separated string with no `Z` — mixing the two
  breaks lexical ordering silently. SQL defaults must use
  `strftime('%Y-%m-%dT%H:%M:%fZ','now')` `[MEDIUM-30]`.
- **Display timezone:** everything renders in `Asia/Kolkata` with an explicit "IST" suffix, through one
  `formatDateTime()`. This app schedules interviews; a 5.5-hour error is a candidate missing one, and it
  survives all testing because the developer's machine is also in IST `[HIGH-14]`.
- **Money:** INTEGER rupees. Inputs are LPA-labelled with a live "₹12,00,000 (12 LPA)" echo — an admin
  typing `12` means twelve lakh, not twelve rupees `[MEDIUM-31]`.
- **Soft delete:** `deletedAt TEXT` on `user`, `candidate_profile`, `employer_profile`, `job`,
  `file_asset`. Hard-delete nothing in Phase 1; every repository read filters `deletedAt IS NULL`.
  Cheap now, impossible later `[MEDIUM-35]`.

### The privacy boundary

Two absolute rules from the proposal: **candidate salary** (current CTC, expected min/max) is admin-only;
**job salary band** is admin + owning employer only. Plus: employers never see candidate email or phone,
and resume visibility is gated on `RESUME_VISIBLE_FROM_STAGE` (see B1).

Every response passes through a named serializer in `src/serializers/`. But a convention is not an
enforcement — v1 stated the rule as "no route handler returns a Prisma model directly," which was both
unenforceable *and* referred to an ORM that isn't in this stack `[HIGH-20]`. Make it structural:

1. **Brand the row types.** `type CandidateRow = {…} & { readonly __unserialized: unique symbol }` — so
   `res.json(row)` is a *type error*, and the only way to strip the brand is to call a serializer.
2. **Lint rule** banning bare `res.json(` outside a `sendSerialized()` helper — same mechanism as the rule
   banning db imports outside `repositories/`.

Three paths bypass the serializer entirely and need their own controls `[HIGH-23]`:

- **`AuditLog.metadata`** — record `{ field: 'currentSalary', changed: true }`, never values.
- **Logs** — `redact()` for password, salary fields, mobile, email, token. `better-sqlite3` error messages
  include the SQL text; zod errors leak parameter values.
- **`Session.ipAddress`/`userAgent`** — personal data under DPDP; delete rows older than 90 days.

The pre-launch privacy audit must therefore include *"grep the production logs for a known test
candidate's salary and mobile."* v1's audit only inspected DevTools and would have passed while leaking.

### Sort and filter allowlists — the top security fix `[BLOCKER-10]`

`ORDER BY` cannot be parameterised. The contract requires a "sortable by status" applicant list, and with
hand-written SQL the natural implementation is `` `ORDER BY ${req.query.sort}` `` — direct SQL injection
into a database holding every candidate's salary and CV path.

Even without injection, an unvalidated sort key defeats the entire serializer layer:
`?sort=expectedSalaryMin` lets an employer **rank candidates by a field the serializers exist to hide**,
and binary-search the values by combining it with filters. Serializers protect the response body and do
nothing about its ordering.

```ts
const EMPLOYER_APPLICANT_SORTS = {
  applied: 'a.appliedAt', stage: 'a.stage', name: 'cp.fullName',
} as const;   // reject anything not a key with 400; dir is 'ASC'|'DESC' literal
```

Per endpoint, per role, for every sort *and* filter key that reaches SQL.

---

## Database schema

Raw SQLite, so the schema uses SQLite properly: enums are real `CHECK` constraints, `PRAGMA
foreign_keys = ON`, JSON columns validated with `json_valid()`.

**One caveat that shapes migrations:** SQLite cannot `ALTER` a `CHECK` constraint. Adding a stage value
later requires the full 12-step table rebuild — and `PRAGMA foreign_keys` is a **no-op inside a
transaction**, so the naive "wrap it in a transaction" approach either fails on FK violations or silently
corrupts child references `[HIGH-7]`. Therefore: **volatile enums** (`application.stage`,
`candidate_profile.profileStatus`, `job.status`) use **lookup tables + FK**, where adding a value is one
`INSERT`. Stable enums (`workType`, `mode`, `role`) use CHECK.

### Tables

**Identity** — `user` (email `UNIQUE COLLATE NOCASE` `[MEDIUM-15]`, passwordHash, role, status,
mustChangePassword, lastLoginAt, deletedAt) · `session` (tokenHash unique, userId, expiresAt, ip,
userAgent).

**Candidate** — `candidate_profile` (**`userId UNIQUE`** `[HIGH-32]`; basic, professional, **`sectorId` FK
+ `functionId` FK** (D5), career summary, notice period, employment preference; **private:**
currentSalary, expectedSalaryMin/Max; profileStatus FK, review fields, completionPercent, `consentedAt` +
consent version `[HIGH-15]`, `lastActiveAt`, **`lastApprovedSnapshot` JSON** for the admin diff view
(D2)) · `candidate_skill` (**UNIQUE(profileId, skillId)**) · `candidate_experience` · `file_asset`.

**Employer & jobs** — `employer_profile` (**`userId UNIQUE`**, company, `sectorId` FK, locations JSON, HR
contact, companyIntro, accountStatus) · `job` (basics, requirements, **`sectorId` + `functionId` FKs**,
description, targetJoiningDate; **private:** salaryBandMin/Max; status FK, publishedAt, review fields,
`lastApprovedSnapshot` JSON (D3)) · `job_skill` (**UNIQUE(jobId, skillId)**, requirement).

**Taxonomy** — `sector` and `function` lookup tables (D5), each with `name`, `slug`, `sortOrder`,
`isActive`, seeded from `packages/shared` and editable via an admin CRUD screen.

**Pipeline** — `application` (**UNIQUE(jobId, candidateProfileId)**, source, stage FK, isRecommended +
recommender, appliedAt, `firstEmployerActionAt` `[HIGH-3]`, `outcomeReasonCode` `[HIGH-3]`,
`resumeFileIdAtApply` snapshot `[MEDIUM-14]`) · `application_stage_event` (append-only) ·
`interview` (partial unique on `applicationId WHERE status='SCHEDULED'`; `candidateConfirmedAt`,
`employerConfirmedAt` `[MEDIUM-12]`) · `interview_request` (employer-initiated `[BLOCKER-3]`).

**Supporting** — `admin_note` (polymorphic; no FK possible, so add orphan cleanup to the weekly cron) ·
`notification` · `audit_log` · `contact_enquiry` · `sector` · `skill` (`isApproved` flag) · `city`
(seeded lookup — "filter by city" is contractually promised and free text gives you "Pune", "pune",
"Pune, MH" as three filter values `[HIGH-19]`).

### Indexes `[HIGH-31]`

Beyond the obvious: `application_stage_event(applicationId, createdAt)` — the candidate timeline, the
flagship candidate feature · `job(employerProfileId, status)` — every employer page load ·
`application(jobId, isRecommended, appliedAt)` — pinned-recommended ordering ·
`candidate_skill(skillId)` · `job_skill(jobId)` / `(skillId)` ·
`candidate_experience(candidateProfileId, sortOrder)` · `file_asset(ownerId)` — the authorization check on
every download · `audit_log(entityType, entityId, createdAt)` · `contact_enquiry(handledAt, createdAt)`.
Public listing needs `publishedAt` in the index or it filesorts on every page.

### Data-layer risks and their guards

- **SQL scattering** → repository layer + lint rule banning db imports elsewhere.
- **Row-type drift** (the real cost of no ORM, and it is *silent*) → a **schema-parity test** reading
  `PRAGMA table_info` for all 16 tables and asserting the live columns exactly match `db/rows.ts`.
  P0 must verify the test actually *fails* when a column is renamed — a guard you haven't seen bite isn't
  a guard. This test **runs in GitHub Actions**, which P0 now actually creates.
- **Relations** → parent row, then one batched `WHERE parent_id IN (…)` per child table, stitched in
  memory. No N+1, every query visible in one file.
- **Multi-table writes** → `db.transaction()`. Note it cannot contain async work, so file uploads write to
  `tmp/`, insert the row, then `rename()` into place; `unlink()` on failure `[MEDIUM-11]`.
- **Concurrent approvals** → make every state transition conditional in SQL:
  `UPDATE … WHERE id=? AND profileStatus IN ('SUBMITTED','CHANGES_REQUESTED')`, then check
  `changes === 0` → 409 "already reviewed by someone else" `[MEDIUM-9]`.

---

## Deployment and change management

v1 had one 2-day checkbox list and no process for the 12 months of support that follow. This is the
section that was weakest, and it carries a contractual obligation.

### Provisioning `[BLOCKER-4]`

Two concrete failures waiting on day one:

1. **The build will OOM.** `tsc` across three workspaces plus a Vite build of React 19 + Tailwind v4
   routinely peaks over 1GB. The contract specifies a 1 vCPU / **1GB** droplet with no swap.
2. **`better-sqlite3` is a native addon.** You cannot rsync `node_modules` from an Apple Silicon Mac to
   Ubuntu x86_64 — the `.node` binary won't load.

**Therefore:** 2GB swapfile as step one, permanently. **Never build on the droplet** — build locally or in
Actions and ship `dist/`. Install production deps *on target* with `npm ci --omit=dev` so the native
binding matches. Pin Node in `.nvmrc` and the pm2 config. Smoke test includes
`node -e "require('better-sqlite3')"`.

### Release structure `[BLOCKER-6]`

```
/var/www/bktc/releases/<git-sha>/{web,api,node_modules}
/var/www/bktc/current -> releases/<sha>        # atomic ln -sfn + mv
/var/www/bktc/shared/{data,uploads,.env}       # never inside a release
```

**Deploy:** upload release → `npm ci --omit=dev` → **back up DB + uploads** → `npm run db:migrate` → flip
symlink → `pm2 reload` (graceful, not `restart`) → smoke test → on failure flip the symlink back and
reload. A SIGTERM handler calls `server.close()` and `db.close()` so an in-progress 5MB upload isn't
killed mid-write.

**Migration rule, written in the runbook:** every migration must be backwards-compatible with the previous
release. Add columns nullable; never rename or drop in the same deploy as the code change — use
expand/contract across two deploys. Otherwise rollback is impossible: migration 009 adds a NOT NULL
column, you roll the code back, and the old code's inserts fail.

### Staging `[HIGH-8]`

No second droplet needed: a `staging` release dir + a second pm2 process on :4001 + an nginx server block
on `staging.bktalentconnect.com` behind basic auth + a copy of production restored from last night's
backup. **Marginal cost zero**, ~0.5 day. It is the only place a migration is ever rehearsed — and
restoring into staging *is* the restore test.

### Cache-busting and version skew `[HIGH-9]`

- nginx: `index.html` → `Cache-Control: no-store`; `/assets/` → `immutable, max-age=31536000`. If
  `index.html` is cached, users load an old HTML referencing a JS bundle that no longer exists after the
  second deploy → **white screen**, unfixable without a hard refresh.
- Build-time `__APP_VERSION__` (git sha) + `GET /api/version`; `apiClient` compares and shows a
  "New version available — reload" toast on mismatch.
- Lazy imports wrapped in an error boundary that force-reloads once on chunk-load failure.

### Backups `[BLOCKER-5, HIGH-10]`

v1 backed up the `.db` file only. **Uploads were not backed up at all** — lose the droplet and every CV is
gone, with `file_asset` rows pointing at nothing.

- Both the DB **and** `uploads/`, both off-droplet.
- `sqlite3 data/bktc.db ".backup '$OUT'"` — never `cp`, which under WAL silently omits uncheckpointed
  data and can tear mid-write.
- `PRAGMA integrity_check` on the backup before upload; **alert on failure** — an unmonitored backup cron
  that has been failing for three months is the classic version of this incident.
- Named destination (DO Spaces $5/mo, already in the Proposal's own costing) with the cost approved by BK.

### Monitoring — contractually promised `[HIGH-4]`

T&C §3 commits to a year of "platform monitoring." v1 built none. Half a day in P10: UptimeRobot on
`/api/health` (which must actually `SELECT 1` and check `uploads/` is writable, returning 503 on failure
`[MEDIUM-33]`), pino with request IDs, `pm2-logrotate` (`max_size=10M, retain=7`), and a disk-space alarm
at 80%. Unbounded pm2 logs filling a 25GB disk until every SQLite write returns `SQLITE_FULL` is the most
likely year-one outage `[MEDIUM-8]`.

### CI `[MEDIUM-6]`

GitHub Actions, ~2 hours: on push — `npm ci`, `lint`, `tsc --noEmit`, `test`, `build`. Manual-dispatch
workflow builds artifacts and rsyncs to the droplet via a deploy key. A pre-commit hook is bypassable with
`--no-verify` and doesn't run on the deploy path.

---

## Phase-by-phase build

Estimates are the review's re-scored figures. Every sub-phase ends with an exit checklist of observable
behaviours — do not start the next until every box is ticked.

### P0 — Foundations · 3 days
Workspaces, strict TS, ESLint (+ two custom rules: no db imports outside `repositories/`, no bare
`res.json`), **GitHub Actions CI**, `packages/shared` with `stages.ts` / `notifications.ts` / sectors /
cities, Express skeleton, zod env config, `db/client.ts` pragmas, migration runner (backup → transaction →
`foreign_key_check` → `integrity_check`), `rows.ts` + schema-parity harness, shadcn/ui init, Vite proxy.

**Also in week 1, in parallel (client-dependent, long lead time):** provision the droplet + swapfile and
prove `npm ci` builds the `better-sqlite3` native binding on target. This de-risks `[BLOCKER-4]` in week 1
rather than on go-live day — it needs the DO account from D6, which is why D6 is a week-1 conversation.

**Exit:** `npm run dev` clean · `/api/health` returns DB-checked status · `PRAGMA journal_mode`=`wal` and
`foreign_keys`=`1` · an FK violation is **rejected** (FKs are off by default in SQLite) · migrate twice is
a no-op · schema-parity test **fails** on a renamed column · CI green on a push ·
**`node apps/api/dist/index.js` starts outside the workspace root** `[MEDIUM-32]` ·
**`node -e "require('better-sqlite3')"` succeeds on the droplet**.

### P1 — Auth & accounts · 3.5 days
`001_init.sql`, argon2id with pinned params, sessions, register/login/logout/me, role middleware,
`app.set('trust proxy', 1)`, rate limits keyed on **email + IP**, admin creation endpoint `[HIGH-6]`,
`admin:create` / `admin:reset-password` CLI break-glass scripts, session rotation on login and revocation
on password change, server-enforced `mustChangePassword`.

**Exit:** generic 401 (no enumeration) · cookie `httpOnly`, `SameSite=Lax` + Origin check `[MEDIUM-23]` ·
role 403s · logout invalidates server-side · **rate limiting shows distinct counters for two different IPs
on production** (proves `trust proxy`) · **the last active admin cannot be suspended** `[HIGH-18]` ·
password change kills all other sessions.

> `SameSite=Lax`, not `Strict`: with a WhatsApp button on every page, `Strict` means every inbound
> WhatsApp link lands the user logged-out. `Lax` + Origin/`Sec-Fetch-Site` check + a custom header is
> strictly stronger anyway.

### P2 — Candidate profile builder · 6 days
`002_candidate.sql`, 5-step wizard (save-on-advance), skills autocomplete, experience CRUD, magic-byte
upload to `tmp/` then rename, submit validation, **edit-after-approval per B2**, consent checkbox,
completion % with a defined weighted field list `[MEDIUM-17]`.

**Exit:** every proposal field present · `.exe` renamed `.pdf` rejected · Candidate A cannot fetch B's
resume (403) · files unreachable by direct URL · **an approved candidate can update their mobile without
re-approval, and a skills change sends them back to review** · **>20 skills or a 3000-char summary is
rejected** `[HIGH-16]`.

### P3 — Employer & jobs · 5 days
`003_employer_job.sql`, employer profile, job CRUD + submit, **candidate-facing company profile page**
`[HIGH-1]`, **edit-after-approval per B3**, phone/email scan in description, serializers (owner + admin
now; candidate/public deferred to their consumers `[LOW-9]`).

**Exit:** PENDING employer gets 403 on the job form · Employer B requesting A's job gets 403 ·
`toEmployerOwnerView()` has the salary band, `toPublicView()` does not — verified in raw JSON ·
**editing `numberOfPositions` on a live job stays live; editing the description flips it to
`PENDING_APPROVAL` and removes it from public listings** (D3) · a description containing a phone number
or email is flagged to admin.

### P4 — Admin approvals & stats · 5 days
`004_audit.sql`, three review queues with conditional-update concurrency guards, reason-required
request-changes/reject, user admin, enquiries, stats, **salary-vs-band comparison panel** `[MEDIUM-4]`,
skills admin with merge `[HIGH-17]`, sector admin `[LOW-1]`.

**Exit:** stats match hand-counted rows · request-changes without a reason rejected by the **API** ·
rejection reason visible verbatim to the user · every action writes an `AuditLog` row whose metadata
contains **no salary values** · two admins approving the same record → second gets 409.

### P5 — Applications & pipeline · 7 days
`005_application.sql`, browse/filter/paginate, apply (transactional, re-checking `status='APPROVED'`
inside the transaction `[MEDIUM-10]`), tracker timeline, employer applicant list with **SQL-level** pinning
and `id` tiebreak, **sort allowlists**, stage validator from `stages.ts`, re-apply after withdraw
`[HIGH-11]`, cascade rules for suspended employers / closed jobs / rejected candidates `[HIGH-12]`.

**Exit:** unapproved candidate sees zero jobs (403) · duplicate apply blocked at the DB constraint ·
employer response JSON has **no** salary/email/mobile · **an employer can open the resume of an APPROVED
candidate at stage `APPLIED` (D1), and gets 403 for a candidate who is not APPROVED or for a job they
don't own** · illegal transition rejected · garbage stage rejected by the lookup FK · **`?sort=expectedSalaryMin`
returns 400** · **recommended stay pinned on page 2** · forcing a mid-transaction error leaves no orphan
row.

### P6 — Recommendations, interviews, notes · 4 days
`007_interview_note.sql`, admin recommend flow **+ candidate notification and a "not interested" action**
`[HIGH-15]`, **employer interview request** `[BLOCKER-3]`, interview scheduling with both-party
confirmation, notes panels.

**Exit:** recommended candidate appears pinned with the badge · **the candidate is notified they were put
forward** · duplicate recommend is a no-op · interview renders identically for both parties **in IST with
an explicit suffix** · a past `scheduledAt` is rejected · admin notes invisible in non-admin raw JSON.

### P7 — Notifications · 3 days
`008_notification.sql`. **Transcribe the Proposal p8 matrix verbatim** into
`packages/shared/notifications.ts` as `{ event, recipients: Role[] }` and drive both `notify.ts` and the
tests from it — v1 built from a bullet list and contradicted the matrix on at least one row (it sent
employers a "new application" notification the matrix marks "–"), meaning v1 failed its own exit check
`[HIGH-2]`. Add `EMPLOYER_PIPELINE_ACTION → all admins` `[BLOCKER-2]`.

**Exit:** every matrix row produces exactly the listed recipients, walked row by row · no wrong-role
notification · notification text contains no salary figures · `linkUrl` stored as
`{entityType, entityId}`, not a raw URL `[LOW-7]`.

### P8 — Portal hardening + staging deploy · 5 days
**This is the "portal complete" milestone — the whole three-role product is demoable to BK here, before a
single marketing page exists.**

Serializer privacy tests (that fail when a salary field is re-added), approval-gate tests, full transition
matrix tests, authorization sweep, IDOR sweep, **sort/filter allowlist tests**, schema parity across all
16 tables, transaction rollback tests, `EXPLAIN QUERY PLAN` on hot queries, **DPDP erasure endpoint**
`[HIGH-5]`, log redaction, demo seed data. Then deploy the portal to **staging** behind basic auth:
releases/current structure, migration runner against a real box, backup+uploads restore rehearsal.

**Exit:** privacy suite bites when deliberately broken · three-role walkthrough on **staging** with zero
console errors · **grepping logs for a test candidate's salary and mobile returns nothing** · backup
**and uploads** restored intact · **rollback rehearsed: flip the symlink back and the previous release
serves** · BK has clicked through the portal on staging and signed off.

### P9 — Public website · 6 days
Deliberately last, per client direction. 7 pages from `site.ts`, anonymous job listing, `LIKE` search,
contact form (rate-limited + honeypot), posting-inquiry form on For Employers `[LOW-2]`, WhatsApp float,
DPDP privacy policy, SEO baseline.

> **Send BK the content checklist on day 1 regardless** `[MEDIUM-36]` — founder bio, About copy, brand and
> logo, WhatsApp number, legal review of Privacy/Terms. Building the pages last is fine; *asking* for the
> content last is not. This content has a multi-week turnaround and is the most likely cause of a go-live
> slip that has nothing to do with engineering.

**Exit:** all 7 pages responsive at 375/768/1440 · public cards show no company and no salary · raw
`/api/public/jobs` has no `salaryBand*` and no employer identity · only APPROVED jobs appear ·
**the production build fails if any `[TBC]` string remains** `[LOW-8]`.

### P10 — Production deploy & go-live · 4 days
Production droplet, DNS cutover, nginx cache headers + CSP, certbot with `--deploy-hook`, monitoring +
alerting, log rotation, backup cron, graceful shutdown, cross-browser pass, `RUNBOOK.md`, client
walkthrough and handover.

**Exit:** valid cert, `http`→`https`, SSL Labs A · deep-link + hard refresh works · **`pm2 reload` during
an active upload doesn't corrupt it** · reboot brings everything back · backup cron produced a file that
restores · client has logged in and approved a real record.

---

## Definition of done

*Send this to BK as a formal acceptance-criteria annexe before P0 — it is the trigger for 73% of the fee
and BK has never seen it `[HIGH-28]`.*

- [ ] 7 public pages + anonymous jobs listing, live and responsive
- [ ] Candidate: register, profile builder, approval gate, edit-after-approval, browse, apply, track
- [ ] Employer: register, verification gate, job posting, applicant list, stage control, interview request
- [ ] Admin: three approval queues, pipeline control, recommendations, interviews, notes, stats
- [ ] In-portal notifications matching the Proposal p8 matrix
- [ ] Deployed with SSL, staging, backups (DB **and** uploads), monitoring, and a rehearsed rollback
- [ ] Privacy audit passed with zero findings, including the log grep
- [ ] Client walked through the platform and holds the runbook

## Verification

```bash
npm run dev · npm run test · npm run lint · npm run db:migrate
sqlite3 data/bktc.db    # .schema · PRAGMA table_info(job) · EXPLAIN QUERY PLAN …
```

**Three end-to-end walkthroughs**, run after every sub-phase from P5 onward — candidate, employer, and
admin journeys as described in the Definition of done. **Privacy audit** before go-live: read raw JSON on
every employer and candidate screen, probe guessed IDs, and grep the logs. **Production smoke test:**
`curl -I https://bktalentconnect.com`, `/api/health`, `/api/public/jobs`, then one full pass of each
journey.
