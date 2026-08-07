# Backend & Security Audit — BK Talent Connect

**Auditor:** independent backend/security review
**Date:** 2026-08-07
**Target:** `http://localhost:8080` (nginx → Vite SPA, Express API on :4000), commit as working-tree
**Scope:** API routes, services, repositories, serializers, middleware, schema, migrations, auth, session handling, SQL. Frontend and product-completeness are covered by other auditors and are deliberately out of scope here.

Every finding below carries the command that produced it and the real output, or a line-by-line trace. Findings I suspected and could not substantiate have been dropped; §11 lists what I checked and found correct, because that is also a result.

---

## Summary

| # | Severity | Finding |
|---|----------|---------|
| 1 | **HIGH** | Interviews are never cancelled when the application leaves `INTERVIEW_SCHEDULED` by any route other than `completeInterview`. Withdrawal, rejection, admin stage change and **erasure** all leave a live `SCHEDULED` interview visible to both parties and sitting on BK's coordination screen. |
| 2 | **HIGH** | Reactivating a suspended employer resurrects applications on jobs that employer had legitimately **closed** long before the suspension — 451 rows in one click in my test — putting candidates back at `APPLIED` against a job that is still `CLOSED`. |
| 3 | **HIGH** | Employer verification is enforced on exactly one route. An employer whose account has been sent back or **rejected** keeps full access to applicant profiles, CV downloads, stage changes and interview requests. |
| 4 | **HIGH** | DPDP erasure leaves three classes of the subject's personal data behind, two of them readable through the admin API after the request is marked `COMPLETED`. |
| 5 | MEDIUM | The new sliding session expiry extends the database row but never the browser cookie, so it cannot extend anybody's session. The bug it was written to fix is still there. |
| 6 | MEDIUM | An approved candidate can rename themselves to anything, with no re-review, and it reaches the employer's applicant list immediately. The mirror case for employers was explicitly closed. |
| 7 | MEDIUM | The login limiter counts **successful** logins. Five sign-ins in fifteen minutes locks the account; five wrong-password POSTs from a stranger lock it for anyone whose email is known. |
| 8 | MEDIUM | The new LIKE-wildcard escaping was applied to four of the five LIKE call sites. `listSkillsForAdmin` still treats `%` and `_` as wildcards. |
| 9 | MEDIUM | `GET /api/employer/applications/:id` 404s for an erased candidate. The `findByIdIncludingDeleted` fix was applied to the sibling POST route only. |
| 10 | MEDIUM | `completeInterview` marks an interview `COMPLETED` on an application that is not at `INTERVIEW_SCHEDULED`, silently recording a meeting that has no place in the pipeline. |
| 11 | MEDIUM | The suspend-employer cascade is three separate transactions. A failure between them leaves a suspended account with live postings, or live postings with closed applications. |
| 12 | MEDIUM | Any authenticated employer or candidate can grow the shared `skill` table without bound — 45 rows from three requests in my test. |
| 13 | LOW | Employers can list withdrawn applicants via `?stage=WITHDRAWN`, which the product says should leave their board entirely. |
| 14 | LOW | Reopening a job restores 451 applications and tells nobody, though closing it told every one of them. |
| 15 | LOW | `GET /api/employer/applications/:id` performs a database write, taking the single SQLite write lock on every applicant page view. |
| 16 | LOW | `OFFER_ACCEPTED` is a dead end in the transition matrix — a collapsed offer has nowhere to go. |
| 17 | LOW | Two job queries omit `deleted_at IS NULL`; `notification.entity_id` is unindexed and is scanned four times per erasure. |
| 18 | LOW | `.env.example` ships `TRUST_PROXY_HOPS=0`, the value its own comment says breaks rate limiting behind nginx. |

---

## Test harness

All reproductions use these helpers (`api.sh`), and cookie jars created by logging in as each demo account:

```bash
B=http://localhost:8080
DB="apps/api/data/bktc.db"
post() { curl -s -b "$1" -X POST "$B$2" -H 'Content-Type: application/json' \
          -H 'X-Requested-With: XMLHttpRequest' -d "${3:-{\}}" -w '\n[%{http_code}]\n'; }
get()  { curl -s -b "$1" "$B$2" -w '\n[%{http_code}]\n'; }
sq()   { sqlite3 -header -column "$DB" "$1"; }
```

---

# Findings

## 1. HIGH — An interview outlives the application it belongs to

**Where:** `apps/api/src/modules/application/application.service.ts:134` (`changeStage`), `apps/api/src/modules/admin/recommendation.service.ts:300` (`completeInterview`), `apps/api/src/repositories/interview.repo.ts:19` (`findScheduled`)

**What:** `interview.status` is only ever moved off `SCHEDULED` by `cancelInterview`, `completeInterview`, or a reschedule. `changeStage` — the single place a stage moves — never touches the interview table. So every other way of leaving `INTERVIEW_SCHEDULED` leaves a live interview row behind:

* the candidate withdrawing (`POST /api/candidate/applications/:id/withdraw`)
* the admin moving the stage on (`POST /api/admin/applications/:id/stage`)
* a rejection from `INTERVIEW_SCHEDULED`
* a DPDP erasure of the candidate

**Reproduction — candidate withdrawal:**

```
== 1. schedule interview (admin)
{"id":"01KZEENR2F41MS2JE1Y326V4AZ", ... "status":"SCHEDULED", ...}
[201]
stage = INTERVIEW_SCHEDULED

== 2. candidate withdraws
{"withdrawn":true}
[200]

== 3. interview row after withdraw
id                          status     scheduled_at              superseded_by_id
--------------------------  ---------  ------------------------  ----------------
01KZEENR2F41MS2JE1Y326V4AZ  SCHEDULED  2026-09-01T10:00:00.000Z

== 4. candidate still sees interview?
{"interview":{"id":"01KZEENR2F41MS2JE1Y326V4AZ","scheduledAt":"2026-09-01T10:00:00.000Z",
 "mode":"ONSITE","locationOrLink":"Gate 3, ask for Mr Patil, mob 98200-11111",
 "instructions":"Bring ID. Candidate mobile 9820011111","status":"SCHEDULED", ...}}
[200]

== 5. employer still sees interview?
{"interview":{... "status":"SCHEDULED" ...},"hasOpenRequest":false}
[200]

== 6. re-apply
{"applicationId":"01KZDSB8SVY3F1BFB9G6H960CR","reopened":true}
[201]

== 7. after
stage    status
-------  ---------
APPLIED  SCHEDULED
```

The application is back at `APPLIED` with a confirmed on-site interview attached to it, and both parties' interview pages still render the time and the gate instructions. Nobody was notified of anything.

**And the admin cannot repair it through the API.** Rescheduling requires a legal transition into `INTERVIEW_SCHEDULED`, which `APPLIED` is not:

```
== admin tries to re-schedule on APPLIED app
{"error":{"code":"VALIDATION_FAILED","message":"APPLIED cannot move to INTERVIEW_SCHEDULED."}}
[400]
```

**The coordination screen keeps chasing it.** After driving a second application all the way to `JOINED` and erasing a third candidate entirely, `GET /api/admin/coordination` still lists both interviews as upcoming work:

```
SCHEDULED | 2026-09-05T10:00:00.000Z | Priya Nair | 'https://meet.example/x' | app 01KZDSB8SVY3F1BFB9G6H960CR   <- application is JOINED
SCHEDULED | 2026-09-10T10:00:00.000Z | (deleted)  | '(removed)'              | app 01KZEETWTBNXT42TWEZBPF9GZW   <- candidate has been ERASED
```

**Why it matters commercially:** the file header on `interview.serializer.ts` says a mismatch here "means somebody turns up at the wrong time or place, which is the client's business failing in front of their own customer." That is precisely what this produces. BK's differentiator over a job board is that they run the coordination; an employer travelling to a factory gate for a candidate who withdrew a fortnight ago, or a coordinator ringing a candidate who has exercised their right to erasure, is the single most damaging failure this product has. The recent change moved `scheduleInterview` behind `canTransition`, which correctly stops an interview being *created* on a withdrawn application — but nothing was added for the far more common case where the withdrawal happens *after* the booking.

**Fix:** `changeStage` should cancel (or supersede) any `SCHEDULED` interview whenever the application leaves `INTERVIEW_SCHEDULED`, and raise `interviewCancelled` — the notification path already exists and already tells both sides. `executeErasure` should do the same.

---

## 2. HIGH — Reactivating an employer resurrects applications from jobs they had genuinely closed

**Where:** `apps/api/src/modules/admin/admin.service.ts:390-401` (`reactivateUser`), `apps/api/src/repositories/application.repo.ts:502` (`restoreAutoClosed`)

**What:** `restoreAutoClosed(jobId)` selects on `stage = 'NOT_SELECTED' AND outcome_reason_code = 'JOB_CLOSED'` and nothing else. `suspendUser` uses the *same* reason code `'JOB_CLOSED'` for its cascade (`admin.service.ts:351`), so the two are indistinguishable afterwards. `reactivateUser` then iterates `jobRepo.listIdsForEmployer()` — **every** job the employer has ever had, in any state — and restores all of them.

The result: an employer who closed a role in March and is suspended and reactivated in August has every applicant from that March closure put back to `APPLIED`, on a job that is still `CLOSED`.

**Reproduction:**

```
== BEFORE
title                                      status            app                         stage         outcome_reason_code
-----------------------------------------  ----------------  --------------------------  ------------  -------------------
Senior Process Engineer                    APPROVED          01KZDSB8SVY3F1BFB9G6H960CR  APPLIED
Maintenance Engineer — Rotating Equipment  CLOSED            01KZDPYHMY9VQ8FYYFD7C21R3M  NOT_SELECTED  JOB_CLOSED
Design Engineer — Sheet Metal              PENDING_APPROVAL

== suspend ravi   (POST /api/admin/users/01KZDPYHMXRG0GDG4Z4HCBPPQZ/suspend)  [204]
== reactivate ravi (POST /api/admin/users/01KZDPYHMXRG0GDG4Z4HCBPPQZ/reactivate)
{"restoredApplications":225}
[200]

== after reactivate
title                                      jobstatus         stage         outcome_reason_code
-----------------------------------------  ----------------  ------------  -------------------
Maintenance Engineer — Rotating Equipment  CLOSED            APPLIED                              <-- resurrected
Senior Process Engineer                    PENDING_APPROVAL  NOT_SELECTED  SKILLS_MISMATCH        <-- correctly left alone
Senior Process Engineer                    PENDING_APPROVAL  APPLIED
```

Priya's application to a role the employer closed weeks earlier is back at `APPLIED`. Her tracker now says the application is live. The job is `CLOSED`, so the employer cannot act on it and the candidate can never be progressed. `restoredApplications: 225` shows the blast radius on a database with only three jobs.

Two compounding problems in the same function:

* the jobs the suspension unpublished are **not** re-published (they stay `PENDING_APPROVAL`, as the docstring acknowledges), so every restored application now sits against a posting that is not live either;
* nothing distinguishes "closed by the cascade we are undoing" from "closed by the employer on purpose". The `SKILLS_MISMATCH` rejection was correctly preserved — the design intent is right, the scoping is not.

**Why it matters commercially:** suspension is described in the code as "a routine, reversible moderation action — a payment dispute, a complaint under investigation." Using it once corrupts the whole historical pipeline for that client, and it does so silently: no notification is sent, so the candidates whose applications reopened are never told and BK gets a batch of "why does this say I've applied to a job that doesn't exist" support mail.

**Fix:** stamp the cascade with its own reason code (`EMPLOYER_SUSPENDED`) and restore only that, or record the closing event id on the application and restore by it. Restrict the loop to jobs the suspension actually unpublished.

---

## 3. HIGH — Employer verification is enforced on exactly one route

**Where:** `apps/api/src/modules/employer/employer.service.ts:174-179` — the only `account_status !== 'APPROVED'` check in the codebase. `getProfile()` (line 32) and `getOwnedJob()` (line 137), which every other employer route goes through, check ownership only.

**What:** an employer whose company account is `SUBMITTED`, `CHANGES_REQUESTED` or `REJECTED` keeps everything except the ability to create a new posting.

**Reproduction — account moved back to `SUBMITTED`:**

```
GET /employer/jobs/$JOB/applications : 200      <- full applicant list, every candidate profile
GET /api/files/$anitaCV              : 200      <- downloads a candidate's CV
POST request-interview               : 201      <- lands on BK's coordination screen as real work
POST /employer/jobs (create)         : 403      <- the only thing blocked
```

**And with the account fully `REJECTED`:**

```
employer account_status=REJECTED, APPLIED->UNDER_REVIEW: 200
and ->NOT_SELECTED (rejects a candidate):               200
```

A company BK has rejected can still turn candidates down and fire the "not taken forward" notification at them.

Note this is not only an admin action: `updateProfile` (`employer.service.ts:78-85`) automatically demotes an `APPROVED` employer to `SUBMITTED` on any material edit. So the state is reached routinely, not exceptionally — and the file download route (`apps/api/src/modules/file/file.routes.ts:59-71`) checks the *candidate's* approval but never the *employer's*.

**Why it matters commercially:** verification is half of what BK sells. "Employers are verified before they can post" is on the proposal; the implementation reads "employers are verified before they can post, and can read every applicant's profile and CV regardless." The only lever that actually cuts access is full account suspension, which is a much bigger hammer than "we've asked them to fix their company details."

**Fix:** hoist the check into `getProfile()` or add an `requireVerifiedEmployer` middleware on `employerApplicantsRouter`, and add `ep.account_status = 'APPROVED'` to `employerMayViewCandidateFiles` (`application.repo.ts:468`).

---

## 4. HIGH — Erasure leaves the subject's personal data in three places

**Where:** `apps/api/src/repositories/erasure.repo.ts` — `scrubFreeTextAbout` (:198), `anonymiseCandidateProfile` (:169-179), `detachFromHistory` (:307), `resolve` (:84)

The recent change added `scrubFreeTextAbout` and `deleteNotificationsAbout`, whose docstring says it covers "free text OTHER people wrote about the subject" and is "the hard half of an erasure, and the half that was missed." It closed three columns and missed three more.

**Reproduction.** I seeded a candidate (Sameer Joshi) with the kinds of record a real one accumulates, filed one erasure request that was rejected, then a second that was executed:

```
== AFTER: residue
audit_log.metadata                    | 1
admin_note (JOB/EMPLOYER scoped)      | 2
erasure_request.reason (rejected one) | 1
candidate_profile                     | 0
file_asset rows                       | 0

-- offending rows
AUDIT: {"fromStatus":"CHANGES_REQUESTED","toStatus":"CHANGES_REQUESTED",
        "reason":"Sameer Joshi - CV lists his mobile 9820088888, ask him to take it out"}
NOTE [JOB]:      Sameer Joshi is our back-up for this role, mobile 9820088888
NOTE [EMPLOYER]: Discussed Sameer Joshi with Ravi
ERASURE_REQ[REJECTED]:  Please erase me. Sameer Joshi, 9820088888, Nashik.
ERASURE_REQ[COMPLETED]: (null)
```

**4a — `admin_note` scoped to JOB or EMPLOYER (API-readable).** `anonymiseCandidateProfile` deletes notes where `entity_type` is `'CANDIDATE'` or `'APPLICATION'`. A coordinator's note filed against the *job* or the *company* naming the candidate is untouched and stays served:

```
GET /api/admin/notes?entityType=JOB&entityId=01KZDPYHMXJN264HVBESJTY3W6
{"items":[{"id":"01KZEEZR6TXB4Q7M2MZHR0BSZY",
  "body":"Sameer Joshi is our back-up for this role, mobile 9820088888",
  "authorEmail":"admin@bktalentconnect.com", ...}]}
[200]
```

**4b — `erasure_request.reason` on any *earlier* request from the same person (API-readable).** `resolve()` nulls `reason` only on the row it is completing. A prior request that was refused keeps the person's own self-identifying prose, and the admin queue renders it:

```
GET /api/admin/erasure-requests
COMPLETED | erased-01KZDPYHMWHXNX4RJ2QN8X5CAS@erased.invalid | None
REJECTED  | erased-01KZDPYHMWHXNX4RJ2QN8X5CAS@erased.invalid | 'Please erase me. Sameer Joshi, 9820088888, Nashik.'
```

This is a direct regression of the change's own stated rationale: *"people asking to be erased routinely identify themselves in it — 'delete everything, my name is X, mobile Y'. Keeping it would leave the strongest copy of their personal data inside the very record we would produce as evidence that we erased them."* The evidence record still contains it, one row up.

**4c — `audit_log.metadata.reason` (database only).** `detachFromHistory` nulls `actor_id` and `ip_address` but not `metadata`, and the review audit row carries the reviewer's free-text note verbatim (`admin.service.ts:112`, `:146`, `:193`). The row is keyed on `entity_id = candidate_profile_id`, so it is directly re-identifiable. It is not currently reachable through the API (the candidate detail route filters soft-deleted profiles and 404s), but it survives in the database, in backups, and in anything BK exports.

**Why it matters commercially:** BK is the data fiduciary under the DPDP Act. The response to a rights request is the one thing a regulator will read line by line, and "we completed the erasure" is falsifiable in two clicks by an admin looking at the erasure queue itself. The rejected-request case is the worst of the three because it is the request record the client would produce as proof.

**Fix:** null `reason` on *every* request row for the user during `executeErasure`, not just the one being resolved; delete `admin_note` rows whose body matches the subject's name or, better, add a nullable `subject_user_id` to `admin_note` so notes about a person are addressable regardless of what they are filed against; strip or redact `metadata.reason` in `detachFromHistory`.

---

## 5. MEDIUM — Sliding session expiry never reaches the browser

**Where:** `apps/api/src/repositories/session.repo.ts:63` (`touchExpiry`), called from `apps/api/src/middleware/auth.ts:52`. The cookie is set only in `apps/api/src/modules/auth/auth.routes.ts:27` (`setSessionCookie`), from login and register.

**What:** `touchExpiry` correctly pushes `session.expires_at` forward. But the browser cookie carries a fixed `Expires` written once at login, and nothing re-issues it. The browser therefore discards the cookie 30 days after sign-in whatever the database says, and the user is hard-logged-out — the exact symptom the docstring says was fixed:

> *"expires_at was written once at creation and never touched, so every user was hard-logged-out exactly 30 days after signing in regardless of how much they had used the portal in between."*

**Reproduction:**

```
== Set-Cookie on login
Set-Cookie: bktc_session=gq8j91kg...; Path=/; Expires=Sun, 06 Sep 2026 15:53:56 GMT; HttpOnly; SameSite=Lax

== Set-Cookie on a subsequent authenticated request (sliding expiry refresh?)
0                       <- zero Set-Cookie headers on any later request

== DB expires_at for that session
expires_at                created_at
------------------------  ------------------------
2026-09-06T15:53:56.634Z  2026-08-07T15:53:56.634Z
```

The server-side row will slide; the cookie will not. Net user-visible behaviour is unchanged from before the fix.

Separately, `deleteExpired` (`session.repo.ts:98`) deletes on `created_at < now - retentionMs` (90 days), which is a correct hard cap — but it means the slide can never exceed 90 days from first sign-in even once the cookie is fixed.

**Fix:** re-issue the cookie from `loadSession` (or a small response-hook) whenever `touchExpiry` actually writes, using the same throttle so it is at most one `Set-Cookie` per hour.

---

## 6. MEDIUM — An approved candidate can rename themselves with no re-review

**Where:** `packages/shared/src/schemas/candidate.ts:161-172` — `fullName` is in `NON_MATERIAL_FIELDS`.

**What:** `MATERIAL_EMPLOYER_FIELDS` includes `companyName`, with an explicit rationale:

> *"The name is what a shortlisted candidate is shown, so a verified account silently renaming itself to any brand it likes would defeat the verification entirely."* — `employer.service.ts:51-57`

The identical argument applies to a candidate's name, which is what the *employer* is shown, and it was not applied.

**Reproduction:**

```
== APPROVED candidate renames herself
 fullName           = Dr Priya Nair (Ex-Google, IIT Bombay)
 profileStatus      = APPROVED
 requiresReapproval = False
 materialChanges    = []
 employer sees:
   ['Dr Priya Nair (Ex-Google, IIT Bombay)']
```

No review, no flag, no audit entry. The employer's applicant list shows the new string against a profile BK vouched for. `mobile` is non-material too, which is arguably fine (employers never see it), but the name is the one field employers *do* see and it is the one carrying the vetting.

**Why it matters commercially:** "we verify every candidate" is the reason an employer pays BK rather than posting on Naukri. A verified profile whose displayed identity is freely editable is a verification claim that does not hold.

**Fix:** move `fullName` into `MATERIAL_FIELDS`, or at minimum flag a name change on the admin queue.

---

## 7. MEDIUM — The login limiter counts successful logins, and can be used to lock anyone out

**Where:** `apps/api/src/middleware/rate-limit.ts:51-56` — `loginByEmailLimiter`, 5 per 15 minutes, keyed on the submitted email, with no `skipSuccessfulRequests`.

**Reproduction — seven correct-password logins in a row:**

```
  attempt 1: 200 0.027
  attempt 2: 200 0.025
  attempt 3: 200 0.022
  attempt 4: 200 0.022
  attempt 5: 429 0.0008
  attempt 6: 429 0.0007
  attempt 7: 429 0.0008
```

Two consequences:

* **Legitimate lockout.** A user who signs in on a phone, a laptop, a second browser, and after clearing cookies is locked out for fifteen minutes with "Too many attempts. Please try again shortly." The shared `admin@bktalentconnect.com` account that BK's team will all use is the worst case — the *whole team* shares a five-per-quarter-hour budget.
* **Targeted denial of service.** Anyone who knows a user's email can post five wrong passwords and deny them access for fifteen minutes, repeatedly. The email is guessable for employers (`hr_contact_email` is the login) and for the admin account.

The per-IP limiter (`loginByIpLimiter`, 30 / 15 min) is described in the file header as *"leaving the IP ceiling generous enough for shared networks"* against India's CGNAT. Thirty logins per fifteen minutes is two per minute for an entire carrier-grade NAT pool; my run of twenty concurrent logins from twenty *different* accounts on one IP produced seventeen 429s:

```
429 429 429 429 429 429 429 429 429 429 429 429 429 429 429 429 429 200 200 200
```

**Fix:** set `skipSuccessfulRequests: true` on `loginByEmailLimiter` so only failures count, and raise the per-IP ceiling substantially (it exists as a backstop, not as the primary control — the per-email limit is).

---

## 8. MEDIUM — The LIKE-escaping fix missed one of five call sites

**Where:** `apps/api/src/repositories/taxonomy.repo.ts:174-176`

```ts
if (options.search) {
  where.push(`lower(name) LIKE ? ${LIKE}`);
  params.push(`%${options.search.toLowerCase()}%`);   // <- raw template literal, not likeContains()
}
```

Every other site (`admin.repo.ts` ×3, `job.repo.ts` ×1, `application.repo.ts` ×1, `taxonomy.repo.ts:135`) calls `likeContains()`. This one carries the `ESCAPE '\'` clause but builds the pattern by hand, so nothing is escaped.

**Reproduction:**

```
== admin skills queue
  no search      : 103
  search=%       : 103      <- matches everything
  search=a_c     : 8        <- `_` still a wildcard
  search=aXc     : 0        <- proving `_` matched arbitrary characters above
```

Compare the escaped sites, all of which correctly return 0 for `search=%`:

```
  admin candidates search=% : 0    (no-search total 226)
  admin employers  search=% : 0
  admin jobs       search=% : 0
  candidate browse search=% : 0
  skills autocomplete q=%   : 0
  recommendable    search=% : 0
```

Not an injection — the value is parameterised — just the silently-wrong-results problem the `like.ts` docstring describes, still present on the one queue where an admin merges duplicate skills and where wrong results directly degrade the taxonomy.

**Fix:** `params.push(likeContains(options.search.toLowerCase()))`.

---

## 9. MEDIUM — The erased-candidate fix was applied to one of two routes

**Where:** `apps/api/src/modules/employer/employer-applicants.routes.ts:115` vs `:173`

The POST stage route was changed to `candidateRepo.findByIdIncludingDeleted`, with a comment explaining that the filtered lookup "500'd after the write had already committed". The GET detail route immediately above it still uses `candidateRepo.findById`:

```ts
// line 115 — GET /applications/:id
const profile = candidateRepo.findById(application.candidate_profile_id);
if (!profile) throw notFound('Candidate not found.');

// line 173 — POST /applications/:id/stage   (fixed)
const profile = candidateRepo.findByIdIncludingDeleted(updated.candidate_profile_id);
```

**Reproduction:**

```
GET  /employer/applications/$erasedApp : {"error":{"code":"NOT_FOUND","message":"Candidate not found."}}  404
POST /employer/applications/$erasedApp/stage : 200
```

So an employer holding a bookmark or a notification deep-link to an application whose candidate has been erased gets a hard 404, while the same application still accepts stage changes. The applicant *list* filters erased profiles out, so the row simply vanishes from the board with a dead link pointing at it.

**Fix:** use `findByIdIncludingDeleted` in both places; the returned row carries no personal data by construction.

---

## 10. MEDIUM — `completeInterview` records a meeting on an application that never reached interview

**Where:** `apps/api/src/modules/admin/recommendation.service.ts:300-329`

The recent change made `completeInterview` honour the boolean `setStatus` returns, which correctly stops a *cancelled* interview being marked as held. But the stage guard is a bare `if`, and when it does not match the function still returns success:

```ts
if (!interviewRepo.setStatus(interviewId, 'COMPLETED')) {
  throw conflict('That interview is no longer scheduled, so it cannot be marked as held.');
}
if (application.stage === 'INTERVIEW_SCHEDULED') {   // silently skipped otherwise
  applicationRepo.setStage(application.id, 'INTERVIEWED', 'INTERVIEW_SCHEDULED');
  ...
}
```

**Reproduction** (following on from finding 1, application back at `APPLIED` with an orphaned interview):

```
== admin marks the interview COMPLETE while app is APPLIED
[204]
stage    status
-------  ---------
APPLIED  COMPLETED
```

204 with no warning. The interview table now says a meeting was held; the application says the candidate has only just applied. Phase 2's time-to-interview and interview-to-offer metrics read both tables.

Also note the `setStage` return value on line 318 is discarded, so a failed transition still writes the `INTERVIEWED` stage event.

**Fix:** throw a 409 when the application is not at `INTERVIEW_SCHEDULED`, and act on `setStage`'s result.

---

## 11. MEDIUM — The suspend-employer cascade is not atomic

**Where:** `apps/api/src/modules/admin/admin.service.ts:319-363`

```ts
if (!userRepo.setStatus(userId, 'SUSPENDED', 'ACTIVE')) { ... }   // transaction 1
...
const jobIds = jobRepo.unpublishAllForEmployer(employer.id);       // transaction 2 (implicit)
for (const jobId of jobIds) {
  closeApplicationsForJob(jobId, actorId, 'JOB_CLOSED');           // transaction 3..n
}
```

Contrast `closeJob` (`employer.service.ts:362`), which was recently rewritten into a single transaction for exactly this reason:

> *"The status change and the application cascade were separate commits, so a failure between them left a closed posting with open applications against it."*

The suspension path has the same shape and did not get the same fix. A failure between steps leaves a suspended account with live postings, or unpublished postings with open applications. The same applies to `reactivateUser` (`:378-401`) and to `reopenJob` (`employer.service.ts:379-390`), where `setStatus` and `restoreAutoClosedApplications` are separate commits.

**Severity note:** the API is a single Node process with a synchronous SQLite driver, so this cannot be *triggered* by concurrency; it requires a genuine failure (disk full, `SQLITE_BUSY`, process kill) mid-cascade. Marked MEDIUM rather than HIGH for that reason.

**Fix:** wrap each of the three in `transaction()`, as `closeJob` now is.

---

## 12. MEDIUM — Unbounded growth of the shared skill taxonomy

**Where:** `apps/api/src/repositories/taxonomy.repo.ts` (`resolveSkillId`), reached from `employer.service.ts:266` and the candidate profile update path.

`LIMITS` caps skills *per record* (15 per job, 20 per candidate) but nothing caps how many distinct new skills an account may create, and there is no rate limit on `PATCH /api/employer/jobs/:id`.

**Reproduction — three PATCHes with 15 random skill names each:**

```
skill rows before=103  after 3 PATCHes=148  (delta 45)
unapproved skills: 60
```

Extrapolated, one authenticated employer adds ~15 rows per request indefinitely. `is_approved = 0` keeps them out of autocomplete (correct), but the rows persist, the admin skills queue fills with them, and the merge tool is manual and one-at-a-time. The `HIGH-16` docstring says the maxima exist so that "one authenticated account cannot permanently pollute the shared Skill table"; the per-record maxima do not achieve that.

**Fix:** cap distinct unapproved skills per account per day, or require an existing skill id for job postings and let only candidates propose new ones.

---

## 13. LOW — Employers can list withdrawn applicants

**Where:** `apps/api/src/repositories/application.repo.ts:337`

```ts
if (!options.stage) where.push("a.stage != 'WITHDRAWN'");
```

The exclusion only applies when no stage filter is supplied, so `?stage=WITHDRAWN` returns them:

```
  default list total    : 450
  ?stage=WITHDRAWN total: 1  ['Stress Candidate 0']
```

`EMPLOYER_BUCKET_OF.WITHDRAWN` is `null` with the comment "withdrawn applications leave the employer's board entirely," and the repository comment says the same. A candidate who steps back out is still enumerable by the employer, complete with their full profile.

**Fix:** make the exclusion unconditional, or reject `stage=WITHDRAWN` at the route.

---

## 14. LOW — Restoring applications tells nobody, though closing them told everyone

**Where:** `apps/api/src/modules/application/application.service.ts:232-247` (`restoreAutoClosedApplications`)

`closeApplicationsForJob` calls `events.applicationsClosedWithJob`, which writes one notification per candidate ("A role you applied to has closed"). The restore path writes a stage event and no notification at all.

```
reopen: 200 0.017s   restoredApplications = 451   job status = DRAFT
notifications after reopen: 726  (unchanged)
notifications matching 'reopen': 0
```

451 candidates were told their application had been closed and none were told it had been reopened. Their trackers move back to "Applied" silently, on a job that is now `DRAFT` and not visible.

---

## 15. LOW — A GET request takes the write lock

**Where:** `apps/api/src/modules/employer/employer-applicants.routes.ts:119` — `applicationRepo.markEmployerAction(application.id)` inside `GET /applications/:id`.

```
before=2026-08-07T16:01:51.381Z  after=2026-08-07T16:01:51.411Z
```

A read endpoint performs an `UPDATE`. On a single-writer SQLite database, every applicant page view serialises behind the write lock, and the endpoint is not safely retryable or cacheable. The metric it captures is worth having; a debounce (only write when `employer_last_viewed_at` is older than a few minutes) would remove almost all of the writes.

---

## 16. LOW — `OFFER_ACCEPTED` is a dead end

**Where:** `packages/shared/src/stages.ts:69-71`

The only edge out of `OFFER_ACCEPTED` is `→ JOINED`. Verified:

```
--- at OFFER_ACCEPTED: can candidate withdraw?
{"error":{"code":"VALIDATION_FAILED","message":"OFFER_ACCEPTED cannot move to WITHDRAWN."}}
--- at OFFER_ACCEPTED: can admin go to NOT_SELECTED?
{"error":{"code":"VALIDATION_FAILED","message":"OFFER_ACCEPTED cannot move to NOT_SELECTED."}}
```

An accepted offer that collapses — counter-offer from the current employer, background check failure, candidate ghosts on the joining date — has no representable outcome. The only options are to leave it at `OFFER_ACCEPTED` forever or falsely record `JOINED`, which is BK's *billing event*. Recruitment in India has a material drop-off rate between acceptance and joining; this needs a `OFFER_ACCEPTED → NOT_SELECTED` (admin) edge with a reason code.

---

## 17. LOW — Small SQL hygiene items

* `apps/api/src/repositories/job.repo.ts:280` (`unpublishAllForEmployer`) and `:313` (`listLiveIdsForEmployer`) select on `status = 'APPROVED'` without `deleted_at IS NULL`, unlike every other job query in the file. Currently harmless because nothing soft-deletes jobs, but it is the pattern that goes wrong when something does.
* `notification.entity_id` has no index (`008_notifications.sql` indexes `(user_id, created_at)` and a partial `(user_id) WHERE read_at IS NULL` only). `deleteNotificationsAbout` (`erasure.repo.ts:230`) runs four `entity_id` predicates in one `DELETE`, so an erasure full-scans the notification table four times. At 726 rows this is invisible; at the volume this table grows to it will not be.
* `contact_enquiry` is outside erasure entirely — it has no `user_id` and holds `name`, `email`, `phone` and free-text `message`. There is no public submission route yet (P9), so this is a note for when there is.

---

## 18. LOW — `.env.example` ships the value its own comment warns against

`.env.example:30` sets `TRUST_PROXY_HOPS=0` under a comment reading *"Exactly 1 behind nginx; 0 when running directly. Getting this wrong breaks rate limiting … too low and every request looks like 127.0.0.1 so five failed logins lock out everyone."* The deploy path is safe (`deploy/ecosystem.config.cjs:58` and `:75` both set `1`, and `scripts/nginx-dev.sh` sets `1`), and the zod default is `1` — but the file a droplet operator is told to copy carries the wrong value.

---

# §11 — Checked and found correct

These are areas I attacked and could not break. Recording them because "we tested this" is worth as much as a finding.

**Role and tenant authorisation.** I enumerated every route in `app.ts` and the eight `*.routes.ts` files and exercised 40 GET endpoints as anonymous / candidate / employer / admin. The matrix is clean: 401 for anonymous everywhere except `/api/health`, `/api/version`, `/api/taxonomy`, `/api/skills`, `/api/auth/policy`; 403 for every wrong role; no route reachable by an unintended role. Cross-tenant probes all returned 403 with an identical message for "not yours" and "does not exist":

```
neha (other employer) -> kirloskar's job          403 "You do not have access to that job posting."
neha -> kirloskar's job's applicant list          403
neha -> kirloskar's application                   403 "You do not have access to that application."
anita -> priya's application interview            403
anita -> priya's application company              403
```

`getOwnedJob` and `loadOwnedApplication` are correctly the single choke points, and no handler bypasses them.

**The privacy boundary.** I read the raw JSON of every candidate-facing and employer-facing endpoint and walked every key recursively against a banned-substring list (`salary`, `mobile`, `email`, `linkedin`, `reviewNote`, `expected`, `band`, `note`, `hrContact`, `password`). The only hits were legitimate: the employer's own salary band on their own posting, the employer's own HR contact on their own profile, the company's public LinkedIn on the post-shortlist company reveal, and `timeline[].note = null`. Specifically confirmed:

* `linkedinUrl` is gone from the employer's view of a candidate — the recent move out of `commonFields` works.
* `toCandidateStageEventView` strips the employer's private note. I wrote `"Weak communication, do not put forward again. Private."` as a stage-change note and confirmed it appears verbatim on `GET /api/admin/applications/:id` and as `null` on the candidate's `GET /api/candidate/applications`.
* Employer identity is `null` on candidate applications until `SHORTLISTED`; `GET /applications/:id/company` returns 403 before that with "The company is revealed once you are shortlisted."
* Salary never appears in any notification body; `EMPLOYER_PIPELINE_ACTION` and admin fan-out copy is admin-only.
* `salary-comparison` is admin-only (403 for both other roles).

**The stage machine.** Every write to `application.stage` goes through `canTransition` except three deliberate system paths (`closeOpenApplications`, `restoreAutoClosed`, `reopen`), all of which are narrowly scoped by an explicit `WHERE stage IN (...)`. I drove one application through `APPLIED → UNDER_REVIEW → SHORTLISTED → INTERVIEW_SCHEDULED → INTERVIEWED → OFFER_MADE → OFFER_ACCEPTED → JOINED` and probed illegal moves at each step. Results:

* All eight illegal employer targets from `APPLIED` rejected, with the right message split between "interviews are arranged by BK" (403) and "APPLIED cannot move to X" (400).
* `TERMINAL_STAGES` now genuinely guards. From `JOINED`, all of admin→`NOT_SELECTED`/`WITHDRAWN`/`APPLIED`/`OFFER_MADE`/`UNDER_REVIEW`, candidate→`WITHDRAWN`, employer→`NOT_SELECTED`, admin scheduling, and employer interview-request were all refused with *"This application is closed at JOINED and cannot be changed."*
* The two-step escape the change describes (`withdraw` from a terminal stage then re-apply) is closed: `NOT_SELECTED → WITHDRAWN` now falls through to the table and is refused.
* The 24-hour `NOT_SELECTED` window behaves exactly as specified: reversal to `SHORTLISTED` succeeds inside the window, is refused with *"The 24-hour window to reverse this rejection has passed"* at 25 hours, is refused for a non-reversible target (`OFFER_MADE`), and is refused for a non-admin actor.
* `POST /applications/:id/outcome-reason` does not move `last_stage_change_at`, so it cannot be used to extend the reversal window.
* `apply()` re-checks `findLiveById` **inside** the transaction, so a stale page cannot apply to a closed role.

**Concurrency.** All parallel probes behaved. Ten simultaneous applies from one candidate: `201 409 409 409 409 409 409 409 409 409`, one application row, one stage event. Two admins reviewing the same profile at once with the same `expectedStatus`: `reject=204 approve=409`, one status written, one note. Eight parallel employer stage changes: `200 400×7`, one stage event, correct notification count. The `expectedStatus` optimistic-concurrency token does what its docstring claims.

**SQL.** No interpolation of user input into SQL anywhere. Every `ORDER BY` column comes from a frozen allowlist map and anything else is a 400, not a silent fallback:

```
sort=created                200      sort=created;--             400
sort=(select 1)             400      sort=id) --                 400
sort=cp.expected_salary_min 400      sort=expectedSalaryMin      400   (employer applicant list)
dir=ASC                     200      dir=X                       400
```

The salary columns are deliberately absent from all four sort maps, which correctly closes the "sort to binary-search a hidden value" channel. `deleted_at IS NULL` is present on every user/profile/job read path I traced except the two noted in finding 17.

**Migrations and schema.** All nine apply cleanly; `migrate.ts` backs up with `VACUUM INTO` (not `cp`, which is wrong under WAL), commits DDL and its `schema_migrations` row in one transaction, toggles `foreign_keys` outside the transaction via an explicit file directive, and runs `foreign_key_check` + `integrity_check` afterwards. Only one `ALTER TABLE` exists across all nine (`003`: `ADD COLUMN state TEXT`, nullable, backwards-compatible). No `NOT NULL` without a default is added to a populated table. `TABLE_COLUMNS` in `db/rows.ts` matches `PRAGMA table_info` for every table in both directions — `tests/schema-parity.test.ts` (60 assertions) passes. The partial unique indexes (`idx_interview_one_scheduled`, `idx_erasure_request_one_open`) are respected by the code paths that write them: `scheduleInterview` frees the index before inserting, inside a transaction, and `requestErasure` checks `findOpenForUser` first.

**Session and auth.** All edge cases handled:

```
suspended user with a live cookie          -> 401 on the next request (both /auth/me and role routes)
reactivated                                -> 200 again
token reuse after logout                   -> 401
admin password reset, old cookie           -> 401 (all sessions revoked)
temp password login, mustChangePassword    -> /auth/me 200; every other route 403
  /api/candidate/profile 403   /api/candidate/profile/ 403   /api/notifications 403
  /api/privacy/erasure-requests 403        POST /api/candidate/jobs/x/apply 403
```

The `PASSWORD_CHANGE_EXEMPT` check in `middleware/auth.ts:69` handles both the `router.use` case (`req.path === '/'` → `req.baseUrl`) and the route-level case correctly; I could not find a path or query variant that slipped past it. Tokens are stored as SHA-256 only. `login()` runs a dummy Argon2 verification for unknown emails so timing does not distinguish them (measured: 22–27 ms either way).

**CSRF.** All three layers enforced on state-changing methods:

```
no X-Requested-With            403
Origin: https://evil.example   403
Sec-Fetch-Site: cross-site     403
```

**File upload and download.** Magic-byte verification, size cap, and the staging protocol all hold:

```
5 MB valid PDF     201    6 MB PDF   413 PAYLOAD_TOO_LARGE
MZ header renamed .pdf    415 UNSUPPORTED_MEDIA_TYPE
```

Uploading a CV correctly demoted an `APPROVED` profile back to `SUBMITTED` (`resume` is material), soft-deleted the previous file row, and left the previous file on disk for the application snapshot. The download route denies by default and each branch earns access; `Content-Disposition: attachment`, `nosniff`, `default-src 'none'; sandbox` and the RFC 5987 filename encoding are all present.

**URL scheme allowlist.** `packages/shared/src/schemas/url.ts` works, including the case the docstring is really about:

```
javascript:alert(1)                 400
data:text/html,<script>x</script>   400
ftp://x.example                     400
http://ok.example                   200
https://wa.me/919876500123          200 + requiresReapproval:true, materialChanges:["website"]
```

The WhatsApp link is accepted as a URL but correctly classified as a **material** change, so it goes back through review before any candidate sees it. That is the right design.

**Superseded-CV retention.** The new 30-day hard delete works and respects the application snapshot:

```
-- backdated a superseded CV 40 days; referenced by 0 application snapshots
Retention sweep:
  superseded CVs removed   : 1
after: row gone from file_asset, file gone from disk, all other files untouched
```

**Test suite.** `npm test --workspace=@bktc/api` — **324 tests, 12 files, all passing** in 2.1 s, including `erasure.test.ts` (19), `pipeline.test.ts` (34) and `privacy.test.ts` (20). Worth noting that four of the confirmed findings above (1, 2, 4, 9) sit in code these suites cover, so the gaps are in what the tests assert rather than in coverage.

---

# §12 — Stress measurements

Environment: MacBook Air (M-series), single Node process, SQLite WAL, nginx in front. Times are `curl` `time_total`, wall clock.

**Read paths — a job with 451 applications, 724 applications total, 232 users:**

| Endpoint | Time |
|---|---|
| `GET /employer/jobs/:id/applications` (page 1, 20) | 14 ms |
| `GET /employer/jobs/:id/applications?pageSize=100` | 10 ms |
| `GET …?pageSize=100&page=5` | 6 ms |
| `GET …?pageSize=100&sort=name` | 6 ms |
| `GET /employer/jobs/:id/close-impact` | 0.9 ms |
| `GET /admin/applications?jobId=…&pageSize=100` | 9 ms |
| `GET /admin/applications?pageSize=100` (unfiltered) | 11 ms |
| `GET /admin/jobs/:id/candidate-search?pageSize=100` | 5 ms |
| `GET /admin/candidates?pageSize=100` | 6 ms |
| `GET /admin/stats` | 1 ms |
| `GET /candidate/applications?pageSize=100` (47 apps) | 3 ms |
| `GET /candidate/jobs?pageSize=100` | 4 ms |
| `GET /notifications?pageSize=100` | 1 ms |
| `GET /notifications/unread-count` | 0.7 ms |

Nothing degrades badly. The N+1 patterns I expected to hurt — `listForCandidate` fetching each job individually (`application.repo.ts:266-272`), `listApplicants` calling `candidateRepo.findById` + `loadCandidateRelations` per row, and `listStageEvents` per application — are all real but stay under 15 ms at 100 rows because SQLite prepared statements are cheap in-process. At a page size of 100 the applicant list issues roughly 400 queries; it is worth batching before Phase 2 but it is not a current problem.

**Notification fan-out — closing a job with 451 open applications:**

```
close: 200  0.066 s
notifications 274 -> 726   (451 candidate rows + 1 admin summary; omitAdminFanOut works)
stage events written: 451
```

Event-loop block measured with a concurrent `/api/health` poller:

```
60 samples   max 0.063 s   avg 0.0017 s   slowest 5: 0.001 0.001 0.001 0.001 0.063
```

One request absorbed the whole 63 ms; everything else was unaffected. That is the correct shape — the entire cascade is one synchronous transaction, so it is a single short stall rather than sustained contention. Extrapolating linearly, 5,000 applicants would be a ~700 ms full-process freeze, which is the point at which this needs chunking.

**Reopen (restore fan-out):** 451 applications restored in **17 ms**. Faster than the close because it writes no notifications — which is finding 14.

**20 concurrent logins (Argon2id):** wall clock **0.49 s** for the batch; successful logins measured 41–46 ms each under contention versus 22–27 ms unloaded. `/api/health` during the burst: max 17 ms, avg 0.9 ms. Argon2 runs off-thread and does not block the event loop. Note that 17 of the 20 were rejected by the rate limiter (finding 7), so the true 20-way Argon2 cost is not measured here; the three that ran concurrently showed ~1.8× latency, which extrapolates acceptably.

**5 MB upload concurrent with a stage change:**

```
stage : 200  0.006 s
upload: 201  0.023 s
/api/health during: max 0.004 s  avg 0.0009 s
```

The 5 MB buffer, magic-byte check, SHA-256, temp write and rename cost 23 ms total and did not delay the concurrent write or unrelated reads. `LIMITS.resume.maxBytes` at 5 MB with `files: 1` is well within budget for a 1 GB droplet.

**Nothing held a write lock long enough to matter.** The longest single stall observed anywhere was the 63 ms job-close cascade.

---

# Top five to fix first

1. **Cancel the interview when the application leaves `INTERVIEW_SCHEDULED`** (finding 1). This is the one that will show up as a real person at a real gate on the wrong day, in front of BK's paying client. `changeStage` and `executeErasure` both need it, and the `interviewCancelled` notification path already exists.
2. **Scope the reactivation restore** (finding 2). One suspension of one employer silently rewrites the pipeline history of every job they ever closed. Give the suspension cascade its own reason code and restore only that.
3. **Enforce employer verification on the applicant surface** (finding 3). Right now "verified employer" is a claim the code checks in exactly one place. A rejected company can still read every applicant's profile and download their CV.
4. **Close the three erasure residues** (finding 4). Two of them are readable through the admin API on a request the system has already marked `COMPLETED`, and one of those is the person's own self-identifying text sitting in the compliance record. This is the finding with regulatory teeth.
5. **`skipSuccessfulRequests` on the login limiter** (finding 7). Cheapest fix on the list, and it is currently a targeted lockout of any known email address plus a guaranteed support ticket for the shared admin account.

Findings 5, 8 and 9 are all one-to-three-line changes and worth taking in the same pass.

---

# §13 — Data I changed (for reseeding)

The local demo database was mutated. **A full `npm run seed:demo` against a fresh `apps/api/data/bktc.db` is the cleanest reset.** For reference, what I did:

**Cleaned up before finishing (no longer present):**
* 318 `stress*@demo.in` candidate users + profiles, and their notifications
* one stress job (451 applications) and 50 "Multi Job N" jobs (47 applications for Anita)
* one "Skill pollution probe" job and ~45 unapproved junk skill rows

**Left behind (needs a reseed):**
* `Priya Nair` — application `01KZDSB8SVY3F1BFB9G6H960CR` driven to **`JOINED`** (was `SHORTLISTED`); two interview rows against it, one `COMPLETED` and one still `SCHEDULED` (finding 1); `profile_status` restored to `APPROVED`
* `Anita Desai` — a new 5 MB PDF resume uploaded (`01KZEF8KXKXAAVR0F4KVFPK0YX`); previous CV row hard-deleted by the retention sweep test; `profile_status` restored to `APPROVED`; her application backdated to test the 24-hour window (`last_stage_change_at` = ~25 h ago)
* `Rohit Kulkarni` — `profile_status` = **`REJECTED`** (concurrency test); password reset to the temporary `bff8-yc5t-edwz` with `must_change_password = 1`
* `Fatima Shaikh` and `Sameer Joshi` — **erased** (accounts tombstoned, profiles anonymised and soft-deleted). Fatima has a stranded `SCHEDULED` interview; Sameer has residual `admin_note` rows on the JOB and EMPLOYER entities and a `REJECTED` erasure request still carrying his details — all deliberate evidence for finding 4
* `Kirloskar Systems` — suspended and reactivated once; `account_status` toggled through `SUBMITTED`/`REJECTED` and restored to `APPROVED`; `website` set and cleared; one open interview request
* `Neha Gupta` — suspended and reactivated (net no change)
* `Senior Process Engineer` job — unpublished by the suspension cascade and re-approved via the admin route; `published_at` refreshed
* audit_log, notification, session and erasure_request rows from all of the above
* `apps/api/data/backups/` unchanged; a pre-audit copy of the database is at
  `…/scratchpad/bktc.db.before-audit` if a byte-exact restore is preferred over a reseed

No repository file was modified other than this report. No git command was run.
