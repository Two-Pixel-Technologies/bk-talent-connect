# Phase 1 Commitment Audit — BK Talent Connect

**Auditor:** independent PM review, commissioned by Takai Labs
**Date:** 2026-08-07
**Subject:** whether Phase 1 as sold to BK Talent Acquisition & Advisory has been delivered, and
whether "go-live and handover" — the trigger for ₹40,000 of a ₹55,000 contract — is defensible.
**Method:** full read of `BK_TalentConnect_Proposal (1).pdf` and `BK_TalentConnect_Phased_Plan.pdf`;
line-by-line trace of the implementing code; live probing of the running system at
`http://localhost:8080` as all three roles; load and edge testing against the demo database.

Findings are marked **CONFIRMED** (executed, or traced line by line) or **PLAUSIBLE** (reasoned,
not reproduced).

---

## Executive position

The portal that exists is, on the whole, well built. The privacy architecture is real rather than
decorative, the approval gates hold under direct attack, access control survived a full IDOR sweep,
and the code carries a standard of care well above what ₹55,000 normally buys. Two prior audits'
fixes were sampled and all held.

That is not the same as Phase 1 being delivered. Against the *Phased Delivery Plan*, which is the
contractual scope document:

| Phase 1 deliverable | State |
|---|---|
| 1. Public website — 7 pages + public jobs listing | **Not started** (P9) |
| 2. Candidate portal | Delivered, with defects below |
| 3. Employer portal | Delivered, with one significant onboarding defect |
| 4. Admin dashboard | Delivered in part — "manage the pipeline **per opening**" is not reachable |
| 5. In-portal notifications | Delivered |
| 6. Hosting & go-live | **Not started** (P10); nginx config has a reproduced header defect |

One of six deliverables is untouched, a second is not started, a third is partial. There is no
version of "go-live and handover" that is true today.

Beyond scope, four things would embarrass the client and must not reach BK's customers:

1. **Employers are handed candidates' LinkedIn URLs.** The single promise the whole business model
   rests on — "employers cannot reach candidates directly" — has an open door in it.
2. **A newly registered employer lands in BK's verification queue with an empty company profile,**
   is told to wait, and is given no way to complete it. Every employer's first experience is wrong.
3. **The privacy test suite is a random number generator.** It fails ~40% of runs on a substring
   grep against `'18'` and `'22'`. "322 tests pass" is not a fact.
4. **~70% of the Phase 1 codebase has never been committed to git.** P3–P8 and every QA fix exist
   only as working-tree changes.

---

## 1. Commitment-by-commitment trace

Legend: **D** delivered · **P** partial · **M** missing · **2** legitimately Phase 2 per the
Phased Plan.

### 1.1 Public pages (Proposal p2 · Phased Plan §1)

| Commitment | State | Evidence |
|---|---|---|
| Home page | **M** | `apps/web/src/router.tsx:48-140` — no route. `landing.tsx` is a placeholder that says so in the client's own front door: *"Public pages … are scheduled for P9"* (`landing.tsx:66`). CONFIRMED |
| For Candidates page | **M** | No route. CONFIRMED |
| For Employers page (incl. posting inquiry form) | **M** | No route; no enquiry-creation endpoint anywhere (see below). CONFIRMED |
| About Us page | **M** | No route. CONFIRMED |
| Contact page (email enquiry form, WhatsApp, LinkedIn) | **M** | `contact_enquiry` table, repo, admin list screen and `contactLimiter` all exist; **nothing creates an enquiry.** `grep -rn "enquiryRepo.create"` returns only the repo definition. The admin "Enquiries" nav item is permanently empty. CONFIRMED |
| Privacy Policy page | **M** | No route, no content, no link anywhere in the app. CONFIRMED |
| Terms of Use page | **M** | No route. CONFIRMED |
| Public Jobs listing, anonymous, filter by sector/city/experience, one-click Apply | **M** | `GET /api/candidate/jobs` returns **401** unauthenticated (executed). No public job endpoint exists. CONFIRMED |
| Persistent WhatsApp button on every page | **M** | `grep -rniE "wa\.me\|whatsapp\|mailto:\|tel:\|\+91" apps/web/src` → two comment mentions, **zero contact routes**. CONFIRMED |

**0 of 9.** This is Phased Plan deliverable #1 in full and it is acknowledged as not started.

### 1.2 Candidate workflow and profile fields (Proposal p3–p4)

| Field / capability | State | Evidence |
|---|---|---|
| Full name, email, mobile, city, state | **D** | `schemas/candidate.ts:55-96`; wizard step 1 `profile-wizard.tsx:391-478` |
| Open to relocation | **D** | `profile-wizard.tsx:462` |
| Current job title / current employer / years of experience | **D** | `profile-wizard.tsx:484-503` |
| Sector (single select, required) | **D** | 29 sectors served from `GET /api/taxonomy` (executed) |
| Skills, min 3 tags | **D** | `LIMITS.candidate.skills.min = 3`; enforced in `submitProfileSchema:127` |
| Education level (Diploma/BE/BTech/MTech/MBA/PhD) | **D** | `EDUCATION_LEVELS`; DB CHECK constraint in `002_profiles.sql` |
| Qualification + year | **D** | `profile-wizard.tsx:531-542` |
| Previous roles: company · title · years · **domain tags** | **D** | `profile-wizard.tsx:631-651` (a prior audit fix; verified present) |
| Key achievement per role | **D** | `profile-wizard.tsx:619` |
| Career summary, min 150 chars | **D** | `LIMITS.candidate.careerSummary.min = 150` |
| Notice period (Immediate/15/30/60/90) | **D** | `NOTICE_PERIODS` |
| Current CTC, expected min, expected max — **private, admin only** | **D** | `candidate.serializer.ts:131-134` — `toEmployerView` returns `commonFields` only, which carries no salary. Verified against the raw employer payload (executed). |
| Employment preference | **D** | `profile-wizard.tsx:703` |
| Resume PDF/DOCX, stored securely | **D** | `file.routes.ts` — attachment-only, nosniff, sandbox CSP, magic-byte verified. 5 MB cap enforced (executed: 5 MB → 413, 6 MB → 413, renamed `.exe` → 415). |
| LinkedIn URL, optional | **D** *(but see §5.1 — it leaks to employers)* | `profile-wizard.tsx:713` |
| Candidate sees **no jobs** until approved | **D** | Executed: DRAFT, SUBMITTED and CHANGES_REQUESTED candidates all get **403**, not an empty list |
| Pipeline shown as Applied → Under Review → Shortlisted → Interview → Decision | **D** | `CANDIDATE_STAGE_LABEL` + `CANDIDATE_TIMELINE_STEPS` use the contract's exact five words |
| One-click apply, profile = CV | **P** | Apply lives on the job **detail** page, not the card. Proposal p2 specifies "a one-click Apply button" on each card. Two taps, not one. |
| "Notified at every stage" | **D** (portal) / **2** (email, WhatsApp) | See §1.5 |
| Filter jobs by sector, city **and experience** | **P** | `browse-jobs.tsx:63` — filter state is `{sector, function, city, search}`. The API accepts `minExperience`; **no UI exposes it.** CONFIRMED |

### 1.3 Employer workflow (Proposal p5–p6)

| Commitment | State | Evidence |
|---|---|---|
| Company name, industry sector, locations, website, HR contact, LinkedIn page, company introduction | **D** (fields exist) / **P** (never collected at the right time — see §3.1) | `company-profile.tsx`; `schemas/job.ts:12-30` |
| Admin approves account before any posting | **D** | Executed: unverified employer POST `/api/employer/jobs` → **403** *"Your company is still being verified."* |
| Job fields: title, department, positions, sector, city, work type, required skills (min 3), good-to-have, min/max experience, education requirement, description (min 100 words), target joining date | **D** | `schemas/job.ts:97-184`; `job-editor.tsx:268-395` |
| Salary band min/max — **never shown to candidates** | **D** | `job.serializer.ts` `toCandidateView` omits the band. Verified against the raw candidate payload (executed). `?sort=salary_band_min` → **400**. |
| Kanban board per role | **2** | Phased Plan §Phase 2 #4. Delivered as a bucket-filtered list — the correct Phase 1 substitute. |
| Four buckets NEW / REVIEWING / INTERVIEW / DECISION | **D** | `EMPLOYER_BUCKET_OF` in `stages.ts:275` |
| Recommended candidates pinned top with "Recommended by Us" badge | **D** | Executed at 224 applicants: 11 recommended rows all on page 1. Pinning is in SQL (`idx_application_job` orders `is_recommended DESC`). |
| No AI scores shown to employers | **D** | No scores exist (Phase 2) |
| Employer can view profiles and resume | **D** | `resume_file_id_at_apply` snapshot; verified the download route authorises on (approved candidate ∧ application to a job you own) |
| Employer can request an interview, cannot book one | **D** | Executed: employer POST stage `INTERVIEW_SCHEDULED` → **403** with correct copy |
| Employer marks Offer Made / Not Selected | **D** | `EMPLOYER_STAGES` in `employer-applicants.routes.ts:42` |
| Admin notified on every employer pipeline action | **D** | `EMPLOYER_PIPELINE_ACTION` in `notifications.ts:127` |
| **All candidate contact routed through admins** | **P — breached** | See §5.1. LinkedIn URL is served to employers. CONFIRMED |
| Applicant list "sortable by status" (Phased Plan §3) | **P** | Bucket tabs filter; there is **no sort control at all**. `APPLICANT_SORTS` (`applied`/`stage`/`name`/`experience`) exists server-side and no screen sends `sort=`. CONFIRMED |
| Reminder 24 hrs before interview | **2** | Channels are email + WhatsApp only; correctly deferred, but BK must be told rather than left to assume |

### 1.4 Admin dashboard (Proposal p7 · Phased Plan §4)

| Commitment | State | Evidence |
|---|---|---|
| Approve/reject candidate profiles | **D** | Three-queue UI with optimistic concurrency (`expectedStatus` required by the API, not just the form) |
| Approve/reject employer accounts | **P** | Works, but **no completeness guard** — see §3.1 |
| Approve/reject job postings before going live | **D** | `reviewJob` sets `published_at` only on APPROVE |
| Recommend: pin candidate to job with badge | **D** | `/admin/jobs/:id/recommend`, gated on recorded DPDP consent |
| Recommend: pin job to candidate, top of feed | **M** | Only candidate→job exists. `recommendation.service.ts` has no reverse direction; the candidate feed has no pinned section. CONFIRMED |
| Full AI scores, admin-only | **2** | |
| **360° Candidate** — all applications, rejection patterns, salary vs budgets | **P** | `GET /api/admin/candidates/:id` returns the profile plus an **audit log**, not the person's applications. Rejection-pattern view does not exist. Salary-vs-band exists but only on the pipeline card. CONFIRMED |
| **360° Job Opening** — all applicants, full pipeline status, notes, recommendations | **M** | No admin per-job applicant view. `GET /api/admin/applications` accepts `jobId`; **no screen ever sends it**, and the job queue's only outbound link is "Find candidates to put forward" (`job-queue.tsx:245`). CONFIRMED |
| **Manage the applicant pipeline per opening** (Phased Plan §4, verbatim) | **M** | Same as above. This is a Phase 1 contract line, not a Proposal aspiration. CONFIRMED |
| Coordinate interviews between both parties | **D** | `/admin/coordination` — genuinely good, but omits the job and the company (see §3.2) |
| Metrics dashboard | **2** | Beyond the four simple counts, deferred by the Phased Plan |
| Simple stats: candidates, employers, open jobs, applications | **D** | `GET /api/admin/stats` (executed) |

### 1.5 Notifications — Proposal p8 matrix, row by row

Channels: email and WhatsApp are Phase 2 by the Phased Plan. Portal-bell delivery only is assessed.

| p8 row | Candidate | Employer | Admin | Implemented | Evidence |
|---|---|---|---|---|---|
| Candidate registers | ✓ Welcome | – | ✓ Alert | **D** | `CANDIDATE_REGISTERED` → `['CANDIDATE','ADMIN']` |
| Profile approved by admin | ✓ | – | – | **D** | `CANDIDATE_PROFILE_APPROVED` → `['CANDIDATE']` |
| Profile needs changes | ✓ Reason | – | – | **D** | carries `reviewNote` verbatim |
| Employer account approved | – | ✓ | – | **D** | |
| New application submitted | ✓ Confirm | – | ✓ Alert | **D** | employer correctly **not** notified (p8 marks "–") |
| Candidate shortlisted | ✓ | ✓ | – | **D** | verified live on both bells |
| Interview confirmed | ✓ Details | ✓ Details | – | **D** | identical IST string both sides |
| Interview reminder (24 hrs) | ✓ | ✓ | – | **2** | email/WhatsApp only |
| Offer made | ✓ Call | – | ✓ Alert | **D** | |
| Candidate not selected | ✓ **Note** | – | ✓ Alert | **P** | Fires, but the body is fixed copy — *"is not being taken forward"* (`notification-events.ts:282`). There is **no field anywhere** for BK to attach a candidate-facing note. The employer's note is deliberately (and correctly) withheld; nothing replaced it. CONFIRMED |
| Job posting submitted | – | ✓ Pending | ✓ Action | **D** | |
| Job posting approved & live | – | ✓ | – | **D** | |
| Job posting sent back | – | ✓ Comments | – | **D** | |

12 of 13 rows delivered; 1 partial; 1 correctly deferred. This is the best-executed part of the
build. Note the `/status` board claims *"All 15 matrix rows"* — the p8 matrix has 13 rows; the file
has 15 events because two are additions justified elsewhere in the Proposal. Harmless, but the
claim as worded is not checkable against the contract.

### 1.6 Correctly deferred to Phase 2

AI matching engine and all scoring · semantic skill matching · career-summary vectors · email
(SES) · WhatsApp (Meta Business API) · full metrics dashboard · Kanban drag-and-drop · AI pre-fill.
All are named in Phase 2 of the Phased Plan. No dispute.

---

## 2. Delivered, but not good enough to hand over

### 2.1 Replacing your CV silently un-approves you, with no warning — CONFIRMED

`candidate.routes.ts:102` — the resume upload route ends with
`service.updateProfile(auth.id, {}, ['resume'])`, and `resume` is in `MATERIAL_FIELDS`
(`schemas/candidate.ts:158`). So uploading a CV sends an APPROVED profile straight back to
SUBMITTED.

The wizard's material-change confirmation (`profile-wizard.tsx:149-152`) is computed from
`diffProfile(draft, profile)`. The upload runs through a **separate mutation**
(`useUploadResume`, `use-profile.ts:108`) that never touches that draft. The dialog cannot fire.

Reproduced: Anita Desai was `APPROVED`; I uploaded a file to `/api/candidate/resume`; she is now
`SUBMITTED`. No warning, no undo. Consequences she was not told about:

- job browsing stops (`/api/candidate/jobs` → 403);
- every employer with an in-flight application sees her badged "With our team" and **loses the CV**
  (`resumeFileId` is nulled when `candidateAvailable` is false, `application.serializer.ts:143`).

The file's own header comment says material edits are flagged *"BEFORE saving, because the
consequence … is not something to discover afterwards."* The most likely material edit a candidate
will ever make is exempt from that rule. **Fix: 2h.**

### 2.2 A candidate is told the company, then it is taken away — CONFIRMED

`IDENTITY_REVEALED_FROM` (`candidate-jobs.routes.ts:59-67`) omits `NOT_SELECTED`. A candidate who
reaches Shortlisted sees "Kirloskar Systems", is later turned down, and their tracker reverts to
*"Company revealed at shortlist"* (`applications.tsx:110`) — a sentence that is now false about a
company they already know. `GET /applications/:id/company` returns 403.

Executed: Anita's application shows `employerName: null` at `NOT_SELECTED` after passing through
`SHORTLISTED`. Retroactively redacting information the user already holds reads as a bug, not a
privacy control. **Fix: 1h.**

### 2.3 Nobody can contact BK — CONFIRMED

Five screens instruct the user to contact the team:

- `portal-home.tsx:77` — rejected candidate
- `profile-wizard.tsx:348` — rejected profile
- `job-editor.tsx:485` — rejected posting
- `browse-jobs.tsx:49` — gate message
- `login.tsx:72` — *"Forgotten your password? Contact BK Talent Connect and the team will reset it"*

`grep -rniE "wa\.me|whatsapp|mailto:|tel:|@bktalentconnect|\+91" apps/web/src` returns **no contact
route in the entire application**. There is no footer. The Proposal makes a persistent WhatsApp
button a feature of every page. A candidate locked out of their account today has no path back in.
**Fix: 3h** (footer with phone/email/WhatsApp, plus the same block on the login page).

### 2.4 Internal enum names shown to end users — CONFIRMED

Executed as a candidate: `POST /api/candidate/applications/:id/withdraw` on a rejected application
returns

```
{"error":{"code":"VALIDATION_FAILED","message":"NOT_SELECTED cannot move to WITHDRAWN."}}
```

`canTransition` reason strings (`stages.ts:175-178`) are surfaced verbatim. The entire point of
`CANDIDATE_STAGE_LABEL` is to keep the eleven-value enum away from candidates; the error path walks
straight past it. Zod enum errors do the same:
`"Invalid enum value. Expected 'IMMEDIATE' | 'D15' | 'D30' … received 'THIRTY_DAYS'"` is rendered
into the wizard's error list by `profile-wizard.tsx:223-232`. **Fix: 3h.**

### 2.5 The employer's applicant list does not scale — CONFIRMED at 224 applicants

I loaded 224 applications onto one posting. Server performance is fine (7 ms for page 1, 9 ms for
`pageSize=100`; the indexes are correct). The screen is not:

- no sort control, though four sort keys exist server-side;
- no search by name;
- pagination is Previous/Next only (`pagination.tsx`) — reaching page 12 is eleven taps;
- the bucket tabs cover six stages; `INTERVIEWED`, `OFFER_ACCEPTED`, `OFFER_DECLINED` and `JOINED`
  have no tab and are findable only under "Everyone".

For BK's own clients — industrial firms running walk-in drives — 200 applicants on one role is a
Tuesday. **Fix: 6h.**

### 2.6 The admin pipeline is not usable as a daily screen — CONFIRMED

`pipeline.tsx` offers a stage filter and pagination. It has no search, **no filter by job or
employer** (the API supports `jobId`; no screen sends it), and no link from a pipeline card to the
candidate's profile or CV — the admin has `candidateProfileId` in hand and does not use it. To read
the CV of someone they are about to put in front of an employer, the admin leaves the screen, opens
the Candidates queue and searches by name. **Fix: 5h.**

### 2.7 The candidate cannot see which CV they uploaded — CONFIRMED

`toSelfView` (`candidate.serializer.ts:105`) exposes `hasResume` and nothing else — no filename, no
`resumeFileId`. The wizard renders a green "CV uploaded" badge (`profile-wizard.tsx:756`). There is
no way to see *which* file, download it back, or remove it. A candidate who uploads the wrong
document cannot find out. Meanwhile the admin view carries `resumeFileName`. **Fix: 2h.**

### 2.8 "See build progress →" 404s in production — CONFIRMED

`router.tsx:64-69` excludes `/status` and `/system` from the bundle unless `import.meta.env.DEV`.
`landing.tsx:68` links to `/status` unconditionally. Verified against the built bundle: the string
`"See build progress"` is present in `apps/web/dist/assets/index-*.js`; the build-status content
(`"Portal hardening"`) is not. The client's front door carries a dead link, under a paragraph of
internal jargon (*"scheduled for P9"*) aimed at nobody in BK's audience. **Fix: 15m.**

---

## 3. Incomplete features and cross-role joins

### 3.1 Every employer's first experience is wrong — CONFIRMED end to end

Registration collects **four** fields — company name, contact name, work email, phone
(`register-employer.tsx:49-67`). `employerRepo.create` then hardcodes
`account_status = 'SUBMITTED'` (`employer.repo.ts:37`).

So a new company lands in BK's verification queue with no sector, no hiring locations and no
company introduction — the three things `submitEmployerProfileSchema` declares mandatory *"before
BK can verify it"* (`schemas/job.ts:41-54`). That schema is only reachable via
`POST /employer/profile/submit`, which a registering employer never calls.

The UI then closes the loop:

- `EmployerHome` (`portal-home.tsx:139`) tells them *"Your account is awaiting verification … We
  will be in touch shortly"* — i.e. wait.
- `company-profile.tsx:132` renders the "Send for verification" call to action **only for `DRAFT`
  or `CHANGES_REQUESTED`**. A `SUBMITTED` employer never sees it.
- `admin.service.ts:120` `reviewEmployer` has **no completeness check**.

Executed, end to end: I reduced an employer profile to its registration shape (null sector, no
locations, null intro), approved it as admin — **204** — and then created a job posting from that
account — **201**. A verified company with no introduction can go live; a shortlisted candidate
would see a company page with nothing on it, which is the one thing the introduction exists for
(Proposal p5: *"Shown to candidates on the company profile page"*).

The `/status` board's claim *"Employers must complete a profile before verification"* is not true
of the path every real employer takes. **Fix: 4h** (register as `DRAFT`; show the completion CTA on
`SUBMITTED` too; guard `reviewEmployer` on completeness).

*(State restored after testing.)*

### 3.2 Interview coordination does not say which job — CONFIRMED

`GET /api/admin/coordination` (`admin-coordination.routes.ts:122-157`) returns `candidateName` and
`applicationId` for both lists and **no `jobTitle`, no `employerName`**. BK's interview screen —
the operational heart of a managed portal — tells them *who* but not *what role at which company*.
With more than one open request they cannot act without leaving the screen. **Fix: 2h.**

### 3.3 The erasure screen cannot honour the promise made to the user — CONFIRMED

`privacy.tsx:104` promises the candidate: *"if you are mid-process with an employer we will tell
you rather than pulling you out of it without warning."*

The admin's erasure card (`erasure.tsx:146-163`) shows email, role, date and the user's reason. It
carries **no pipeline context at all**. The admin has no way to know whether the person has an
interview booked for Thursday. Erasure is immediate and irreversible — I executed one and confirmed
every personal column is overwritten, sessions dropped, notifications deleted and the session
401s on the next request. Correct behaviour; wrong information at the decision point. **Fix: 3h.**

### 3.4 The company page a shortlisted candidate sees has no locations — CONFIRMED

`candidate-jobs.routes.ts:239` passes `locations: []` as a hardcoded literal into
`toCandidateEmployerView`. Verified live: a shortlisted candidate's company payload returns
`"locations": []` for an employer whose stored locations are `["pune","ahmedabad"]`. The employer is
required to enter hiring locations before verification and no candidate ever sees them. **Fix: 30m.**

### 3.5 The contact-enquiry feature has a consumer and no producer — CONFIRMED

`contact_enquiry` table, `enquiry.repo.ts` with `create()`, `GET /api/admin/enquiries`, a
`markHandled` route, an admin nav item, a dashboard alert card, and `contactLimiter` — all shipped.
Nothing calls `enquiryRepo.create`. Until P9 the Enquiries screen is a permanently empty nav item
in front of BK every day. Not a bug; a sequencing decision that should be hidden until P9 lands.

### 3.6 Password reset is a manual, out-of-band process — CONFIRMED

There is no `/forgot-password`. `login.tsx:68` states the position honestly. Recovery is
`POST /api/admin/users/:id/reset-password`, which returns a temporary password to the admin's
screen. That admin must then read it to the user over a channel the product does not provide (§2.3).
Defensible for Phase 1 given email is Phase 2 — but it is a support-cost commitment BK has not been
quoted for, and it must be written down before the free support year starts.

### 3.7 Known-open items on the developer's own board

`build-status.ts:254-258` lists three. All still true: no unsaved-changes guard (navigating away
from the wizard mid-form loses everything — on a phone this will happen constantly);
`completionPercent` is stored rather than derived; employer stage transitions are hardcoded in
`applicants.tsx:211-224` rather than read from `availableStages`. The hardcoded table currently
matches the shared matrix exactly — I checked all four branches — so this is drift risk, not a bug.

---

## 4. UI/UX work required before go-live

Prioritised by "will this generate a support ticket or make BK look unprofessional to their own
clients". Estimates are implementation plus test.

| # | Item | Why it matters | Hours |
|---|---|---|---|
| 1 | Contact details in a footer + on the login page (§2.3) | Five screens tell users to contact a team they cannot reach. Every one is a support failure with no channel. | 3 |
| 2 | Warn before a CV replacement re-queues the profile (§2.1) | Silent loss of job access and of the employer's CV, mid-pipeline. | 2 |
| 3 | Fix the employer registration → verification path (§3.1) | Every employer's first experience; every verification queue entry is unreviewable. | 4 |
| 4 | Job + company on the interview coordination screen (§3.2) | BK cannot do their core job from their core screen. | 2 |
| 5 | Sort, search and page-jump on the employer applicant list (§2.5) | 200 applicants is normal for these sectors. | 6 |
| 6 | Job filter, candidate search and profile/CV links on the admin pipeline (§2.6) | BK's daily screen; also closes the "manage the pipeline per opening" contract gap. | 5 |
| 7 | Translate transition and enum errors into user language (§2.4) | `NOT_SELECTED cannot move to WITHDRAWN` in front of a candidate. | 3 |
| 8 | Pipeline context on the erasure card (§3.3) | The privacy page promises it in writing. | 3 |
| 9 | Show CV filename + download-back in the wizard (§2.7) | Candidates cannot verify what employers will read. | 2 |
| 10 | Keep the company name visible after a rejection (§2.2) | Retroactive redaction reads as data loss. | 1 |
| 11 | Unsaved-changes guard on the wizard and the job editor | Mobile users lose long-form text. | 3 |
| 12 | Experience filter on job browse (Phased Plan §1) | Named in the contract; the API already supports it. | 1 |
| 13 | Remove the internal `/status` link and P9 jargon from the landing page (§2.8) | Dead link + internal language on the client's front door. | 0.25 |
| 14 | Surface `locations` on the candidate-facing company page (§3.4) | A required employer field nobody sees. | 0.5 |
| 15 | Hide the Enquiries nav item until P9 (§3.5) | Permanently empty screen in the admin's main navigation. | 0.5 |
| | **Total** | | **~36h** |

---

## 5. Security and privacy

### 5.1 CRITICAL — employers receive candidates' LinkedIn URLs — CONFIRMED

The Proposal's central rule, stated three times:

> *"All candidate contact is routed through admins — employers cannot reach candidates directly."* (p6)
> *"Limitations on direct employer-candidate contact outside the platform."* (p2, Terms of Use)

`candidate.serializer.ts:96` places `linkedinUrl` in `commonFields()`, and
`toEmployerView` (line 131-134) returns `commonFields` unchanged. Every employer therefore receives
it, **from the APPLIED stage onward** — before any shortlist, for anyone who applies.

Reproduced:

```
PATCH /api/candidate/profile {"linkedinUrl":"https://www.linkedin.com/in/anita-desai-99"}
GET  /api/employer/jobs/<job>/applications   (as the employer)
→ Anita Desai | linkedin= https://www.linkedin.com/in/anita-desai-99 | stage= NOT_SELECTED
```

Why this is not a nitpick:

- A LinkedIn profile is a working direct-message channel. Combined with full name, current employer
  and city — all correctly exposed — the employer can complete a hire without BK. **That is the
  client's fee.**
- The developer applied exactly this reasoning to the *employer's* `website` and `linkedinUrl`,
  making both material fields specifically because *"both can carry a direct contact route —*
  `https://wa.me/91…` *is a valid URL"* (`schemas/job.ts:63-80`). The symmetric candidate case was
  missed.
- `linkedinUrl` is a **non-material** field (`schemas/candidate.ts:169`), so an approved candidate
  can change it at any time with no re-review. `webUrlSchema` allows any http(s) host — a candidate
  can put `https://wa.me/91…` in the LinkedIn field and it reaches employers unreviewed.
- The privacy suite does not test for it. `SALARY_FINGERPRINTS` covers salary, email and mobile
  only; nothing checks contact vectors.
- `privacy.tsx:66` tells candidates in writing: *"Employers never see your email address, your
  mobile number, or anything about your salary."* That statement is on the record and materially
  incomplete.

**Fix: withhold `linkedinUrl` from `toEmployerView`; add it to the privacy suite's banned keys;
make it a material field. 2h.**

### 5.2 No privacy notice exists, yet consent is collected — CONFIRMED

`register-candidate.tsx:69-84` collects a `required` consent checkbox — *"I consent to BK Talent
Connect sharing my profile and CV with relevant employers on my behalf, including roles I have not
applied to directly"* — and there is **no Privacy Policy, no Terms of Use and no link to either
anywhere in the application** (P9).

Under the DPDP Act 2023 §5, notice must accompany or precede consent. Today a candidate hands over
their CV, mobile, current salary and salary expectations having been shown no notice at all. This
is a hard go-live blocker independent of the marketing site.

Two further points, marked **PLAUSIBLE** because they are legal opinions and BK should take their
own advice:

- The checkbox is `required` — an account cannot be created without consenting to being put in
  front of employers the candidate never chose. DPDP §6(1) requires free consent, and §7 limits
  processing to what the service needs. Bundling a discretionary sharing consent into account
  creation is the pattern regulators dislike.
- There is **no way to withdraw consent** short of requesting full erasure and waiting for BK to
  approve it (`grep -rni "withdraw.*consent"` → nothing). DPDP §6(4)–(6) requires withdrawal to be
  as easy as giving it.

Also absent, and required once the Privacy Policy page exists: a named grievance-redressal contact
(DPDP §13) and a data-access/export route (§11). The erasure right is implemented well; the access
right is not implemented at all.

### 5.3 Production nginx drops four security headers — CONFIRMED by reproduction

`deploy/nginx.conf` sets HSTS, `X-Content-Type-Options`, `Referrer-Policy` and `X-Frame-Options` at
server level (lines 65-68, all with `always`), then declares `add_header` inside
`location /assets/` (85), `location = /index.html` (93) and `location /` (117). nginx inherits
`add_header` from the parent level **only if the current level declares none**. `always` does not
change that.

I reproduced it with a minimal nginx of the same shape:

```
GET /            → Cache-Control, Content-Security-Policy.   No HSTS. No X-Frame-Options. No nosniff.
GET /assets/a.js → Cache-Control only.                       No HSTS. No nosniff. No CSP.
```

In production this means the HTML document and every JS/CSS asset ship with **no HSTS, no
X-Frame-Options and no nosniff**. HSTS survives only on `/api/` responses, so a first-time visitor
on `http://` is never upgraded. P10's own exit criterion is "SSL Labs A"; this is the thing that
will fail it. `deploy/nginx.staging.conf` has the identical defect, and additionally loses its
`X-Robots-Tag: noindex` on the HTML — mitigated there by site-wide basic auth, but the fix is the
same. **Fix: move the four headers into each location block, or set them once via a shared
`include`. 1h.**

### 5.4 Registration rate limit will lock out real candidates in India — CONFIRMED

`rate-limit.ts:66-71` — `registerLimiter` is **10 per IP per hour**. The file's own header explains
at length why the *login* limiter is keyed on email rather than IP:

> *"India's mobile networks use CGNAT heavily, so thousands of legitimate users share an egress
> address — a 5-per-IP limit would lock out real candidates on a shared connection."*

That reasoning was never applied to registration. On Jio or Airtel CGNAT, or from a single factory
or college during a recruitment drive — precisely BK's market — the 11th genuine registration in an
hour gets *"Too many attempts."* I hit this within seconds during load testing: 200 consecutive
registration attempts returned 429.

`loginByIpLimiter` at 30/15 min per IP carries a milder version of the same risk.

Note also that the store is `express-rate-limit`'s in-memory default, so the counter resets on every
deploy or pm2 restart. **Fix: raise the registration ceiling substantially and add a
per-email/per-mobile bound; consider a captcha instead. 2h.**

### 5.5 What held up

Verified by execution, not assumption:

- **Full IDOR sweep, 17 probes, no failures.** Unauthenticated → 401. Wrong role → 403. Cross-tenant
  employer → 403 (not 404). Cross-candidate application → 403. Another candidate's CV → 403. An
  employer requesting a CV belonging to a candidate with no application to their job → 403. Admin →
  200. Owner → 200.
- **CSRF.** Missing `X-Requested-With` → 403. Cross-origin `Origin` header → 403.
- **X-Forwarded-For spoofing rejected** — `trust proxy = 1` correctly resolves to the real client;
  two forged XFF values did not reset the register limiter.
- **Salary compartmentalisation.** Candidate expectations absent from every employer payload; job
  band absent from every candidate payload; `?sort=expectedSalaryMin` and `?sort=salary_band_min`
  both 400 via allowlist.
- **File handling.** 5 MB → 413, 6 MB → 413, `MZ`-header file named `.pdf` → 415. Downloads are
  `Content-Disposition: attachment` with `nosniff`, `default-src 'none'; sandbox` and an RFC 5987
  encoded filename.
- **DPDP erasure.** Executed: name overwritten, mobile blanked, summary, salary and LinkedIn nulled,
  email replaced with `erased-<id>@erased.invalid`, user suspended and soft-deleted, all sessions
  dropped, all notifications deleted, existing session 401s on the next request.
- **Prior audit fixes sampled and holding**: `javascript:` URL → 400; LIKE wildcards escaped
  (`search=%` → 0 results, `search=Priya` → 1); employer profile save keeps `APPROVED`;
  private notes → 403 for employers; withdraw→re-apply escape from `NOT_SELECTED` → 400;
  suspend/reactivate/reset-password UI present.
- **No XSS sinks.** `dangerouslySetInnerHTML`, `innerHTML` and `eval` do not appear in the web app.
  A stored `<img src=x onerror=…>` job title round-trips as inert text.

### 5.6 Staging holds a nightly copy of production personal data — PLAUSIBLE risk, CONFIRMED design

`deploy/ecosystem.config.cjs` and `nginx.staging.conf` describe a staging instance on the same
droplet whose database is *"restored nightly from production's backup"* — every candidate's CV,
mobile number and salary, behind one shared HTTP basic-auth password. Two consequences BK must
accept in writing: an erasure executed in production does not reach staging until the next restore,
and a failed restore cron leaves erased personal data in staging indefinitely. Under DPDP this is a
processing decision, not an implementation detail.

---

## 6. Stress and edge behaviour

All executed against the running system.

| Scenario | Result |
|---|---|
| **224 applications on one posting** | List page 1: **7 ms**, 27 KB. `pageSize=100`: **9 ms**, 131 KB. Page 12: **2 ms**. Indexes (`idx_application_job`, `idx_application_job_stage`) are correct. Recommended rows pinned to page 1 as promised. **Server: fine. Screen: not (§2.5).** |
| **Closing that posting** | `close-impact` reported 224 affected; the close itself took **36 ms** for 224 stage changes, 224 stage events and 224 notifications in one transaction. Admin fan-out correctly suppressed (`omitAdminFanOut`) — one summary notification, not 224. Good. |
| **10 concurrent applies, same candidate, same job** | 1 × **201**, 9 × **409**. Exactly one application row and one stage event in the database. The unique constraint holds under race. |
| **Apply to a closed posting** | 10/10 **409** *"That role is no longer accepting applications."* |
| **Exactly 5 MB CV / 6 MB CV** | Both **413** with the user-facing message *"That file is over 5MB."* (Minor: an exactly-5 MB file is rejected by a message that says "over"; multipart overhead crosses the cap.) |
| **Windows executable renamed `.pdf`** | **415**, magic-byte check. |
| **4-byte `PK`-header file named `.docx`** | Accepted. DOCX is a ZIP so this is inherent to magic-byte checking; harmless given attachment-only serving. |
| **Unicode name with emoji** — `राघव मुखर्जी-ओ'ब्रायन 🚀` | Registered, stored and rendered correctly. Erased correctly. |
| **2,000 Devanagari characters in the career summary** | 200. Length bound counts code points, not bytes. |
| **XSS payload as a job title** | Stored, returned as literal text, React-escaped on render. No sink exists. |
| **`<script>` submitted as a skill name** | Accepted into the shared skill taxonomy as `PENDING` with slug `script`. Inert, but it sits in the admin's skills queue. Non-Latin skill names round-trip; `P&ID` and `PID` keep distinct slugs (`p-and-id` vs `pid`) as claimed. |
| **200 registrations from one IP** | Blocked at 10/hour — see §5.4. |
| **Forged `X-Forwarded-For`** | Correctly ignored; the limiter did not reset. |
| **Empty states** | Every list has an `EmptyState` with a title, an explanation and often a call to action. A DRAFT candidate, an unverified employer and an empty pipeline all render sensibly. This is well done. |
| **Failed queries** | `QueryState` gives every query-backed page a real error state with a retry. The admin dashboard specifically avoids reporting "Nothing is waiting for review" when the stats call failed. |

### 6.1 The test suite is not deterministic — CONFIRMED

`npm test` was run **eleven times** on an unmodified checkout (lint, typecheck and build were clean
and stable throughout):

| Run | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 |
|---|---|---|---|---|---|---|---|---|---|---|---|
| Failing tests | 11 | 2 | 0 | 0 | 1 | 0 | 0 | 1 | 0 | 1 | 0 |

**5 of 11 runs failed (~45%).** The claim "322 backend tests pass" describes a lucky run.

The most frequent failure is the flagship privacy assertion,
`privacy.test.ts > the employer's view of a candidate > carries no salary, email or mobile anywhere
in the payload`. The cause is in the test, at `privacy.test.ts:53-62`:

```ts
const SALARY_FINGERPRINTS = [
  String(CURRENT_SALARY), String(EXPECTED_MIN), String(EXPECTED_MAX),
  '13.37', '18', '22', 'currentSalary', 'expectedSalary',
];
…
expect(text).not.toContain(fingerprint);   // over the whole JSON body
```

`'18'` and `'22'` are asserted as bare substrings against a body full of ULIDs and ISO timestamps.
`"2026-08-07T09:22:…"` contains `22`. The test fails whenever the generated data is unlucky, and it
passes whenever it is lucky — it has never actually been testing what its name claims.

This is the most serious QA finding in the report, above any individual bug. The single most
important assertion in the codebase is a coin flip; CI (`.github/workflows/ci.yml` runs `npm test`)
will be red at random; and the natural response to a randomly-red suite is to re-run until green,
which is exactly how a real privacy leak ships. **Fix: replace the two bare numeric fingerprints
with keyed assertions over the parsed body. 2h.**

Other observed intermittent failures, all worth the same investigation:
`pipeline.test.ts > closing a job > resolves the applications nobody has acted on`
(`findById` returned `undefined`); `audit-2.test.ts > does not match every candidate on a bare
wildcard`; `privacy.test.ts > refuses a candidate's CV to an employer with no application from
them`; `pipeline.test.ts:450` re-apply. Lint, typecheck and build are clean and stable.

### 6.2 The code is not in version control — CONFIRMED

```
$ git log --oneline
468ff03 Add landing page, production-mode local run, and demo dataset
e4656c2 P2: candidate profile builder
410adb5 P1: auth & accounts
70e6adc P0: foundations
$ git status --short | wc -l
126        # 52 modified, 74 untracked
$ git diff --shortstat
52 files changed, 2679 insertions(+), 324 deletions(-)
```

P3 (employer & jobs), P4 (admin), P5 (applications & pipeline), P6 (recommendations & interviews),
P7 (notifications), P8 (privacy hardening) and every fix from two prior audits exist **only as
uncommitted working-tree changes**. Entire module trees are untracked:
`apps/api/src/modules/admin/`, `modules/employer/`, `modules/application/`, `modules/notification/`,
`modules/privacy/`, six of nine migrations, and most of the web app.

Three consequences: there is no history to hand over under T&C clause 7 ("all source code and
project assets … transferred to the client"); there is no rollback point, which makes
`deploy/rollback.sh` aspirational; and a single stray `git checkout .` or `git clean -fd` destroys
several weeks of work with no recovery. This should be fixed today, before anything else in this
report.

---

## 7. Commercial verdict

### 7.1 Is "go-live and handover" complete?

**No, and not arguably so.** Of six numbered Phase 1 deliverables in the document BK signed:

- **#1 Public website (7 pages + public jobs listing)** — not started. This is the only part of the
  product BK's own market ever sees, and it is 0% built.
- **#6 Hosting & go-live** — not started. No droplet, no DNS, no SSL, no backups running, no
  monitoring. The nginx configuration that will be deployed has a reproduced header defect.
- **#4 Admin dashboard** — "manage the applicant pipeline **per opening**" is not reachable in the UI.

There is no go-live, therefore no handover, therefore no seven-day clock, therefore no invoice. The
₹40,000 is not payable and should not be requested. Requesting it now would be the fastest way to
lose the relationship — and the first-year free support that follows go-live has not started either.

### 7.2 What I would refuse to sign off, and why

**Refuse outright until fixed:**

1. **§5.1 LinkedIn URLs reaching employers.** This is not a bug in a feature; it is a hole in the
   business model BK is paying for. If a client hires around BK using a link the platform gave
   them, BK loses the fee and the platform is the reason. 2h.
2. **§5.2 Consent collected with no privacy notice in existence.** Live DPDP exposure from the first
   registration. Cannot go live in any form until the Privacy Policy and Terms pages exist and are
   linked from the registration form.
3. **§6.1 A non-deterministic test suite whose flakiest test is the privacy assertion.** The
   evidence offered for quality does not currently support a quality claim. 2h.
4. **§6.2 Seventy per cent of the code uncommitted.** Both a delivery risk and an IP-transfer
   problem under clause 7. Today.
5. **§3.1 Employer registration → verification path.** Every employer's first experience, and every
   entry in BK's verification queue, is wrong. 4h.
6. **§5.3 nginx dropping HSTS / X-Frame-Options / nosniff.** Fails P10's own SSL Labs criterion. 1h.

**Would not block go-live, but must be in a written, dated snag list BK has seen:**

§2.1 CV upload silently re-queues · §2.3 no contact route anywhere · §2.4 enum names shown to users
· §3.2 no job on the coordination screen · §3.3 no pipeline context on the erasure card · §5.4
registration rate limit · §2.5/§2.6 list ergonomics at scale · §3.4 unused employer locations ·
§2.8 the `/status` link.

### 7.3 What must be settled with BK in writing before the ₹40,000 is invoiced

The developer's own board (`build-status.ts:260-267`) already lists six open commercial questions.
All six are still open, and every one of them is load-bearing for the payment trigger. Restating
them as I would put them to the client, plus five more this audit surfaced:

1. **Formal acceptance criteria for "go-live and handover".** The contract makes 73% of the fee turn
   on an undefined phrase. Define it as a checklist BK signs: which URLs resolve, which flows are
   walked through, what "handover" transfers (credentials, DNS, droplet, repository, runbook).
   *Nothing else on this list matters more.*
2. **Who owns the DigitalOcean account, the domain and the DNS.** Blocks P10 entirely and is a
   handover question, not a technical one.
3. **Scope of the free support year:** channel, hours, response window, and what counts as a bug
   versus a change request. §3.6 alone (manual password resets, by phone, indefinitely) is an
   unquantified commitment.
4. **Backup RPO/RTO, and who performs a restore.** T&C clause 5 disclaims all liability for data
   loss while clause 4 makes backups an AMC deliverable — i.e. from year two. State plainly who is
   responsible for BK's data in year one.
5. **Phase 2 boundary, in writing and initialled.** Email, WhatsApp, AI matching, match scores, the
   metrics dashboard, the Kanban board and the 24-hour interview reminder are all Phase 2. Several
   appear in the *Proposal* with no phase marker — the 360° views and the metrics table especially.
   BK will read those pages and expect them.
6. **The 360° Candidate and 360° Job Opening views (§1.4).** Proposal p7 describes both in detail;
   the Phased Plan's Phase 1 admin bullets do not include them. Genuinely ambiguous. Settle it.
7. **"Pin job to candidate" (§1.4).** Proposal p7 promises bidirectional recommendation. Only one
   direction is built. Either build it (~6h) or agree it is Phase 2.
8. **Candidate-facing rejection note (§1.5).** p8 promises the candidate a "Note". There is no field
   for one. Either add it (~3h) or agree the fixed copy is sufficient.
9. **Staging holds a nightly copy of production personal data (§5.6).** BK must consent to this in
   writing, and the erasure-propagation gap must be documented.
10. **The 29 sectors and 19 functions need BK's sign-off** (D5 on the developer's board). Everything
    a candidate and a job are matched on rests on this list, and it has never been reviewed by the
    people who know the market.
11. **The D3 question — whether a material job edit unpublishes until re-approved.** Currently it
    does. Employers will be surprised the first time it happens. Confirm the behaviour is what BK
    wants before an employer discovers it.

### 7.4 Recommended path

Roughly **45–50 hours** of remediation stands between here and a defensible go-live, excluding P9
(6 days estimated) and P10 (4 days estimated):

- **Today (~3h):** commit everything (§6.2); fix the LinkedIn leak (§5.1); fix the nginx headers
  (§5.3); fix the flaky privacy fingerprints (§6.1).
- **This week (~10h):** employer registration path (§3.1); coordination screen job/company (§3.2);
  CV re-queue warning (§2.1); contact details in a footer (§2.3); registration rate limit (§5.4).
- **With P9 (~20h):** Privacy Policy and Terms pages, linked from registration (§5.2); grievance
  contact; consent withdrawal; the remaining UX items in §4.
- **Then P10**, with the acceptance checklist from §7.3(1) agreed in advance and walked through with
  BK on staging.

The build is good. It is not finished, and the two things standing between it and finished — the
public site and the deployment — are the only two parts of it BK's own customers will ever touch.

---

## Appendix — data created during this audit

All against the local demo database at `apps/api/data/bktc.db`. Nothing in the repository was
modified except this report.

**Via the API:**

- `unicode1@demo.in` — candidate with a Devanagari + emoji name. Used for the DPDP erasure test and
  is now erased (`erased-01KZDS05672CENY5X1ZX64QNK8@erased.invalid`, suspended, soft-deleted).
- `load0@demo.in`, `load1@demo.in`, `load2@demo.in` — candidates, currently `SUBMITTED`, with
  applications on the Maintenance Engineer posting and six uploaded CV files (three superseded).
- 1 erasure request, executed.
- **Anita Desai** — `linkedinUrl` set to `https://www.linkedin.com/in/anita-desai-99`; CV replaced
  with a test `.docx`, which moved her profile from `APPROVED` to `SUBMITTED`.
- **Priya Nair** — applied to *Senior Process Engineer* and advanced to `SHORTLISTED`; career
  summary overwritten with 2,000 Devanagari characters; `currentJobTitle` set to
  `<img src=x onerror=alert(1)>`; skill list replaced with `["P&ID","PID","हिन्दी कौशल","<script>","GMP"]`.
- **Ravi Menon** — `hrContactName` changed to "Ravi Menon Jr".
- Skills `<script>`, `PID` and `हिन्दी कौशल` added to the shared taxonomy as `PENDING`.
- *Maintenance Engineer — Rotating Equipment* posting **closed**; its 224 applications are all at
  `NOT_SELECTED`.

**Direct SQLite inserts** (registration is capped at 10/IP/hour, which makes a 200-applicant test
impossible over HTTP — see §5.4):

- 220 users, candidate profiles and applications, all prefixed `LOADDBU` / `LOADDBP` / `LOADDBA`,
  applied to the Maintenance Engineer posting. Removable with
  `DELETE FROM user WHERE id LIKE 'LOADDB%'` (cascades).

**Temporarily modified and restored:**

- Zydus Lifesciences (employer `01KZDPYHMXDXGRMW6EV5WFTAXF`) was reduced to a fresh-registration
  shape, approved, and used to create a job posting, in order to demonstrate §3.1. Sector,
  locations, company introduction and `account_status = 'SUBMITTED'` have been restored and the test
  posting deleted.

To return to a clean demo dataset, re-run the demo seed.
