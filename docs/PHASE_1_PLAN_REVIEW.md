# Critical Review — BK Talent Connect Phase 1 Plan

> **Status: this review was written against plan v1. `docs/PHASE_1_PLAN.md` is now v2 and was rewritten
> around these findings.** Read it as the rationale behind v2's design, not as a list of open defects.
>
> **Resolved by client decision** (see v2 "Resolved decisions"): BLOCKER-1 (resume visible to employers
> once the admin approves the candidate) · BLOCKER-7 (Option A — non-material profile edits apply live,
> material edits require re-approval) · BLOCKER-8 (same rule for jobs) · BLOCKER-9 (stage-transition
> matrix approved as proposed) · MEDIUM-1 (sector taxonomy split into 28 industries + 18 functions).
>
> **Absorbed into v2's design:** BLOCKER-2, 3, 4, 5, 6, 10 and the HIGH findings on deployment, backups,
> privacy, indexes and estimation.
>
> **Still open — commercial, not technical:** HIGH-27 (who owns the DigitalOcean account and domain) ·
> HIGH-28 (formal acceptance criteria for the ₹40,000 trigger) · HIGH-29 (support scope and hours cap) ·
> HIGH-30 (backup RPO/RTO and who performs the restore).

**Reviewed:** plan v1, since superseded by `docs/PHASE_1_PLAN.md`
**Against:** `/Users/raghav/Development/Two Pixel/bk_talent_connect/BK_TalentConnect_Proposal (1).pdf` (13pp), `/Users/raghav/Development/Two Pixel/bk_talent_connect/BK_TalentConnect_Phased_Plan.pdf` (6pp)

---

## Verdict

**Not shippable as-is, and not because of the timeline.** The timeline problem is the one the plan is honest about; the dangerous problems are the ones it is silent about.

Three workflow holes make the product logically incomplete: **an approved candidate can never edit their profile again**, **an approved job can apparently be edited live without re-review** (which destroys the client's entire business model — "job postings approved before they go live"), and **the stage-transition matrix — the single most important piece of business logic in the application — is written down nowhere**. The plan says "central stage-transition validator (legal transitions only, from every role)" and then never enumerates a single transition. You cannot build that from this document, and three different developers would build three different products.

On top of that there is a direct **contract contradiction** the plan resolves unilaterally and hard-codes into an exit test: the Phased Plan promises employers a "*Per-opening applicant list, sortable by status, with profile and resume view*" and the Proposal's Kanban NEW column says "*Employer can view profiles and resume*", while the candidate field table says resume is "*visible to admins + employers after shortlisting*". The plan picks the restrictive reading and writes `P5: Resume download at stage APPLIED → 403` as a pass/fail gate. If BK meant the other reading, that is a rebuild of the employer portal's core screen discovered at UAT.

Single biggest risk: **the deployment story does not exist.** One 2-day checkbox list, no staging, no CI, no rollback, no release structure, resume files not backed up at all, and a build that will very likely OOM on the 1 vCPU / 1GB droplet the contract specifies. This has a **1-year complimentary support obligation** attached to it. You are committing to twelve months of shipping fixes into a production box with no rehearsal environment, no rollback path, and no way to migrate a CHECK-constraint enum in SQLite without a hand-written 12-step table rebuild.

---

## Severity summary

| Severity | Count | Meaning |
|---|---|---|
| **BLOCKER** | 9 | Must be resolved before writing migration `001`. Either a contract ambiguity, a missing spec, or something that will destroy production data / the client's business rule. |
| **HIGH** | 24 | Will cause a client escalation, a security incident, a data-loss event, or a significant rebuild. |
| **MEDIUM** | 22 | Real defects/omissions; fix during the relevant sub-phase. |
| **LOW** | 8 | Polish, documentation, or defensible-but-undocumented decisions. |
| **Total** | **63** | |

---

## 1. Promised vs planned — contract gap analysis

### Phased Plan Phase 1 coverage matrix

| # | Promised (Phased Plan PDF) | Plan coverage | Status |
|---|---|---|---|
| 1 | 7 public pages: Home, About, For Candidates, For Employers, Contact, Privacy, Terms | P8 | ✅ |
| 1 | Public Jobs listing; browse & filter by sector, city, experience | P8 | ✅ (+ unpromised FTS5) |
| 2 | Candidate registration & login, guided profile builder | P1/P2 | ✅ |
| 2 | Salary expectations captured, private from employers | P2 + serializer | ✅ |
| 2 | Browse & apply after admin approves profile | P5 | ✅ |
| 2 | Track status: Applied → Under Review → Shortlisted → Interview → Decision | P5 | ⚠️ labels unmapped |
| 3 | Company registration & login, admin-verified before posting | P1/P3 | ✅ |
| 3 | Job posting form: required skills, exp range, description, confidential salary band | P3 | ✅ |
| 3 | **Per-opening applicant list, sortable by status, with profile and resume view** | P5 | ❌ **contradicted** |
| 4 | Approve/reject candidate profiles, employer accounts, job postings | P4 | ✅ |
| 4 | **Manage the applicant pipeline per opening and coordinate interviews between both parties** | P5/P6 | ⚠️ admin-only; no employer interview request; no party confirmation |
| 4 | Simple stats: total candidates, employers, open jobs, applications | P4 | ✅ |
| 5 | In-portal notification — users see every update when they log in | P7 | ⚠️ matrix mismatches |
| 6 | Server setup, domain, SSL, DigitalOcean deploy | P10 | ⚠️ thin |
| 6 | **Complimentary post-launch support for the first year** | — | ❌ **entirely absent** |

### Proposal-level capabilities the plan drops or never mentions

| Promised (Proposal PDF) | Page | In plan? |
|---|---|---|
| Company introduction "shown to candidates on the **company profile page**" | p5 | ❌ no such page or endpoint |
| Employer "can **request an interview** or mark candidate as not suitable" (REVIEWING column) | p6 | ❌ |
| "Admin is notified **immediately on every employer action** in the pipeline" | p6 | ❌ |
| "Admin/**Company** schedules and confirms with both parties" | p6 | ❌ admin-only, no confirmation |
| Privacy Policy: "**Data deletion requests**" | p2 | ❌ policy text only, no mechanism |
| Contact page: "LinkedIn page link" | p2 | ⚠️ implied via `site.ts` |
| For Employers page: "**posting inquiry form**" | p2 | ❌ |
| Admin "**360° Job Opening**" view | p7 | ⚠️ only 360° candidate mentioned |
| Admin "**Salary vs employer budgets**" comparison | p7 | ❌ |
| Interview reminder 24 hrs before | p6, p8 | ❌ not flagged as deferred |

---

### [BLOCKER-1] Resume gating contradicts the signed Phase 1 scope, and the plan hard-codes the restrictive reading into a test

**What's wrong.** The Phased Plan (the *scope* document, p1) says the employer gets a "Per-opening applicant list, sortable by status, **with profile and resume view**" — unconditionally. The Proposal Kanban (p6) says of the **NEW** column: "All candidates who applied + recommended ones pinned at top with badge. **Employer can view profiles and resume.**" NEW is pre-shortlist. Only the candidate field table (p4) says "visible to admins + employers **after shortlisting**". The source documents contradict each other. The plan never notices, picks one, and enshrines it: P5 exit checklist — "Resume download at stage APPLIED → **403**".

**Why it matters.** If BK's intent is the Kanban reading, then the entire employer applicant-list screen, the `GET /api/employer/applications/:id/resume` guard, the serializer views and the privacy test suite are all built against the wrong rule — discovered at UAT in week 6, when there is no schedule left. It also changes the DPDP posture materially (sharing a full CV with an employer at application time vs at shortlist time).

**Fix.** Before P0 ends, get a **written** one-line answer from BK: "Can an employer open a candidate's resume before shortlisting them — yes or no?" Record it in the plan. Implement the answer as a single named constant `RESUME_VISIBLE_FROM_STAGE` in `packages/shared` so the switch is one line, not a refactor, and so the privacy test reads from the same constant.

---

### [BLOCKER-2] "Admin notified immediately on every employer action in the pipeline" is a stated requirement that is not built

**What's wrong.** Proposal p6, bullet 4: "Admin is notified immediately on every employer action in the pipeline." The plan's P7 notification list has *no* employer-action-to-admin event. The only admin notification is "new pending item (admin)".

**Why it matters.** This is the client's operating model — BK sits in the middle and must react when an employer moves someone. Without it BK has to poll the admin dashboard. It is also the trigger for their "Employer response time" metric (Proposal p7). It's a small build (one `createNotification` call inside the employer stage-change service) and a guaranteed post-launch complaint if missed.

**Fix.** Add an event `EMPLOYER_PIPELINE_ACTION` fired to all ADMIN users from `POST /api/employer/applications/:id/stage`, and from the employer's interview request (BLOCKER-3). Add to the P7 checklist. Note: this makes the "notify all admins" pattern necessary — see HIGH-6 (there is only one admin account).

---

### [BLOCKER-3] The employer cannot request an interview — a promised employer action does not exist

**What's wrong.** Proposal p6, REVIEWING column: the employer "**Can request an interview** or mark candidate as not suitable." The plan's employer stage set is `UNDER_REVIEW, SHORTLISTED, NOT_SELECTED, OFFER_MADE`. There is no interview-request action, no entity, no notification type, and P5's exit checklist actively asserts the opposite: "Employer attempting to set stage `INTERVIEW_SCHEDULED` directly → 403."

**Why it matters.** The employer's only way to say "I want to meet this person" is to move them to SHORTLISTED and hope BK notices. That is the whole coordination loop the Phased Plan sells as "coordinate interviews between both parties."

**Fix.** Add `POST /api/employer/applications/:id/request-interview` with an optional `preferredSlots`/`note`. Either a lightweight `interview_request` table or a `stage_event` with `type='INTERVIEW_REQUESTED'` plus a flag on `Application`. Notifies all admins. Admin then creates the `Interview`. ~0.5 day.

---

### [HIGH-1] There is no company profile page, but the schema collects `companyIntro` "shown to candidates on the company profile page"

**What's wrong.** Proposal p5 employer registration table, last row: Company introduction — "Shown to candidates on the **company profile page**." The plan stores `companyIntro` on `EmployerProfile` and then never renders it anywhere. `pages/candidate/` has no employer route; there is no `GET /api/candidate/employers/:id`.

**Why it matters.** Employers are asked to write an intro that no one will ever read. And once a candidate is shortlisted (company identity revealed per the plan's own anonymity rule), they have nowhere to learn about the company before an interview.

**Fix.** Add `GET /api/candidate/employers/:id` returning `toCandidateView()` of the employer — company name, sector, locations, website, LinkedIn, intro; **never** the HR contact name/email/phone (that would breach the no-direct-contact rule). Gate it: only reachable if the requesting candidate has ≥1 application to that employer at stage ≥ SHORTLISTED. Add a candidate-facing company page. ~0.5 day.

---

### [HIGH-2] The notification matrix is contradicted in at least one row, and the plan's own exit check would fail

**What's wrong.** Proposal p8 matrix, row "New application submitted": Candidate ✓ Confirm, **Employer –**, Admin ✓ Alert. The plan's P7 explicitly builds "**new application received (employer)**". The plan's own P7 exit checklist says: "No event produces a notification for the **wrong** role (walk the proposal's table row by row)." By that test, the plan fails itself.

Also unaudited in the plan: the matrix has **13 rows**; the plan lists **15 events**. "Employer registers" is not a matrix row at all. "Candidate registers" fires to *both* candidate and admin — the plan lists "candidate registered" and "new pending item (admin)" as separate items with no stated mapping. "Candidate shortlisted" and "Interview confirmed" each fire to *two* recipients; the plan's flat list doesn't record recipients anywhere.

**Why it matters.** Notification correctness is one of six Phase 1 deliverables and it is being built from a bullet list instead of the matrix.

**Fix.** Transcribe the p8 matrix verbatim into `packages/shared/notifications.ts` as a typed table `{ event, recipients: Role[], phase1Channels }`, drive `lib/notify.ts` from it, and generate the P7 tests from it. Decide explicitly whether to *add* employer-on-new-application (sensible, but it is a scope change — get it in writing) and whether admin notifications go to all admins.

---

### [HIGH-3] The plan claims Phase 1 "captures every data field the Phase 2 AI scoring needs." It does not.

**What's wrong.** Plan line 29 makes a firm promise. Checking against the Proposal's Phase 2 requirements:

- **Offer acceptance rate** (p7, Quality metrics) — needs `OFFER_ACCEPTED` / `OFFER_DECLINED` / `JOINED`. The plan's terminal stage is `OFFER_MADE`. Unrecoverable retroactively.
- **Rejection reason breakdown, categorised by stage** (p7) — needs a structured `notSelectedReason` enum on `Application`. The plan has only a free-text `note` on the stage event.
- **Location scoring 7 pts** (p9) — needs comparable city values. Plan stores `Job.city` and `CandidateProfile.city` as free text with no canonical list (see HIGH-19).
- **Candidates inactive 90+ days** (p7) — needs a candidate `lastActiveAt`. Only `User.lastLoginAt` exists, which is not the same signal.
- **Employer response time** (p7) — needs a timestamp of the employer's *first* action per application. `employerLastViewedAt` is last-view, not first-action.

**Why it matters.** The sales pitch for building `ApplicationStageEvent` now is "Phase 2 analytics retroactively." That claim is only half true, and the missing half is the half BK will care about (did we place anyone?).

**Fix.** Four cheap additions in migration 005: extend the stage CHECK with `OFFER_ACCEPTED`, `OFFER_DECLINED`, `JOINED`; add `Application.outcomeReasonCode TEXT`; add `Application.firstEmployerActionAt`; add `CandidateProfile.lastActiveAt`. Zero UI cost in Phase 1 beyond two extra buttons on the admin application view. Or delete the claim from line 29.

---

### [HIGH-4] "Complimentary post-launch support for the first year" has zero engineering behind it

**What's wrong.** Phased Plan p1 item 6 and T&C §3 commit to one year of "bug fixes, minor issues, and **platform monitoring**", remotely. The AMC clause (§4) further defines maintenance as including "server and database **monitoring**, regular backups". The build plan contains: no uptime monitoring, no error tracking, no alerting, no log aggregation, no structured logs, no request IDs, no support intake channel, no SLA.

**Why it matters.** You have contractually promised monitoring and will discover outages when BK WhatsApps you. Debugging a user-reported bug 8 months from now against unstructured `pm2` stdout with no request correlation is hours per ticket, unpaid, for a year.

**Fix.** Budget half a day in P10 for: UptimeRobot or a DO monitor on `/api/health` (free), `pino` with a request-id middleware, `pm2-logrotate`, a disk-space alarm, and a documented support channel + response window in the runbook. Also see BLOCKER-6 (`/api/health` must actually check the DB).

---

### [HIGH-5] "Data deletion requests" is promised in the Privacy Policy and cannot be honoured

**What's wrong.** Proposal p2, Privacy Policy: "How candidate and employer data is stored, used, and protected. **DPDP Act compliance.** Salary and salary data handling. **Data deletion requests.**" P8 dutifully writes the policy text. There is no delete endpoint, no admin delete flow, no anonymisation path, no soft-delete column on any table, and `AuditLog` / `Session` / `ApplicationStageEvent` all retain personal data by design.

**Why it matters.** You are publishing a legally-operative promise on a live site that the software cannot fulfil, for a database of ~500 people's CVs, phone numbers and salaries, under a statute with real penalties. The first deletion request will require manual `sqlite3` surgery against production.

**Fix.** Either (a) build `POST /api/admin/candidates/:id/erase` that nulls PII in place (`fullName`→`[deleted]`, mobile/email→NULL-or-hash, deletes `FileAsset` rows *and the files on disk*, keeps `Application`/stage-event rows for audit with the FK intact), plus `deletedAt` on `User`, `CandidateProfile`, `EmployerProfile` — ~0.5 day; or (b) write the policy so deletion is a manual, best-effort, contact-us process with a stated turnaround, and price the manual work. Do not publish (a)'s language while shipping (b)'s capability.

---

### [HIGH-6] There is exactly one admin account and no way to create a second

**What's wrong.** P1 seeds "one admin user from env vars". `GET /api/admin/users` offers search, suspend/reactivate and password reset — no create. The Proposal says "admin **team**" (p2, p7) throughout. Admin login is a "separate unlinked URL" with "no public registration."

**Why it matters.** BK is a firm with staff. Either they all share one login (destroying the AuditLog's `actorId` value, which is the plan's own compliance mechanism), or a developer has to SSH in and INSERT a user every time BK hires. Combined with no password reset, one shared credential over WhatsApp is the realistic outcome.

**Fix.** `POST /api/admin/users` restricted to ADMIN, creating an ADMIN or staff user with `mustChangePassword=1`. ~2 hours. Add the guard from HIGH-20 at the same time.

---

### [MEDIUM-1] The sector taxonomy is inconsistent between the two PDFs and the plan invents a resolution

**What's wrong.** Proposal p5 employer dropdown lists **7**: Engineering / Pharma / Manufacturing / Machine Building / Operations / Lab / Drafting. Proposal p3 candidate row says "Engineering, Pharmaceuticals, **Sales** etc." The plan's Context line names **8** including Sales, and P1 says "Seed: **8 sectors**". Also "Pharma" vs "Pharmaceuticals".

**Why it matters.** Sector is the **hard elimination filter** for Phase 2 Stage 1 (Proposal p9: "Sector does not overlap → eliminated"). If the candidate and employer dropdowns are seeded from different lists, or a name changes after go-live, matching silently returns nothing. It is also the primary public jobs filter.

**Fix.** One `SECTORS` constant in `packages/shared` used to seed `Sector` and to render both dropdowns. Get BK to confirm the exact list and spelling in writing in week 1 — it is a two-minute question with a long tail.

---

### [MEDIUM-2] The employer pipeline is specified as 4 Kanban buckets; the plan exposes 8 raw stages

**What's wrong.** Proposal p6 defines the employer's view as **NEW / REVIEWING / INTERVIEW / DECISION**. Phase 2 replaces "the simple sortable list with a **visual board**" — so the *buckets* are Phase 1, only the drag-and-drop is Phase 2. The plan gives the employer stage-filter tabs over the internal enum (`APPLIED`, `UNDER_REVIEW`, `SHORTLISTED`, `INTERVIEW_SCHEDULED`, `INTERVIEWED`, `OFFER_MADE`, `NOT_SELECTED`, `WITHDRAWN`).

**Why it matters.** The employer sees eight statuses where the contract shows four, with different names. It will read as "not what we agreed."

**Fix.** Define `EMPLOYER_BUCKET: Record<Stage, 'NEW'|'REVIEWING'|'INTERVIEW'|'DECISION'>` in `packages/shared`; the employer list groups and filters by bucket. Same exercise for the candidate tracker (MEDIUM-3). This also makes the Phase 2 Kanban a pure UI swap.

---

### [MEDIUM-3] Candidate-facing stage labels are unmapped

**What's wrong.** The contract (Phased Plan p1) promises "Applied → Under Review → Shortlisted → **Interview** → Decision"; the Proposal p3 shows six including "Interviewed". The plan's enum has `INTERVIEW_SCHEDULED`, `OFFER_MADE`, `NOT_SELECTED`. No label map is specified for the candidate timeline.

**Fix.** A `CANDIDATE_STAGE_LABEL` map in `packages/shared` using the contract's exact words; `OFFER_MADE`/`NOT_SELECTED` both render under "Decision".

---

### [MEDIUM-4] Admin "360° Job Opening" and "Salary vs employer budgets" are dropped without comment

**What's wrong.** Proposal p7 lists three admin views: 360° Candidate, 360° Job Opening, Metrics Dashboard. The plan mentions the 360° candidate view once (in a paragraph about batch loading) and never lists it as a deliverable; the 360° Job Opening view is absent entirely. "Salary vs employer budgets" — comparing a candidate's `expectedSalaryMin/Max` to the job's `salaryBandMin/Max` — is the highest-value admin screen in the product (admin is the only role that can see both sides) and costs almost nothing since both numbers are already in the DB.

**Fix.** Add to P4/P6: an admin application-detail panel showing candidate expected range vs job band with a delta. Half a day. Explicitly note in the plan that the Metrics Dashboard is Phase 2 (correct) and confirm 360° Job Opening scope with BK.

---

### [MEDIUM-5] Scope creep the agency will eat, unpriced

Not promised anywhere in either PDF, but in the plan:

| Item | Est. cost | Verdict |
|---|---|---|
| FTS5 keyword search + sync triggers (contract promises filter by sector/city/experience only) | ~0.75 day + ongoing migration complexity | **Cut.** `LIKE` on title is enough for <200 jobs. |
| `Job.viewCount` | 0.25 day + a DB write per public pageview | **Cut.** Not promised, actively harmful (HIGH-13). |
| SEO: OG tags, react-helmet-async, sitemap.xml, robots.txt | ~0.5 day | Keep — cheap, but it's a giveaway; mention it as goodwill. |
| Lighthouse a11y ≥90 as a gate | ~0.5–1 day of retrofit | Keep the practice, drop the numeric gate. |
| `docs/API.md` + `docs/SCHEMA.md` | ~0.5 day | **Cut.** `RUNBOOK.md` is the one that pays for itself over the support year. |
| Per-step autosave in the profile wizard | ~0.5 day | Reduce to save-on-step-advance. |
| Admin enquiry management (mark-handled) | ~0.25 day | Keep — justified since there's no email. |
| 11 hand-rolled UI primitives | **~2 days** | **Cut.** Use shadcn/ui. See HIGH-24. |
| `AuditLog` + polymorphic `AdminNote` | ~0.75 day | Notes are promised implicitly ("Admin notes and recommendations", p7). AuditLog is not — but keep it; it's the cheapest defence you have. |

Roughly **5 unpaid days** on a 25-day contract. Cutting FTS5, viewCount, the two doc files and hand-rolled UI recovers ~3.5 days against the overrun — more than the plan's entire "Cut order" list.

---

### [LOW-1] The `Sector` table's stated benefit is false

Plan line 213: "A table rather than a hardcoded enum **so BK can add sectors without a deploy**." There is no admin sector CRUD screen in P4 or anywhere else. Without one, adding a sector still requires a developer with `sqlite3` access. Either build the screen (~2 hours, and it's genuinely useful given Sector is Phase 2's hard filter) or delete the justification.

### [LOW-2] The "For Employers" posting inquiry form is not planned

Proposal p2 lists a "posting inquiry form" on the For Employers page. The plan only builds a generic Contact form. `ContactEnquiry.enquiryType` already supports it — say so explicitly in P8 and render the same form component on that page with the type pre-set.

### [LOW-3] The 24-hour interview reminder is not flagged as deferred

Proposal p6 and the p8 matrix both include it. Its channels are "Email + WhatsApp" only (no Portal), so it is legitimately Phase 2 — but the plan never says so. Add it to the "Explicitly out of scope" list so BK isn't surprised.

---

## 2. Deployment and change management

This is the weakest section of the plan by a wide margin: **one sub-phase, 2 days, 13 checkboxes, and no process for the 12 months that follow.**

### [BLOCKER-4] The build will very likely OOM on the specified droplet, and `better-sqlite3` is a native module

**What's wrong.** The contract specifies 1 vCPU / 1GB RAM (both PDFs). The plan says "Deploy script in `deploy/`" and nothing more. Two concrete failures:

1. `tsc --build` across three workspaces plus `vite build` of a React 19 + Tailwind v4 + TanStack Query app routinely peaks well over 1GB. On a 1GB droplet with no swap configured (the plan never mentions swap), the build is killed by the OOM killer mid-way — potentially *after* the old `dist` has been replaced.
2. `better-sqlite3` is a **native addon**. You cannot `rsync node_modules` from an Apple Silicon Mac to Ubuntu x86_64 — the `.node` binary won't load. Installing on the droplet needs `build-essential` + `python3` and, if no prebuild matches the Node version, a full C++ compile — which is itself memory-hungry on 1GB.

**Why it matters.** This is the first thing that happens on deploy day and it fails. Then it fails again on every bug fix for a year.

**Fix.** (a) Add a 2GB swapfile as step one of provisioning, permanently. (b) **Never build on the droplet.** Build artifacts locally or in GitHub Actions; ship `apps/web/dist` and `apps/api/dist` via rsync. (c) Install production deps on the droplet with `npm ci --omit=dev` (not rsync) so the native binding matches, pin the Node version in `.nvmrc` and in the pm2 config, and verify `node -e "require('better-sqlite3')"` in the smoke test.

### [BLOCKER-5] Resume files are not backed up

**What's wrong.** P10: "Nightly cron: **SQLite backup**, 14-day retention, off-droplet copy." Uploads live on local disk (P2: "stored outside web root"). The backup covers the `.db` file only. There is no mention of backing up `uploads/`.

**Why it matters.** Lose the droplet and you lose every CV. The database still has `FileAsset` rows pointing at files that no longer exist, so every resume link 404s and there is no way to tell candidates what was lost. T&C §5 disclaims liability, which is legally useful and commercially irrelevant — this ends the relationship.

**Fix.** The backup script backs up **both**: `sqlite3 data/bktc.db ".backup '/tmp/bktc-$(date).db'"` **and** a `tar`/`rsync` of `uploads/`. Both go off-droplet. Rehearse the restore of both (P9 already requires a rehearsal — extend it to files). Budget the off-droplet storage cost and tell BK (see MEDIUM-19).

### [BLOCKER-6] There is no deployment process, no release structure, and no rollback

**What's wrong.** The entire post-go-live change-management story is: "Deploy script in `deploy/`" and "Runbook covers: deploy, rollback…". Nothing describes what either does. Meanwhile the contract binds you to a year of bug fixes.

Concretely missing:
- **Release structure.** If the deploy script `rsync`s over `/var/www/bktc/web` and `dist/`, rollback means rebuilding an old commit on a box that can't build (BLOCKER-4). There is no `releases/<sha>/` + `current` symlink pattern, so there is no atomic switch and no instant rollback.
- **Rollback of code and schema together.** Migration 009 adds a NOT NULL column; you roll the code back to the previous release; the old code doesn't know the column; inserts fail. No down-migrations exist. No compatibility rule is stated.
- **In-flight requests.** `pm2 restart` sends SIGINT and kills the process. No `server.close()` graceful shutdown handler is in the plan, so an in-progress 5MB resume upload dies and, worse, leaves a temp file on disk with no DB row.
- **No maintenance page.** During the ~5–20s window the API is down, the SPA is up and every request 502s with a raw nginx page.

**Fix.**
```
/var/www/bktc/releases/<git-sha>/{web,api,node_modules}
/var/www/bktc/current -> releases/<sha>      # atomic ln -sfn + mv
/var/www/bktc/shared/{data,uploads,.env}     # never inside a release
```
Deploy = upload release dir → `npm ci --omit=dev` → **backup DB + uploads** → `npm run db:migrate` → flip symlink → `pm2 reload` (not `restart` — reload is graceful) → smoke-test → on failure, flip the symlink back and `pm2 reload`. Add a SIGTERM handler that calls `server.close()` and `db.close()`. Rule, written in the runbook: **every migration must be backwards-compatible with the previous release** (add columns nullable, never rename or drop in the same deploy as the code change — use expand/contract across two deploys). ~1 extra day in P10, and it pays for itself on the third bug fix.

### [HIGH-7] The migration runner's "each migration runs inside a transaction" is not sufficient for this schema

**What's wrong.** The plan leans heavily on `CHECK (stage IN (…))` enums — that is a stated design highlight (line 164). SQLite's `ALTER TABLE` supports only `RENAME TABLE`, `RENAME COLUMN`, `ADD COLUMN` and (3.35+) `DROP COLUMN`. **You cannot alter a CHECK constraint.** Adding `OFFER_ACCEPTED` to the stage enum — a near-certain Phase 2 requirement, and one this review already recommends — requires the full 12-step table rebuild: new table, copy, drop old, rename, **and recreate every index, trigger and FK**.

Worse, that procedure requires `PRAGMA foreign_keys=OFF` around it, and **`PRAGMA foreign_keys` is a no-op inside a transaction** (SQLite silently ignores it). So the plan's "wrap it in a transaction" approach will either fail on FK violations or, if `legacy_alter_table` is involved, silently corrupt child-table references.

Also unstated: whether the `schema_migrations` INSERT is inside the same transaction as the DDL (it must be), and whether `PRAGMA foreign_key_check` / `integrity_check` runs after.

**Fix.** Document the CHECK-rebuild recipe in `docs/RUNBOOK.md` now, while it's cheap: `PRAGMA foreign_keys=OFF` → `BEGIN` → rebuild → `PRAGMA foreign_key_check` → `COMMIT` → `PRAGMA foreign_keys=ON`. Make the migration runner: (1) take a `.db` backup before applying anything, (2) run each migration's DDL and its `schema_migrations` row in one transaction, (3) run `PRAGMA foreign_key_check` and `PRAGMA integrity_check` afterwards and abort/restore on failure. Seriously consider using lookup tables + FKs instead of CHECK enums for the volatile ones (`stage`, `profileStatus`, `job.status`) — adding a row is trivial, altering a CHECK is not.

### [HIGH-8] No staging environment

**What's wrong.** The plan has exactly one environment: production. Migrations are rehearsed nowhere. The client's UAT happens on production. Every post-launch fix for a year goes straight to the live box.

**Why it matters.** The first migration that fails, fails on real candidate data. There is no way to demo a change to BK before it's live. There is no way to test the deploy script itself.

**Fix.** You do not need a second droplet. Minimum viable staging: a `staging` release dir + a second pm2 process on port 4001 + a second nginx server block on `staging.bktalentconnect.com` (behind HTTP basic auth) + a *copy of the production DB* refreshed from the nightly backup. Marginal cost: zero. Time: ~0.5 day. This also gives you the restore rehearsal for free — restoring into staging *is* the restore test.

### [HIGH-9] SPA cache-busting and version skew are unaddressed

**What's wrong.** P10 says "gzip, cache headers" with no specifics. Two concrete failure modes:

1. If `index.html` is served with any cache lifetime, users continue loading the *old* `index.html`, which references `/assets/index-<oldhash>.js`. After the second deploy that file is gone → **white screen of death**, unfixable by the user except by a hard refresh.
2. A user with a tab open across a deploy triggers a React lazy-loaded route → the chunk 404s → unhandled promise rejection → blank route. Meanwhile their old bundle may call an API shape that has changed.

**Fix.** nginx: `location = /index.html { add_header Cache-Control "no-store"; }` and `location /assets/ { add_header Cache-Control "public, max-age=31536000, immutable"; }`. Add a build-time `__APP_VERSION__` (git sha) to the SPA and a `GET /api/version` returning the same; `apiClient` compares the response header `X-App-Version` against the loaded one and shows a "New version available — reload" toast on mismatch. Wrap lazy imports in an error boundary that force-reloads once on chunk-load failure. ~2 hours total, saves the year's most confusing support tickets.

### [HIGH-10] The backup script method is unspecified, and `cp` under WAL produces a corrupt backup

**What's wrong.** "SQLite backup script" — that's all. If it is `cp data/bktc.db backup.db`, under WAL mode the copy is missing everything in `-wal` that hasn't been checkpointed, and can be torn mid-write. The "off-droplet copy" destination is named nowhere — no credentials, no bucket, no cost line. DO Spaces was explicitly deferred in the plan, so there is no configured off-box storage at all.

**Fix.** Use `sqlite3 data/bktc.db ".backup '$OUT'"` or `VACUUM INTO` — both are safe against a live writer. Name the destination concretely (DO Spaces at $5/mo — which the Proposal p13 already budgets, or `rclone` to Google Drive at zero cost) and get BK to approve the cost. Add `PRAGMA integrity_check` on the backup file before uploading, and alert on failure — an unmonitored backup cron that has been failing for 3 months is the classic version of this incident.

### [MEDIUM-6] The plan references CI twice; there is no CI

**What's wrong.** Line 176: the schema-parity test "runs in **CI**". P9: "Schema-parity test covers all 16 tables". P0 sets up ESLint and a pre-commit hook — no CI is configured anywhere in the plan, and there is no repo-hosting decision at all.

**Why it matters.** The plan's central defence against hand-written-SQL drift is a test that is asserted to run in a system that doesn't exist. A pre-commit hook is bypassable with `--no-verify` and doesn't run on the deploy path.

**Fix.** Minimum viable pipeline, ~2 hours: a GitHub Actions workflow on push — `npm ci`, `lint`, `tsc --noEmit`, `test`, `build`. Second workflow, manual-dispatch, that builds artifacts and rsyncs to the droplet via a deploy key. That is the CI/CD story; anything less means every deploy is a laptop with uncommitted changes.

### [MEDIUM-7] Secrets management is undefined, and the "strong session secret" appears to be unused

**What's wrong.** P10: "Production `.env` with a strong session secret." But the session design (line 193) is an **opaque random token, hashed in the DB** — that requires no secret at all. So either the plan has a leftover from a JWT design, or something signs cookies and it isn't described. Separately: no `.env` file permissions (`chmod 600`, owned by the deploy user), no statement of who holds a copy, no recovery plan if the droplet is lost, no rotation procedure.

**Fix.** Delete `SESSION_SECRET` if unused, or specify exactly what it signs. `chmod 600` and `chown deploy:deploy` the `.env`, keep it in `shared/` outside every release, and store a sealed copy in the client's password manager (this also matters for the IP-transfer clause — see MEDIUM-18). Document rotation in the runbook.

### [MEDIUM-8] No log rotation or disk monitoring — the failure mode is total outage

**What's wrong.** pm2 writes stdout/stderr to `~/.pm2/logs/*.log` **unbounded**. Uploads grow unbounded (5MB × N candidates, plus every replaced resume — the plan never deletes old `FileAsset` files). Nightly DB backups accumulate for 14 days locally. Droplet disk is 25GB.

**Why it matters.** When the disk fills, SQLite writes fail with `SQLITE_FULL` and every write path in the app 500s. This is the single most likely cause of an outage in year one and there's no alarm on it.

**Fix.** `pm2 install pm2-logrotate` with `max_size=10M, retain=7, compress=true`. Delete local backups older than N days in the same cron. Alarm at 80% disk. Delete the previous file when a resume is replaced (see MEDIUM-14).

### [LOW-4] certbot renewal has no reload hook

P10 verifies the renewal dry run but never mentions `--deploy-hook "systemctl reload nginx"`. Without it the certificate renews and nginx keeps serving the expired one for up to 60 days. One line.

### [LOW-5] `fail2ban` is listed but not configured for the application

`fail2ban` out of the box protects `sshd` only. If the intent is to blunt credential stuffing against `/api/auth/login`, it needs an nginx-based jail and structured access logs. Either configure it or don't claim it.

---

## 3. Missed edge cases and scenarios

### [BLOCKER-7] A candidate can never edit their profile after approval

**What's wrong.** P2: "After submit the profile is **read-only** and shows 'Under review'." The only path back to editable is `CHANGES_REQUESTED`. `profileStatus` has no state representing "approved, with edits pending". So once APPROVED, a candidate can never change their phone number, add a new job, update their notice period, upload a newer CV, or correct a typo. Ever.

**Why it matters.** This is a permanent, product-breaking hole in the most-used screen in the app, and it will be discovered by the client in the first week of real use. It also guarantees stale data, which is the input to the Phase 2 matching engine they're paying for next.

**Fix.** Decide now, and it is a genuine design decision with cost implications:
- **Option A (cheap, ~0.5 day):** approved candidates may edit freely; edits to *non-material* fields (mobile, city, notice period, relocation, LinkedIn) apply immediately, while edits to *material* fields (skills, experience, career summary, resume, salary) flip `profileStatus` back to `SUBMITTED` and remove the candidate from job browsing until re-approved. Simple, but it punishes candidates for updating their phone number.
- **Option B (correct, ~1.5 days):** draft/published split — `candidate_profile` (live, approved) + `candidate_profile_draft`. The candidate edits the draft; the live copy stays visible to employers; admin approves the draft and it's copied over. This is what the "managed" model actually requires.
- **Option C (~0.25 day):** admin-only edits — candidate emails BK, BK edits. Zero build cost, unbounded support cost.

Pick one, write it into the plan, and tell BK. The same decision governs the review-queue UX (admin needs a diff view, which none of the options currently budget for).

### [BLOCKER-8] A live job can be edited without re-approval, breaking the client's core rule

**What's wrong.** P3 lists `PATCH /api/employer/jobs/:id` and describes edit+resubmit only for the `CHANGES_REQUESTED` case. `Job.status` has no state for "APPROVED with pending edits". Nothing in the plan says what happens when an employer PATCHes an `APPROVED` job.

**Why it matters.** The literal Phase 1 promise is "*Approve or reject … job postings before they go live*" (Phased Plan p1). If an employer can post a clean job, get it approved, then edit the description into anything they like — including inserting their own phone number and email, defeating the entire no-direct-contact rule — the product's central value proposition is void.

**Fix.** Explicitly: `PATCH` on an `APPROVED` job is either (a) rejected with 409 and the employer must "unpublish to edit" (`APPROVED → PENDING_APPROVAL`, job leaves public listings), or (b) allowed for a whitelisted set of non-material fields (`numberOfPositions`, `targetJoiningDate`) and blocked for the rest. Enforce it in the repository/service layer with a field allowlist keyed on current status, and add it to the P3 exit checklist and the P9 test matrix. **Also add a text scan** for phone numbers and email addresses in `description` at submit time, flagged to admin — the no-direct-contact rule is otherwise trivially bypassed via the JD.

### [BLOCKER-9] The stage-transition matrix — the most important business logic in the product — is never written down

**What's wrong.** P5: "Central stage-transition validator (legal transitions only, from every role)." That is the entire specification. Unanswered: Can an employer regress `SHORTLISTED → UNDER_REVIEW`? Is `NOT_SELECTED` reversible (a mis-click permanently ends a candidate's chance and notifies them)? Can admin override anything? Can anything transition out of `WITHDRAWN`? Does `INTERVIEWED` get set manually and by whom? What happens on `OFFER_MADE` — is it terminal? Can a candidate withdraw from `OFFER_MADE`?

**Why it matters.** Every notification, every metric, every employer-facing bucket and every P9 test depends on this table. Building it by intuition mid-P5 means it will be wrong and will be re-litigated with the client.

**Fix.** Write the full matrix — `from × to × allowedRoles` — into `packages/shared/stages.ts` **before P5 starts**, and derive both the validator and the tests from it. Take a position on the hard ones: regression allowed for admin only; `NOT_SELECTED` reversible by admin only within 24h; `WITHDRAWN` terminal-except-admin (see HIGH-11).

### [HIGH-11] Withdraw is a permanent, irreversible lockout from that job

**What's wrong.** `Application` is UNIQUE on `(jobId, candidateProfileId)` — the plan celebrates this. A candidate mis-clicks "Withdraw" (or withdraws, then reconsiders) and can **never** apply to that job again. `POST /api/candidate/jobs/:id/apply` will hit the unique constraint forever.

**Why it matters.** Guaranteed support ticket, unfixable by BK without SQL. The candidate's only recourse is asking BK to delete a row.

**Fix.** Keep the unique constraint (it's right) and add `POST /api/candidate/applications/:id/reapply` which, if `stage='WITHDRAWN'` and the job is still `APPROVED`, resets the stage to `APPLIED`, writes a new stage event, and re-fires the notification. Also add a confirmation modal on withdraw. ~1 hour.

### [HIGH-12] Employer suspension, job closure and candidate rejection have no defined cascade to live applications

**What's wrong.** Three undefined scenarios, all of which will occur:
1. **Admin suspends an employer** who has 3 `APPROVED` jobs with 40 live applications. The plan kills their session. Their jobs stay `APPROVED` and publicly visible; candidates keep applying into a dead pipeline; the candidates' trackers sit at "Under Review" forever.
2. **Job is CLOSED/FILLED** mid-pipeline. P3 says "Closing a job removes it from public listings but keeps its applications intact." Are the applicants notified? Can the employer still act on them? Do the candidates' trackers show anything? Nothing is specified.
3. **Candidate is REJECTED or suspended** after having applied. `requireApprovedCandidate` blocks their browsing, but their existing applications persist and employers still see their profile in the applicant list — including a candidate BK explicitly rejected as unverified.

**Fix.** Define all three, in the plan:
- Suspending an employer sets all their `APPROVED` jobs to a `SUSPENDED`/`CLOSED` state and removes them from public listings; open applications get a stage event and a candidate notification.
- Closing a job: all applications below `SHORTLISTED` move to `NOT_SELECTED` with reason `JOB_CLOSED` and the candidate is notified; applications at `SHORTLISTED`+ remain actionable by admin. This is the honest behaviour and prevents an accumulating pile of zombie applications.
- Rejecting/suspending a candidate excludes them from employer applicant lists (a `WHERE u.status='ACTIVE' AND cp.profileStatus='APPROVED'` join on the applicant query) but preserves the rows.

### [HIGH-13] `busy_timeout=5000` on synchronous `better-sqlite3` freezes the entire API, not one request

**What's wrong.** `better-sqlite3` is **synchronous** — every query blocks the Node event loop. `busy_timeout=5000` means that when a write lock is contended, the process **spins for up to 5 seconds with the event loop blocked**. Every user of the platform gets a 5-second stall, not just the one who hit the lock. Contenders exist: the nightly backup, the WAL checkpointer, and — thanks to `Job.viewCount` — **a write on every anonymous public job pageview**, which is the single most-hit endpoint on the site and is reachable by any bot.

**Why it matters.** A crawler hitting `/api/public/jobs/:id` at 20 rps generates 20 writes/sec on a 1 vCPU box and can trivially induce lock contention and event-loop stalls.

**Fix.** (a) **Delete `viewCount`** — it's unpromised scope creep with a disproportionate cost; if BK wants it, batch it in memory and flush every 60s. (b) Lower `busy_timeout` to ~2000ms. (c) Run the backup with `.backup`, which is designed for concurrent access, and run it at 3am IST. (d) `PRAGMA wal_autocheckpoint` and a periodic `wal_checkpoint(TRUNCATE)` in the cron so the `-wal` file doesn't grow unbounded under a long-running read.

### [HIGH-14] Timezone is never mentioned once, and this app schedules interviews

**What's wrong.** The plan says "Timestamps are ISO-8601 TEXT in **UTC**." Every user is in IST (UTC+5:30). `Interview.scheduledAt` is entered by an admin in a browser and displayed to a candidate and an employer. There is no statement about how the admin's input is interpreted, how it's rendered, or that IST is the canonical display timezone. There is also **no validation that `scheduledAt` is in the future**.

**Why it matters.** A 5.5-hour error on an interview time is a candidate missing an interview, which is the client's business failing in front of their own customer. It is also the classic bug that survives all testing because the developer's machine is also in IST — and then breaks the moment a Date is constructed from a bare `YYYY-MM-DDTHH:mm` string, or SQLite's `datetime('now')` (which returns UTC without a `Z`) is compared against a JS `toISOString()`.

**Fix.** State the rule in the plan: **store UTC ISO-8601 with explicit `Z` and millisecond precision; render everywhere in `Asia/Kolkata` with an explicit "IST" suffix.** One `formatDateTime()` in `web/src/lib/formatters` — nothing else formats a date. Validate `scheduledAt > now + 1h` at the API. Add an IST rendering assertion to the P6 exit checklist.

### [HIGH-15] Admin recommendation shares a candidate's profile and CV with an employer without the candidate's knowledge or consent

**What's wrong.** `POST /api/admin/jobs/:id/recommend` creates an `Application` with `source=ADMIN_RECOMMENDED`. The candidate is not notified (no such row in the p8 matrix, no such event in P7). The candidate's profile — and, at shortlist, their resume — is now visible to a company they never applied to. There is no consent checkbox at registration covering this.

**Why it matters.** Under the DPDP Act, BK is the Data Fiduciary and this is a processing purpose that needs notice and consent. Commercially, a candidate discovering they were "put forward" to their **current employer** is a serious incident — and given BK operates in narrow industrial sectors, that is not a hypothetical.

**Fix.** (a) At candidate registration, an explicit, logged consent checkbox: "I consent to BK Talent Connect sharing my profile with relevant employers on my behalf." Store `consentedAt` + version on `CandidateProfile`. (b) Fire a candidate notification on recommendation ("BK has put you forward for a role") — it's also a good product moment. (c) Show recommended applications in the candidate's own tracker, clearly labelled. (d) Give the candidate a "not interested" action that withdraws it. ~0.5 day, and it's the difference between a feature and a liability.

### [HIGH-16] No input bounds anywhere; the shared `Skill` table is an open spam target

**What's wrong.** The plan states minimums (3 skills, 150 chars, 100 words) and **not one maximum**. No max skill count, no max career-summary length, no max experience rows, no max length on `keyAchievement`, no bound on the `locations` JSON array, no bound on `domainTags`, and the JSON body limit in P0 is unspecified. Meanwhile: "*new skills auto-created on first use*" (line 211) — into a **globally shared** table, from **unmoderated candidate input**, with no admin merge/delete UI anywhere in the plan.

**Why it matters.** One candidate (or one script against an authenticated account) adds 5,000 junk skills; they now pollute the autocomplete for every candidate and every employer, permanently, and there is no admin screen to clean them up. A 10MB career summary in a TEXT column bloats every profile read. This is trivially exploitable and the cleanup is manual SQL.

**Fix.** Every zod schema in `packages/shared` gets an explicit `.max()`. Concretely: skills ≤ 20 per candidate / ≤ 15 per job, `careerSummary` 150–2000 chars, `description` 100–1000 words, experience rows ≤ 15, `locations` ≤ 10, all short text ≤ 200 chars, `express.json({ limit: '100kb' })`. Auto-created skills get `isApproved=0` and appear in autocomplete only after admin approval (or: only admins can create new skills, and candidates request one). Add a skills-admin screen with merge — it also fixes the "AutoCAD"/"Auto CAD" problem below.

### [HIGH-17] The skill-normalisation example in the plan does not work

**What's wrong.** Line 211: "new skills auto-created on first use with normalized slug so **'Auto CAD' and 'AutoCAD' converge**." Standard slugification gives `auto-cad` and `autocad` — they do **not** converge. Stripping all non-alphanumerics makes them converge, but then merges genuinely distinct terms and still fails on "Auto-CAD 2020", "AUTOCAD", "Autodesk AutoCAD".

**Why it matters.** Skills are 35 of 100 points in the Phase 2 matching engine. A fragmented taxonomy degrades the product BK is buying next.

**Fix.** Slug = lowercase, strip everything non-alphanumeric (`autocad` for both). Accept the false-merge risk, seed a good starter list so the common cases never get auto-created, and provide an admin merge tool (`UPDATE candidate_skill SET skill_id=? WHERE skill_id=?; DELETE FROM skill WHERE id=?`). Don't ship the claim without the merge tool.

### [HIGH-18] The last admin can be suspended, and there is no recovery path

**What's wrong.** `GET /api/admin/users` offers suspend for any user. There is one admin. Nothing prevents an admin suspending themselves or the last remaining admin. There is no password reset, so a forgotten admin password has the same effect. Recovery requires SSH + `sqlite3` + generating an argon2 hash by hand.

**Fix.** Guard: reject suspension/demotion if it would leave zero `ACTIVE` `ADMIN` users, and reject self-suspension. Ship `npm run admin:create` and `npm run admin:reset-password` CLI scripts in `apps/api` and document them in the runbook — this is the break-glass procedure you will need at 11pm on a Sunday during the support year.

### [HIGH-19] `city` is free text, and "filter by city" is a contractually promised feature

**What's wrong.** `Job.city`, `CandidateProfile.city`/`state` are free-text. `EmployerProfile.locations` is a JSON string array. The Phased Plan promises candidates "browse & filter by sector, **city** and experience."

**Why it matters.** "Pune", "pune", "Pune ", "Pune, MH", "Pimpri-Chinchwad" are five distinct filter values. The filter dropdown will be a garbage list built from `SELECT DISTINCT city`. It also poisons the Phase 2 location score (7 pts) and the Stage 1 hard filter.

**Fix.** A seeded `city` lookup table (top ~80 Indian industrial cities + "Other") with `cityId` FKs on `Job` and `CandidateProfile`, plus an autocomplete that only permits list values. ~3 hours in P0's seed, versus an unfixable data-quality problem.

### [MEDIUM-9] Two admins approving the same record: no optimistic concurrency

**What's wrong.** Two admins open the same pending candidate; both click Approve. Both `UPDATE`s succeed, two `AuditLog` rows are written, two notifications fire, and if one clicked Approve while the other clicked Reject the last write wins silently.

**Fix.** Make the state transition conditional in SQL: `UPDATE candidate_profile SET profileStatus='APPROVED', … WHERE id=? AND profileStatus IN ('SUBMITTED','CHANGES_REQUESTED')` and check `changes === 0` → 409 "already reviewed by someone else." Apply the same pattern to every approve/reject/stage-change. Cheap and it's the correct fix.

### [MEDIUM-10] Applying to a job that was just closed — no guard specified

`POST /api/candidate/jobs/:id/apply` is described as "one-click; blocks duplicates". It must also assert, inside the same transaction, that the job is still `APPROVED` and not closed/filled — otherwise a candidate with a stale page applies to a closed role. `WHERE status='APPROVED'` in the insert's guard query.

### [MEDIUM-11] File writes and DB writes cannot share a transaction, and orphans are never reconciled

`better-sqlite3` transactions are synchronous and cannot contain async work; multer has already written the file to disk before the handler runs. If the `FileAsset` insert fails, the file is orphaned on disk with no row. If a `CandidateProfile` is later erased (HIGH-5), the file must be unlinked explicitly. **Fix:** write to a `tmp/` dir, insert the row, then `rename()` into place; on insert failure `unlink()`. Add a weekly cron that deletes files in `uploads/` with no `FileAsset` row older than 24h. Document it.

### [MEDIUM-12] Interview reschedule loses history and neither party confirms

`Interview` has a `RESCHEDULED` status but `PATCH` mutates the row in place — the original time is gone, and there is no `interview_event` history. The Proposal (p6) says the admin "schedules and **confirms with both parties**"; there is no confirmation field for either side. **Fix:** either an append-only `interview` row per schedule (with `supersededById`) or an `interview_event` log; add `candidateConfirmedAt` / `employerConfirmedAt` and surface a Confirm button on both interview cards. The latter is ~2 hours and directly delivers "coordinate interviews between both parties".

### [MEDIUM-13] Offset pagination plus "recommended pinned to top" will produce duplicates and skips

**What's wrong.** The employer applicant list is paginated, sortable, *and* has recommended rows pinned. If pinning is done in JS after `LIMIT/OFFSET` (which is what "pinned to the top of the employer's list" implies), page 2 pins a different set and rows appear twice or vanish. Offset pagination over a list that changes between requests compounds this.

**Fix.** Pinning must be in SQL: `ORDER BY isRecommended DESC, <sortKey> <dir>, id DESC` — and `id` as a final tiebreak is mandatory for stable pagination (SQLite gives no ordering guarantee for ties). Add the P5 exit check: "Recommended pinned above the rest **on page 2 as well**."

### [MEDIUM-14] Replacing a resume silently swaps the CV an employer already shortlisted on

`CandidateProfile.resumeFileId` is a single pointer. A candidate uploads a new CV; every employer who shortlisted them now sees a different document than the one they evaluated, and the previous `FileAsset` is orphaned on disk forever. **Fix:** decide and document — simplest correct behaviour is to keep `FileAsset` rows immutable and record `Application.resumeFileIdAtApply` snapshot at apply time; at minimum, delete the superseded file and log the replacement to `AuditLog`.

### [MEDIUM-15] Email is immutable, case handling is asserted but not enforced, and one person can't hold two roles

Three related gaps: (1) there is **no email-change endpoint** anywhere, and email is the login identifier — a user who changes jobs and loses access to their address is locked out permanently (compounded by no password reset). (2) "email (unique, lowercased)" is a comment, not a constraint — enforce with `email TEXT NOT NULL UNIQUE COLLATE NOCASE` *and* normalise (trim + lowercase) in one place used by register, login, admin-create and seed. (3) `UNIQUE(email)` across all roles means an HR manager cannot also be a candidate, and a company cannot have two HR users on one `EmployerProfile` (it's one-per-`User`). The Proposal's "**Primary** HR contact" wording hints at more. Decide and document; at minimum add an admin email-change action.

### [MEDIUM-16] FTS5 will 500 on ordinary user input

FTS5 `MATCH` takes a query *syntax*, not a literal. A candidate searching `senior "process` or `AutoCAD*` or `R&D` will hit `SQLITE_ERROR: fts5: syntax error near …` — an unhandled 500 on the public jobs page, which is the highest-traffic page on the site. **Fix:** wrap the user's terms — tokenise on whitespace, strip FTS operators, and double-quote each token: `"senior" "process"`. Also: the FTS table indexes *all* jobs, so every query must join back to `job.status='APPROVED'`, and the triggers must cover INSERT/UPDATE/DELETE on `job` **and** on `job_skill` (skills are in the index but live in another table). This is more work than "costs nothing" suggests — another reason to cut it (MEDIUM-5).

### [MEDIUM-17] `completionPercent` is a client-visible number with no definition

"Recomputed on every save" — but nothing states which fields count, whether optional fields count, or how it's weighted. It's a number BK and candidates will see and argue about. Define it as an explicit weighted field list in `packages/shared` so client and server agree, and unit-test it (the plan's P2 exit check "matches what is actually filled" is untestable as written).

### [LOW-6] The `session` table grows forever

No cleanup of expired sessions is mentioned. Add a `DELETE FROM session WHERE expiresAt < ?` to the nightly cron and on login. Also: decide session lifetime and whether it slides — neither is stated.

---

## 4. Security holes

### [BLOCKER-10] "Sortable" applicant lists are the one place raw string interpolation into SQL is unavoidable

**What's wrong.** The contract requires a "*sortable by status*" applicant list; the plan adds sortable admin queues and filterable searches. `ORDER BY` **cannot be parameterised**. With no ORM and hand-written SQL, the natural implementation is `` `ORDER BY ${req.query.sort} ${req.query.dir}` `` — a direct SQL injection into a database containing every candidate's salary and CV path. The plan mentions no allowlist anywhere and its "Manual IDOR sweep" in P9 doesn't cover this class at all.

Even without injection, an unvalidated sort key leaks private data: `GET /api/employer/jobs/:id/applications?sort=expectedSalaryMin` lets an employer **rank candidates by a field the entire serializer layer exists to hide**, and binary-search the values by combining it with filters. The serializer protects the response body and does nothing about the ordering of it.

**Fix.** A hard allowlist, per endpoint, per role: `const EMPLOYER_APPLICANT_SORTS = { applied: 'a.appliedAt', stage: 'a.stage', name: 'cp.fullName' } as const;` — reject anything not a key with 400. Same for `dir` (`'ASC'|'DESC'` literal). Same pattern for every filter that reaches SQL. Add to P9: "Every sortable/filterable endpoint's sort key is validated against a per-role allowlist; `?sort=expectedSalaryMin` returns 400, not a sorted list." This is the highest-value security fix in the review.

### [HIGH-20] The serializer boundary is a convention, not an enforcement — and the plan cites Prisma, which isn't in the stack

**What's wrong.** The plan calls the serializer layer "the most important design decision," then states the rule as: "**no route handler ever returns a Prisma model directly**" (line 145). **There is no Prisma in this stack** — it's raw `better-sqlite3`. That sentence is a copy-paste from another plan, sitting in the middle of the security architecture. It signals the section wasn't written against this design.

Mechanically: nothing stops `res.json(row)`. TypeScript will happily serialise a `CandidateProfileRow` containing `currentSalary`. The unit tests test the serializers — they cannot test that a route *called* one. A single new endpoint added during the support year, six months from now, bypasses the whole thing.

**Fix.** Make it structural, not aspirational. Two cheap options, use both: (a) brand row types — `type CandidateRow = { … } & { readonly __unserialized: unique symbol }` — so `res.json(row)` is a type error and the only way to strip the brand is a serializer; (b) an ESLint rule banning `res.json(` outside a `sendSerialized()` helper, same mechanism as the existing "ban db imports outside repositories" rule. And fix line 145.

### [HIGH-21] `express-rate-limit` behind nginx without `trust proxy` is both bypassable and a self-DoS

**What's wrong.** The plan sets a 5-login/15-min/IP limit and never mentions `app.set('trust proxy', 1)`. Behind an nginx reverse proxy, `req.ip` is `127.0.0.1` for **every** request. Consequence: the limiter counts all users as one client, so **five failed logins by anyone locks out the entire platform for 15 minutes** — a trivially triggerable global DoS. Set `trust proxy` carelessly (`true`) and the opposite happens: `X-Forwarded-For` is attacker-controlled and the limit is bypassed per-request.

Separately: India's mobile networks use CGNAT heavily. Thousands of legitimate users share an egress IP. A 5/15min per-IP login limit will lock out real candidates on a shared connection.

**Fix.** `app.set('trust proxy', 1)` (exactly one hop) **and** `proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;` in nginx. Key the login limiter on **`email` + IP**, not IP alone, and raise the IP limit to ~30/15min while keeping ~5/15min per email. Add a P1 exit check: "rate-limited responses show distinct counters for two different IPs on production."

### [HIGH-22] The resume download route is a stored-XSS and header-injection surface, and P4 plans an inline viewer

**What's wrong.** `GET /api/files/:id` serves user-uploaded PDF/DOCX from the **same origin** as the SPA and the session cookie. P4 specifies an admin "**resume viewer**" — i.e. rendering inline. A malicious PDF with embedded JavaScript rendered inline on the app's origin executes in the admin's session context. Additionally, `FileAsset.originalName` is attacker-controlled and will end up in a `Content-Disposition` header — newline injection and non-ASCII filename breakage.

**Fix.** Always `Content-Disposition: attachment; filename="resume.pdf"; filename*=UTF-8''<rfc5987-encoded>` — never `inline`, never the raw `originalName`. Add `X-Content-Type-Options: nosniff` and `Content-Security-Policy: default-src 'none'; sandbox` on the file response. Serve the file bytes with an explicit safe `Content-Type` derived from the *verified magic bytes*, not from the client-supplied `mimeType`. On disk, store as `<uuid>.<ext>` — never `originalName` (path traversal). If BK insists on an inline viewer, render it with PDF.js in a sandboxed iframe from a separate origin/path with a restrictive CSP, and budget the extra time.

### [HIGH-23] The audit log, the logs and the session table are three uncontrolled copies of private data outside the serializer boundary

**What's wrong.** The plan's entire privacy story is the serializer layer. Three data paths bypass it completely:
1. `AuditLog.metadata` (JSON) — if it stores the before/after of an approved candidate (the obvious implementation), it contains `currentSalary` and `expectedSalary*` in a table with no serializer and, per the plan, no defined read path beyond "admin".
2. **pm2 logs.** Any request logging, and every unhandled error, writes to plaintext files on the droplet with no rotation (MEDIUM-8), no redaction policy, and no access control beyond SSH. `better-sqlite3` error messages **include the SQL text**, and parameter values leak via zod validation errors.
3. `Session.ipAddress` / `userAgent` — personal data under DPDP with no retention policy.

**Why it matters.** The plan's own pre-launch privacy audit only inspects API responses in DevTools. It would pass while salaries sit in `/home/deploy/.pm2/logs/api-out.log`.

**Fix.** Define an explicit metadata allowlist for `AuditLog` — record `{ field: 'currentSalary', changed: true }`, never values. Add a `redact()` in the logger for `password`, `currentSalary`, `expectedSalary*`, `mobile`, `email`, `token`. Ensure the 500 handler logs `err` server-side but returns only `{ code, message }` to the client (P9 covers stack traces; extend it to `err.message`). Add a session retention rule (delete >90 days). Add "grep the production logs for a known test candidate's salary and mobile" to the pre-launch privacy audit — that is the check that would actually catch this.

### [MEDIUM-18] `cors()` with defaults plus cookie auth is a standing hole

P0 lists `cors` as middleware. In production the SPA is same-origin, so CORS is unnecessary; `cors()` with no options sends `Access-Control-Allow-Origin: *`. That alone won't leak credentialed responses (browsers block `*` + credentials), but any later "fix" that echoes the request Origin with `credentials: true` turns every authenticated endpoint into a cross-origin read. **Fix:** don't mount `cors` in production at all (the Vite dev proxy handles dev); if mounted, use a hard-coded origin allowlist from env, never a reflector.

### [MEDIUM-19] Registration leaks account existence; login doesn't

P1 correctly requires a generic 401 on login. `POST /api/auth/register/*` will return "email already registered" — full user enumeration against a database of people's employment status. Combined with sequential IDs (MEDIUM-22) this is easy harvesting. **Fix:** rate-limit registration per IP, and accept the enumeration consciously (it's hard to avoid without email verification) — but at minimum add it to the plan as a known accepted risk rather than an accident.

### [MEDIUM-20] No session rotation on privilege events; `mustChangePassword` may be UI-only

Sessions must be **rotated on login** (fixation) and **all sessions revoked on password change and admin reset** — otherwise an admin resetting a compromised account's password leaves the attacker's session alive. The plan only says suspension kills sessions. Similarly, `mustChangePassword` is described as "a forced-change screen" — it must be enforced in `requireAuth` middleware (403 on every route except `/auth/change-password` and `/auth/logout`), not by a React redirect.

### [MEDIUM-21] argon2id parameters are unspecified on a 1 vCPU / 1GB box

Default node-argon2 settings (m=65536 KiB, t=3) use 64MB **per concurrent hash** on a droplet with 1GB total, shared with nginx, Node and the SQLite page cache. A handful of simultaneous logins is enough for memory pressure; with no swap (BLOCKER-4) it's an OOM kill. **Fix:** pin `{ type: argon2id, memoryCost: 19456, timeCost: 2, parallelism: 1 }` (the OWASP minimum profile), configure the swapfile, and cap concurrent hashing.

### [MEDIUM-22] Sequential integer IDs leak volume and make IDOR probing trivial

The ID strategy is unspecified anywhere in the schema — which means it will default to `INTEGER PRIMARY KEY`. The plan's own privacy audit line ("Sequential/guessed ids … all 403") assumes sequential. Beyond IDOR probing, sequential IDs leak business volume: an employer seeing candidate `#37` learns the platform has ~37 candidates, which for a client selling "quality curated talent" is commercially damaging. **Fix:** UUIDv7/ULID `TEXT PRIMARY KEY` for `user`, `candidate_profile`, `employer_profile`, `job`, `application`, `file_asset`. Integer PKs are fine for `skill`, `sector`, `notification`, `audit_log`. **Decide this before migration 001** — it is not retrofittable.

### [MEDIUM-23] `SameSite=Strict` will produce a "logged out" bug report in week one, and there's no Origin check

`SameSite=Strict` means the session cookie is **not sent on top-level navigation from another site** — a user tapping a link to `bktalentconnect.com/candidate/applications` from WhatsApp (which the client will do constantly; there's a WhatsApp button on every page) lands logged-out, then appears logged-in after clicking anything. Guaranteed support ticket. Also, SameSite is a browser-version-dependent defence, not a CSRF control. **Fix:** `SameSite=Lax` + a strict `Origin`/`Sec-Fetch-Site` check on all state-changing methods + require a custom header (`X-Requested-With`) that `apiClient` always sends. That combination is strictly stronger than Strict alone and doesn't break inbound links.

### [MEDIUM-24] XSS: no CSP plan, and the job description will need formatting

React escapes by default, but job descriptions are "min 100 words" and will render as an unformatted wall of text unless line breaks are preserved — the two common fixes are `dangerouslySetInnerHTML` (hole) or `white-space: pre-wrap` (safe). The plan says "input sanitization + XSS check" without saying which. There is also no CSP beyond helmet's defaults, and Vite's output needs a compatible policy. **Fix:** state the rule — **no `dangerouslySetInnerHTML` anywhere in this codebase**, enforced by an ESLint rule; free text renders with `white-space: pre-wrap`. Define the CSP explicitly in the nginx config and verify it in P10.

### [LOW-7] `Notification.linkUrl` should not be a URL

Storing a raw URL and rendering it as a link is an open-redirect / `javascript:` vector if any part of it ever derives from user input. Store `{ entityType, entityId }` and resolve the route client-side.

---

## 5. Estimation realism

The plan's self-assessment (34 days vs 25) is honest but still **substantially optimistic**, because it estimates only the coding of features it has enumerated, and it has enumerated less than the contract requires.

### [HIGH-24] Zero days are budgeted for design, and 11 UI primitives are budgeted at zero

**What's wrong.** There is no design step anywhere in the plan — no wireframes, no client design approval, no brand/colour/logo decision. `components/ui/` lists **eleven** hand-rolled primitives (button, input, select, badge, modal, table, tabs, toast, stepper, empty-state) with no time allocated; they're implicitly absorbed into P0 (2 days, already full) or the feature phases. A production-quality accessible `select`, `modal` (focus trap, escape, scroll lock) and `table` alone are a day.

**Fix.** Use **shadcn/ui** — it's Tailwind + Radix, copy-paste, no runtime dependency, matches the stack exactly, and gives accessible versions of all eleven. Saves ~2 days and buys most of the Lighthouse a11y ≥90 target for free. Add a half-day "design pass" in week 1 to agree colours/typography/logo with BK before 7 marketing pages get built.

### [HIGH-25] Per-sub-phase estimates, re-scored

| Sub-phase | Plan | Realistic | Why |
|---|---|---|---|
| P0 Foundations | 2 | **3** | npm workspaces + shared-package resolution across `tsx`/`vite`/`tsc` (MEDIUM-27), Tailwind v4 (new config model), ESLint flat config, a **custom lint rule**, migration runner, schema-parity harness. Any one of these eats half a day. |
| P1 Auth | 3 | **3.5** | +admin creation (HIGH-6), trust-proxy/rate-limit tuning, session rotation, `mustChangePassword` server enforcement. |
| P2 Candidate profile | 4 | **6** | The hardest UI in the app: 5-step wizard, autosave, skills autocomplete, experience CRUD + reorder, magic-byte upload, completion %, four status banners — **plus the edit-after-approval design (BLOCKER-7), which is unbudgeted.** |
| P3 Employer & jobs | 4 | **5** | +company profile page (HIGH-1), +edit-after-approval rules (BLOCKER-8), 4 serializer views. |
| P4 Admin approvals | 3 | **5** | Three queues × (list + filters + detail + 3 actions + reason modals), user admin, enquiries, stats, admin layout, resume viewer. Admin UI is always underestimated by ~50%; there are ~12 distinct screens here. |
| P5 Applications & pipeline | 4 | **7** | The biggest feature area in the product: browse + filters + pagination + FTS + apply + tracker/timeline + employer applicant list + stage validator + admin cross-job view. Four days is fantasy. |
| P6 Recommendations & interviews | 3 | **4** | +employer interview request (BLOCKER-3), +interview confirmation, +timezone handling. |
| P7 Notifications | 2 | **3** | 15+ events, correct recipients from the matrix, bell + dropdown + page + polling + deep links, and the per-row tests. |
| P8 Public website | 4 | **6** | **Seven** designed, responsive, accessible marketing pages with real copy, plus the public jobs listing, plus SEO. Marketing pages are slow because every one is bespoke. |
| P9 Hardening & QA | 3 | **5** | Write the *entire* test suite, IDOR sweep, cross-browser (5 targets), 3 docs, demo seed data, backup rehearsal. |
| P10 Deploy & go-live | 2 | **4** | Release structure, staging, CI, migration safety, cache headers, monitoring, log rotation, first-time nginx SPA + certbot, plus the near-certain OOM debugging session. |
| **Build subtotal** | **34** | **51.5** | |

### [HIGH-26] Entirely unestimated work

None of the following appears anywhere in the 34 days:

| Item | Days |
|---|---|
| Design pass, brand/logo/colours, client design approval | 1.0 |
| **Content gathering from BK** — founder bio, About copy, sector confirmation, WhatsApp number, admin emails, legal review of Privacy/Terms | 1.0 (+ calendar drag of 1–2 weeks) |
| Client review cycles and demos (3–4 × half a day) | 1.5 |
| **UAT and the client's bug list** — every project has one, and it is never short | 3.0 |
| Client-requested changes during the build ("can we also…") | 2.0 |
| Deployment troubleshooting beyond the happy path | 1.0 |
| Project management, calls, WhatsApp, invoicing, GST | 1.5 |
| **Subtotal** | **11.0** |

### Revised number

**~62 developer-days**, plus calendar drag from client dependencies (domain/DNS access, content, design sign-off, UAT turnaround) of a further **1–2 weeks**. Solo, that is **12–14 calendar weeks**, not 5. At ₹55,000 that is roughly **₹850–900 per working day**.

Two viable responses, and the plan should state one:
1. **Re-phase.** Negotiate Phase 1a (public site + candidate portal + admin candidate approval, ~5 weeks) and Phase 1b (employer portal + pipeline + interviews + notifications) at additional cost. This is honest and keeps the ₹55k for a deliverable that actually fits it.
2. **Cut hard and re-baseline to ~7–8 weeks** with the client's written agreement, applying the aggressive cut list below.

### [MEDIUM-25] The "Cut order" is a fig leaf

The four listed cuts (recommendation search filters, cross-job view, notes on jobs/employers, notification pagination) total **~1.5 days** against a **17–28 day** overrun. They are not a plan; they are a gesture.

**A real cut list, in order:** (1) shadcn/ui instead of hand-rolled primitives, −2d; (2) drop FTS5, `LIKE` on title, −0.75d; (3) drop `viewCount`, −0.25d; (4) drop `docs/API.md` and `SCHEMA.md`, keep RUNBOOK, −0.5d; (5) reduce the 7 marketing pages to 3 templates + a content-driven generic page, −1.5d; (6) drop admin cross-job application view, −0.5d; (7) drop per-step autosave, save-on-advance only, −0.5d; (8) drop the Lighthouse ≥90 gate, −0.5d; (9) drop admin notes on jobs/employers, −0.25d. **Total ~6.75 days.** Still not enough alone — which is the point.

---

## 6. Operational and business risks

### [HIGH-27] DigitalOcean and domain ownership is undecided, and it blocks go-live

**What's wrong.** T&C §9 says all hosting/domain costs "shall be borne directly by the client," and the Phased Plan says costs are "billed directly to BK Talent Acquisition for transparency." But nothing says **who creates the DO account, who holds the root credentials, who owns the registrar account, or who has DNS access.** P10 requires "DNS: `bktalentconnect.com` + `www` → droplet" — is the domain even registered?

**Why it matters.** If BK owns DO and hasn't given SSH access, deploy day slips. If Takai owns the DO account, Takai is fronting the cost, holds the client's data hostage in a way that conflicts with the IP-transfer clause (§7), and inherits an account they can never close. DNS propagation plus registrar-access hunting is a classic 2–3 day slip at exactly the moment there is no slack.

**Fix.** In week 1, in writing: **BK creates and owns the DO account and the domain**; Takai is added as a team member with a deploy user and SSH key; BK's payment method is on file. Verify DNS control (create a TXT record) in week 1, not week 5. Record it in the plan as a P0 client-dependency checkbox.

### [HIGH-28] "Go-live and handover" triggers 73% of the payment and is nowhere defined

**What's wrong.** T&C §2: ₹40,000 within 7 days of "go-live and handover." The plan has a "Definition of done for Phase 1" — a good one — that **BK has never seen or agreed to**. Nothing in the contract defines acceptance, sign-off, or what happens if BK says "it's not done yet."

**Why it matters.** 73% of the fee is at the mercy of an undefined milestone, for 10+ weeks of work, with an advance that covers ~1.5 weeks. T&C §2's "non-refundable" protects only the ₹15,000 already received.

**Fix.** Send BK the plan's "Definition of done" as a formal **Acceptance Criteria** annexe and get it acknowledged in writing before P0. Add: acceptance is deemed given if no written defect list is received within 7 days of the go-live walkthrough; defects are limited to deviations from the criteria; anything else is a change request. Also consider re-cutting the payment schedule to 30/40/30 with a milestone at "candidate + admin portals demonstrable" — the current structure has you funding the project.

### [HIGH-29] "Complimentary" support is unbounded

T&C §3 promises a year of "bug fixes, minor issues, and platform monitoring" with no hours cap, no response-time definition, no channel, and no distinction between a bug and a change request. AMC §4 then charges ₹9,900/year for what sounds like the same thing — so the client's rational read is that year one is the same service for free.

**Fix.** Before go-live, agree in writing: support channel (one email/WhatsApp thread), response window (e.g. 2 business days), what counts as a bug (deviation from the accepted criteria) vs a change request (quoted separately, per §6), and a soft cap (e.g. 2 hours/month, beyond which the ₹6,200/session rate applies). Also state that support covers the software, not BK's operational use of it (data entry, approvals, user management).

### [HIGH-30] Backup and restore responsibility is contradictory

T&C §5 disclaims all liability for data loss and "advises the client to maintain independent backups" — while §4 makes backups an **AMC deliverable from year two**, and the plan builds a nightly backup cron in year one. So in year one Takai runs backups they've disclaimed responsibility for. When the restore is needed, that distinction will not survive the conversation.

**Fix.** Define concretely and put it in the runbook and in an email to BK: **RPO = 24 hours** (nightly backup, so up to a day of applications can be lost), **RTO = 4 hours**, backups stored at `<named destination>`, restore performed by Takai on request during the support year, and BK receives a monthly backup-verification confirmation. Also: the off-site backup storage is a third-party cost not in the ~$7/month estimate — tell them (MEDIUM-27).

### [MEDIUM-26] The password-reset workaround has a real, recurring cost, and there is a cheaper fix

The plan's admin-reset flow means: user forgets password → WhatsApps BK → BK logs into admin → generates a temp password → **sends a plaintext credential over WhatsApp**. For ~500 candidates that's a weekly-or-more chore for a small firm, plus a standing credential-in-chat security problem.

**Fix — raise it as a scope conversation, don't absorb it silently.** Two options: (a) ~2 hours: instead of setting a password, the admin generates a **one-time reset link** (random token, 1h expiry, single use) that they paste to the user — no plaintext password ever travels, and the user sets their own. (b) ~0.5 day: `nodemailer` + Brevo/Zoho free SMTP tier (300 emails/day, ₹0) for **password reset only**. This is strictly less work than a year of manual resets and it is the single highest-ROI half-day in the project. Note it is technically Phase 2 scope ("email notifications") — so quote it as a small paid add-on or gift it explicitly, but do not let it be assumed.

### [MEDIUM-27] Running-cost estimates are inconsistent and omit real line items

Proposal p13: server $7 + domain $1 + Spaces $5 = ~$8/mo (arithmetic aside). Phased Plan p4: server $6 + domain $1 = ~$7/mo, with Spaces dropped. The plan defers Spaces entirely, so resumes and backups live on the droplet's 25GB. Missing from every estimate: off-droplet backup storage, and the eventual $12 droplet upgrade the PDFs themselves anticipate.

**Fix.** Give BK one corrected number: ~$6 droplet + ~$1 domain + ~$5 Spaces (for files **and** backups) = **~$12/month**, and note that the 1GB droplet is the floor, not the recommendation.

### [MEDIUM-28] IP transfer has no mechanism

T&C §7 transfers all source code and assets on final payment. The plan never decides where the repo lives, who owns the org, or what "assets" includes (the `.env`, the DO snapshot, the DNS records, the Let's Encrypt config, the design files). **Fix:** private GitHub repo under a Takai org during the build; on final payment, transfer the repo to a BK-owned org and hand over a sealed credentials document. Put the handover checklist in `docs/RUNBOOK.md`.

### [MEDIUM-29] DPDP roles are undefined and there is no processor agreement

BK is the Data Fiduciary; Takai is a Data Processor holding ~500 people's CVs, phone numbers and salary histories on a server Takai administers. The plan writes BK's public Privacy Policy and says nothing about Takai's own obligations, breach-notification duty, or personnel access. **Fix:** a one-page processor addendum covering purpose limitation, no onward transfer, breach notification within 72 hours, and deletion of Takai-held copies at contract end. Also: **no production data on a developer laptop** — use the seeded demo dataset (which P9 already builds) for all local work.

### [LOW-8] `content/site.ts` placeholder copy is a live-site risk

The plan's stated approach is "realistic placeholder copy in one editable content file." Realistic placeholder copy is the kind that ships to production unnoticed — a fake founder bio on a real About page. **Fix:** prefix every placeholder string with a `[TBC]` marker and add a build-time check that fails the production build if any `[TBC]` remains. Ten minutes; prevents an embarrassing incident.

---

## 7. Other architecture, schema and sequencing problems

### [HIGH-31] Missing indexes on the hottest queries

The plan's index list omits several that are on the critical path:

| Missing index | Query it serves |
|---|---|
| `application_stage_event(applicationId, createdAt)` | **The candidate's application timeline** — the plan's flagship candidate feature. Not in the list. |
| `job(employerProfileId, status)` | The employer's own job list — every employer page load. Not in the list. |
| `candidate_skill(skillId)` | Admin recommendation search by skill. Only the forward direction is implied. |
| `job_skill(jobId)` and `job_skill(skillId)` | Job detail render; skill-based search. |
| `candidate_experience(candidateProfileId, sortOrder)` | Every profile render. |
| `file_asset(ownerId)` | Authorisation check on every download. |
| `audit_log(entityType, entityId, createdAt)` | Any audit lookup during support. |
| `contact_enquiry(handledAt, createdAt)` | Admin enquiry queue. |
| `application(jobId, isRecommended, appliedAt)` | The pinned-recommended applicant list ordering (MEDIUM-13). |

Also: `(job.status, sectorId, city)` cannot serve `ORDER BY publishedAt DESC` — the public listing will filesort on every page. Either add `publishedAt` to the index or accept it and say so. P9's `EXPLAIN QUERY PLAN` check covers only two queries; extend it to all of the above.

### [HIGH-32] Missing uniqueness constraints

- `candidate_profile.userId` and `employer_profile.userId` — described as "one per User", no `UNIQUE` stated. Without it a bug creates two profiles and every `SELECT … LIMIT 1` silently picks one.
- `candidate_skill(candidateProfileId, skillId)` — no unique; duplicate skills on one profile.
- `job_skill(jobId, skillId)` — same.
- `user.email` — stated as unique in prose; must be `UNIQUE COLLATE NOCASE` in DDL (MEDIUM-15).
- `session.tokenHash` — stated unique ✅.
- `interview` — is more than one active interview per application allowed? Undefined; add a partial unique on `(applicationId)` where `status='SCHEDULED'`.

### [MEDIUM-30] Timestamp format will break lexical ordering

ISO-8601 TEXT sorts correctly **only if every writer uses an identical format**. JS `new Date().toISOString()` gives `2026-08-02T10:15:30.123Z`; SQLite's `datetime('now')` gives `2026-08-02 10:15:30` (space separator, no `Z`, no millis). Mixing them — which will happen the first time a DEFAULT is written in DDL — produces rows that sort wrongly and comparisons that silently fail. **Fix:** one rule — all timestamps written from JS via a single `nowIso()` helper; if a SQL default is needed, `DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))`. Add it to the schema-parity test's remit.

### [MEDIUM-31] Money as "INTEGER rupees" will collide with Indian salary conventions

Indian salaries are universally discussed in **LPA** (lakhs per annum). An admin or employer typing `12` into a salary field means ₹12,00,000, not ₹12. **Fix:** decide the storage unit (rupees is right) and make the input unambiguous — a LPA-labelled input that multiplies by 100000, or a rupee input with a live "₹12,00,000 (12 LPA)" echo. Put the conversion in one shared helper. This is exactly the kind of thing that ships wrong and is only noticed after 200 rows exist.

### [MEDIUM-32] `packages/shared` resolution across three runtimes is a real P0 hazard

The shared package must resolve under: Vite (browser bundle), `tsx`/`ts-node` (API dev), and the **built** API (`node dist/index.js`). Each has different resolution rules. The plan's P0 exit check — "a deliberate type error in `packages/shared` breaks the build in both apps" — proves the *type* graph and says nothing about **runtime** resolution in the compiled API, which is where this breaks (bare `@bktc/shared` import that Node can't resolve in `dist/`).

**Fix.** Decide now: either `packages/shared` is compiled to `dist/` with a proper `exports` map and consumed as a real workspace dependency, or the API bundles it (tsup/esbuild). Add a P0 exit check: "`node apps/api/dist/index.js` starts successfully **outside** the workspace root."

### [MEDIUM-33] `/api/health` doesn't check health

A health endpoint returning `{status:"ok"}` from a process that can't read its database is worse than none — it's what your uptime monitor (HIGH-4) will poll. **Fix:** `SELECT 1` against the DB, check `uploads/` is writable, return `503` on failure, and include the app version (HIGH-9).

### [MEDIUM-34] Education enums diverge between candidate and job and are treated as one concept

Proposal p3 candidate: Diploma / B.E. / B.Tech / M.Tech / MBA / PhD. Proposal p5 job: Diploma / B.E. / B.Tech / M.Tech / **Any** (no MBA, no PhD). The plan has `CandidateProfile.educationLevel` and `Job.educationRequirement` with no note that these are different enums with different members and an ordering relationship (`M.Tech satisfies B.Tech`). Phase 2 will need that ordering. **Fix:** two enums plus an explicit `satisfies()` ranking in `packages/shared`.

### [MEDIUM-35] No soft delete anywhere

No `deletedAt` on any table. Combined with `ON DELETE CASCADE` FKs, an accidental admin delete is unrecoverable except from last night's backup, and DPDP erasure (HIGH-5) has nowhere to land. **Fix:** `deletedAt TEXT` on `user`, `candidate_profile`, `employer_profile`, `job`, `file_asset`; hard-delete nothing in Phase 1; every repository read filters `deletedAt IS NULL`. Cheap now, impossible later.

### [MEDIUM-36] Sequencing: the public site is built last, and it has the longest client-dependency lead time

P8 (public website) is scheduled at days 25–29, after everything. It is also (a) the only part of the product the client can form an opinion about without training, and (b) the part that depends entirely on **content BK has to supply** — founder bio, About copy, brand, logo, WhatsApp number. Asking for that content in week 5 means it arrives in week 7.

**Fix.** Split P8: build the public shell, layout, header/footer and routing in **week 1** (half a day) purely to unblock the copy request and get the design signed off, then fill content late. Send BK the content checklist on day 1. Same argument for confirming the sector list (MEDIUM-1) and the resume-gating question (BLOCKER-1) — all week-1 emails with multi-week turnarounds.

### [LOW-9] Serializers written in P3 have no consumers until P5/P8

`job.serializer.ts` with all four audience views lands in P3, but `toCandidateView` and `toPublicView` have no callers until P5 and P8. They will be rewritten. Minor, but build the owner/admin views in P3 and defer the other two.

### [LOW-10] `AdminNote`'s polymorphic key can't have a FK

`entityType` + `entityId` means no referential integrity — notes orphan silently when the target is deleted, and there's no way to enumerate "all notes for things that still exist." Acceptable for Phase 1; document it and add the orphan cleanup to the same weekly cron as MEDIUM-11.

---

## Top 10 things to fix before writing any code

1. **Get BK to answer, in writing: can an employer see a candidate's resume before shortlisting?** (BLOCKER-1) The two contract documents contradict each other, the plan silently picks one, and the wrong choice is a rebuild of the employer portal. Same email should confirm the **sector list** (7 or 8? "Sales"? "Pharma" or "Pharmaceuticals"?) — it's the Phase 2 hard filter.
2. **Design the profile-edit-after-approval flow and the job-edit-after-approval rule.** (BLOCKER-7, BLOCKER-8) Today, an approved candidate can never change their phone number, and an employer can edit a live job into anything — including their own phone number, voiding the no-direct-contact rule the client's business depends on. Pick an option, budget it, write it in.
3. **Write the full stage-transition matrix** (`from × to × role`) into `packages/shared/stages.ts`. (BLOCKER-9) Include the hard calls: is `NOT_SELECTED` reversible, is regression allowed, can you leave `WITHDRAWN`, what happens after `OFFER_MADE`. Every notification, test, bucket and metric derives from this table.
4. **Fix the deployment story before you need it.** (BLOCKER-4, BLOCKER-5, BLOCKER-6) Specifically: swapfile + never build on the droplet + `npm ci` on target for the native `better-sqlite3` binding; `releases/` + `current` symlink for atomic deploy and instant rollback; a backup that covers **`uploads/` as well as the `.db`**, taken with `.backup` not `cp`; a backwards-compatible-migration rule. Add a free staging environment (second pm2 process + subdomain) — it costs nothing and it is the only place you'll ever rehearse a migration.
5. **Allowlist every sort and filter key that reaches SQL.** (BLOCKER-10) This is the only SQL-injection surface in a no-ORM codebase, and `?sort=expectedSalaryMin` leaks the exact private data the entire serializer layer exists to protect. Ten lines of code; it's the highest-value security fix here.
6. **Decide the ID strategy (ULID/UUIDv7 for user-facing entities) and the timestamp format, before migration 001.** (MEDIUM-22, MEDIUM-30) Neither is retrofittable, both are currently unspecified, and sequential integer IDs leak business volume to employers.
7. **Re-baseline the timeline with the client — and pick re-phasing or hard cuts.** (HIGH-25, HIGH-26) The honest number is **~62 developer-days**, not 34 and not 25. Send a re-phase proposal (1a: public + candidate + admin approval; 1b: employer + pipeline + notifications) or an agreed cut list. Raising this in week 1 is a negotiation; raising it in week 4 is an apology.
8. **Settle the commercial and ownership questions in week 1, in writing:** who owns the DigitalOcean account and the domain (recommend: BK owns both, Takai gets a deploy user); the plan's "Definition of done" formally accepted as the acceptance criteria for the ₹40,000 trigger; support scope, channel, response time and hours cap; backup RPO/RTO and who runs the restore. (HIGH-27, HIGH-28, HIGH-29, HIGH-30)
9. **Close the three privacy/legal gaps that the serializer layer does not touch:** candidate consent for admin recommendations (HIGH-15), a real data-deletion mechanism to back the published Privacy Policy (HIGH-5), and log/audit redaction so salaries don't sit in plaintext in `~/.pm2/logs` (HIGH-23). Add "grep production logs for a test candidate's salary" to the pre-launch privacy audit — the current audit only looks at DevTools and would pass while leaking.
10. **Bound every input and lock down the shared `Skill` table.** (HIGH-16) Add `.max()` to every zod schema, cap the JSON body, and make auto-created skills admin-approved with a merge tool — otherwise one authenticated account can permanently pollute the taxonomy that Phase 2's matching engine depends on, and the only cleanup is manual SQL.

---

### Two smaller things worth fixing immediately because they signal the document wasn't proofread against its own stack

- Line 145 states the core security rule as "no route handler ever returns a **Prisma** model directly." **There is no Prisma in this stack.** Rewrite it as an enforceable rule (branded row types + a lint rule banning bare `res.json`), not a copy-pasted convention.
- Lines 176 and P9 both rely on tests that "run in **CI**". **There is no CI in the plan.** Either add the GitHub Actions workflow (~2 hours) or stop claiming the schema-parity guard is enforced.

---

### Files relevant to this review

- `/Users/raghav/.claude/plans/this-folder-has-2-swirling-map.md` — the plan under review
- `/Users/raghav/Development/Two Pixel/bk_talent_connect/BK_TalentConnect_Proposal (1).pdf` — field tables (pp. 3–5), Kanban and pipeline rules (p. 6), admin dashboard (p. 7), notification matrix (p. 8)
- `/Users/raghav/Development/Two Pixel/bk_talent_connect/BK_TalentConnect_Phased_Plan.pdf` — Phase 1 scope (p. 1), Phase 2 exclusions (p. 2), payment terms (p. 3), T&C §§2–9 (pp. 5–6)
