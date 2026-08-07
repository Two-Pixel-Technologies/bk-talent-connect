# 03 — Frontend & UX Audit

Independent review of `apps/web/src` against the running app at `http://localhost:8080`.
Scope: components, pages, state, forms, error/loading/empty states, accessibility,
responsive behaviour, copy. Backend and product-completeness are covered elsewhere.

**Verdict: 6.5 / 10.** The recent round of fixes is real and mostly well-judged. The
failure pattern is that each fix was applied to the screen that was audited and not to
its identical sibling — the employer's interview-confirm button is still silent, the
candidate's job search is still un-debounced, one more page still dead-ends on a
permanent skeleton, and one more mutation still leaves `/auth/me` stale. And the
headline "notification deep links resolve" fix demonstrably does not reach the record it
points at.

**Note on the demo data.** The dataset described in the brief has drifted: `fatima.shaikh@demo.in`
and `sameer.joshi@demo.in` no longer exist, `rohit.kulkarni@demo.in` is REJECTED not
SUBMITTED, and a load-test seed has pushed the database to 226 candidates / 227
applications. I registered `audit.ux1@demo.in` to walk the empty-DRAFT journey. The
larger dataset turned out to be useful — it is what exposed H2.

---

## Findings — most severe first

### H1 · HIGH · The public landing page carries a link that 404s in production

`apps/web/src/pages/landing.tsx:68` · `apps/web/src/router.tsx:64-69`

```tsx
// landing.tsx:68
<Link to="/status" className="font-medium text-brand-600 hover:underline">
  See build progress →
</Link>
```

`/status` is registered only inside `...(import.meta.env.DEV ? [...] : [])`. In a
production build the route does not exist, so the link falls through to `path: '*'`.

**What the user experiences.** A prospective candidate or employer lands on the front
door, reads the footer paragraph about P9, clicks "See build progress →" and gets
"404 — Page not found. That page doesn't exist, or you don't have access to it."

The route exclusion is correct. The link to it was not removed with it. CONFIRMED.

**Fix.** Delete the sentence and the link from `landing.tsx`, or wrap it in the same
`import.meta.env.DEV` guard. One line.

---

### H2 · HIGH · Admin notification deep links land on an unfocused list, and drop the default filter doing it

`apps/web/src/features/notifications/use-notifications.ts:96-112`
`apps/web/src/pages/admin/candidate-queue.tsx:42,46,52` (same shape in `employer-queue.tsx:35,39,44`, `job-queue.tsx:39,43,48`, `pipeline.tsx:91,95`)

`routeFor` produces `/admin/candidates?focus=<profileId>` and
`/admin/pipeline?focus=<applicationId>`. The receiving pages then do:

```tsx
const status = params.get('status') ?? (focusId ? '' : 'SUBMITTED');   // line 42
const [selectedId, setSelectedId] = useState<string | null>(focusId);  // line 46
const selected = data?.items.find((c) => c.id === selectedId) ?? null; // line 52
```

The focused record is resolved by scanning **the twenty rows of page one only**. There is
no fetch by id.

**Reproduced against the running app.** A `CANDIDATE_REGISTERED` notification in the admin
feed points at profile `01KZEGMYNP5PE94BN4S7CS047C`:

```
GET /api/admin/candidates?page=1   → total 227, returned 20
focus id present on page 1?        → False
```

Same for the pipeline (227 applications, 12 pages) — of the two application ids in the
live admin feed, one is on page 1 and one is not.

**What the user experiences.** BK's reviewer sees "New candidate registered", taps it,
and arrives at the Candidates screen with (a) their usual "Awaiting review" filter
silently replaced by "All", and (b) the right-hand pane reading "Select a record to
review it." Nothing indicates a specific record was requested. On a phone they just see
an unfiltered list. The notification is now a worse route to the work than the nav link
is.

**The fix already exists and is wired to nothing.** `useCandidateDetail`
(`apps/web/src/features/admin/use-admin.ts:146-155`) fetches `/admin/candidates/:id`
and is imported by no file in the repo. Use it (and the equivalent for employers, jobs
and `/admin/applications/:id`) when `focus` is present, and stop clearing the status
filter. ~4h across the four screens. CONFIRMED.

---

### H3 · HIGH · Submitting an incomplete profile produces five bullets that just say "Required"

`apps/web/src/pages/candidate/profile-wizard.tsx:309-319`

The file defines `fieldLabel()` at line 90 precisely to solve this, with a comment
(lines 54-61) explaining that bare zod strings "with the field only in `path`, which the
wizard discarded" are "not an error message, it is a puzzle". It applies it to
`update.error` at line 227 — and not to `submit.error`:

```tsx
{submit.error.fields.map((f) => (
  <li key={f.path}>{f.message}</li>   // line 314 — no fieldLabel(f.path)
))}
```

**Verified live.** Registered a fresh candidate, POSTed `/api/candidate/profile/submit`
on the empty DRAFT profile. The server returns 18 field errors. Rendered through line
314 the candidate reads:

> **Your profile is not complete yet.**
> · Choose your city. · Choose your state. · Enter your current job title. · **Required**
> · Choose your sector. · Choose your function. · Choose your education level.
> · Enter your qualification. · **Required** · Write at least 150 characters — this is
> what our team reads first. · Choose your notice period. · Choose your employment
> preference. · **Required** · **Required** · **Required** · Add at least 3 skills.
> · Add at least one previous role. · Upload your CV before submitting.

Five identical bare "Required" bullets (`yearsOfExperience`, `qualificationYear`,
`currentSalaryLpa`, `expectedSalaryMinLpa`, `expectedSalaryMaxLpa`). Three more paths
(`skillCount`, `experienceCount`, `hasResume`) are not in `FIELD_LABELS` at all and would
render as raw camelCase if the label were applied.

Compounding it: the alert renders only on step 5, the eighteen fields are spread across
all five steps, and `Stepper` (line 356) gives no per-step error state. The candidate has
to walk all five steps guessing which "Required" is which.

**Fix.** Pass `f.path` through `fieldLabel` on the submit branch as the update branch
does; add `skillCount`, `experienceCount`, `hasResume` to `FIELD_LABELS`; mark the
offending steps in the `Stepper` using `PROFILE_STEPS[].fields`. ~5h. CONFIRMED.

---

### H4 · HIGH · `/admin/jobs/:id/recommend` shows a skeleton forever when the job fetch fails

`apps/web/src/pages/admin/recommend.tsx:49-54,115-119`

```tsx
const job = useQuery({ queryKey: ['admin', 'job', id], queryFn: ... });   // line 49
const results = useCandidateSearch(id, debouncedSearch, page, job.isSuccess); // line 54
...
<QueryState isPending={results.isPending} error={results.error} ... >     // line 115
```

A disabled query in TanStack v5 is `status: 'pending'`, `fetchStatus: 'idle'` — so
`results.isPending` is `true` and stays `true`. `job.error` is read nowhere on the page.

Verified the trigger exists: `GET /api/admin/jobs/nosuchjob` → 404
`{"code":"NOT_FOUND","message":"Job posting not found."}`.

**What the user experiences.** Admin follows a stale link, or a posting is deleted, or
the session expires mid-session. The page renders the heading "Who should we put
forward?" and three pulsing grey skeletons, forever. No message, no retry. This is the
exact failure the QueryState work was introduced to eliminate — it just wasn't applied
here.

**Fix.** Render `job.error` through `QueryState` before the results block, and gate on
`job.isPending || job.isError` rather than leaving the child query disabled with no
explanation. ~1h. CONFIRMED.

---

### H5 · HIGH · The wizard throws away the current step's typing if you use the stepper or navigate away

`apps/web/src/pages/candidate/profile-wizard.tsx:110,142-164,364-371`

The draft lives in `useState`. `save()` runs only from "Save" and "Save and continue".
The stepper buttons do nothing but move:

```tsx
<button type="button" onClick={() => onSelect(index)} ...>   // line 364-366
```

There is no `beforeunload` handler and no router blocker.

**What the user experiences.** A candidate fills in step 2 on their phone, taps "3 Career
history" in the stepper because that is what a stepper implies, and step 2 is now
unsaved. Tap "Browse jobs" in the nav, or background the browser long enough for the tab
to be evicted (routine on mid-range Android), and everything since the last explicit
Save is gone with no warning. The five-step wizard is the single most expensive thing a
candidate does in this product.

**Fix.** Call `save()` before `setStepIndex` in the stepper's `onSelect`, and add a
`useBlocker`/`beforeunload` guard when `hasChanges` is true. ~4h. CONFIRMED.

---

### M1 · MEDIUM-HIGH · The employer's "Confirm" interview button is still a silent mutation

`apps/web/src/pages/employer/applicants.tsx:398,436-444`

```tsx
const confirm = useConfirmEmployerInterview();   // line 398
...
<Button loading={confirm.isPending} onClick={() => confirm.mutate(applicationId)}>
  Confirm
</Button>
```

`grep "confirm\." apps/web/src/pages/employer/applicants.tsx` returns exactly two hits:
`.isPending` and `.mutate`. `confirm.error` is never read.

The identical candidate-side button got a `MutationFeedback`
(`applications.tsx:290-294`) in the recent round, and `mutation-feedback.tsx:8-10` names
this precise interaction in its own header comment: *"A candidate tapping 'Confirm you
can make it' on an interview, getting a 409, and seeing no reaction will reasonably
conclude it worked. Then they turn up."* The same sentence applies verbatim to the HR
manager on the other side of that meeting, and their side was not fixed.

**Fix.** Add `<MutationFeedback error={confirm.error} isSuccess={confirm.isSuccess}
successMessage="Confirmed. We have told the candidate." />` under the button. 15 min.
CONFIRMED.

---

### M2 · MEDIUM-HIGH · Editing a verified company un-verifies it, and the rest of the app doesn't find out

`apps/web/src/features/employer/use-employer.ts:74-81` · `apps/api/src/modules/employer/employer.service.ts:78-84`

Server side, a material edit (`companyName`, `sectorSlug`, `companyIntro`, `website`,
`linkedinUrl` — `packages/shared/src/schemas/job.ts:63-80`) on an APPROVED company sets
`account_status` back to `'SUBMITTED'`.

Client side:

```tsx
export function useUpdateEmployerProfile() {
  return useMutation({
    mutationFn: ...,
    onSuccess: (data) => queryClient.setQueryData(['employer', 'profile'], data.profile),
  });   // no invalidation of ['auth', 'me']
}
```

`/auth/me` is cached with `staleTime: 60_000` (`auth-context.tsx:47`) and the global
default `refetchOnWindowFocus: false` (`main.tsx:21`).

**What the user experiences.** Ravi at Kirloskar rewrites his company introduction. The
Company page correctly says "Back to our team for a quick re-check". He clicks "Job
postings": `verified = user?.approvalStatus === 'APPROVED'` (`job-list.tsx:46`) is still
true from the cache, so the "+ New posting" button is still there and the warning banner
is not. He clicks it, types a title, and gets a 403 —
*"Your company is still being verified."* `/employer` also still says "Your company is
verified. You can post roles."

The two sibling hooks both handle this: `useSubmitEmployerProfile` invalidates
`['auth','me']` at line 89, and the candidate `useUpdateProfile` does at
`use-profile.ts:92` with the comment *"The approval gate may have moved, and the portal
shell reads it."* This one hook was missed.

**Fix.** Add `void queryClient.invalidateQueries({ queryKey: ['auth','me'] })` when
`data.requiresReapproval`. 10 min. CONFIRMED.

---

### M3 · MEDIUM-HIGH · A dropped `/auth/me` request signs the user out of the interface

`apps/web/src/features/auth/auth-context.tsx:35-48,83-91`

```tsx
const { data, isPending } = useQuery({
  queryKey: ['auth', 'me'],
  queryFn: async () => { try { ... } catch (e) { if (401) return null; throw e; } },
  retry: false,      // line 46
  staleTime: 60_000,
});
```

`retry: false` overrides the global two-retry policy. On a 500 or a dropped connection,
`data` is `undefined` → `user` is `null` → `ProtectedRoute` renders
`<Navigate to="/login" replace />`.

**What the user experiences.** An engineer on a train, three steps into the profile
wizard, hits a tunnel while the session query happens to refetch. They are bounced to the
sign-in screen — not signed out server-side, just told they are — and the unsaved draft
(H5) goes with it. The brief names patchy connections as the normal case for this
audience.

**Fix.** Distinguish `error` from `data === null`. Retry network errors (keep `retry:
false` only for 401), and on a hard failure render a "We can't reach the server — retry"
state rather than a redirect. ~3h. CONFIRMED by code; the redirect path is unambiguous.

---

### M4 · MEDIUM-HIGH · A failed pipeline detail fetch tells the admin the application is finished

`apps/web/src/pages/admin/pipeline.tsx:215-222,328-364`

```tsx
const available = detail.data?.availableStages ?? [];   // line 222
...
{detail.isPending ? (
  <p>Loading actions…</p>
) : (
  ... {available.length === 0 && (
    <p>This application has reached the end of the pipeline.</p>   // line 360-362
  )}
)}
```

`detail.isError` is never checked. On a failed detail fetch `isPending` is false and
`data` is undefined, so the admin is told, in plain English, that a live application is
finished — with no buttons and no retry. Same "confident false statement" failure the
dashboard's `pending === 0` bug was just fixed for (`dashboard.tsx:19-32`).

**Fix.** Add an error branch with a retry before the `available.length === 0` case.
30 min. CONFIRMED.

---

### M5 · MEDIUM-HIGH · Employer notifications about applications and interviews dead-end on the postings list

`apps/web/src/features/notifications/use-notifications.ts:105-112`

```tsx
case 'APPLICATION':
  if (role === 'CANDIDATE') return '/candidate/applications';
  if (role === 'ADMIN') return `/admin/pipeline?focus=${link.entityId}`;
  return '/employer/jobs';       // line 108
case 'INTERVIEW':
  ...
  return '/employer/jobs';       // line 112
```

`CANDIDATE_SHORTLISTED` and `INTERVIEW_CONFIRMED` both reach employers
(`packages/shared/src/notifications.ts:90-98`). An HR manager gets "Interview confirmed",
taps it, and lands on a list of their job postings. The interview details live on
`/employer/jobs/:jobId/applicants` — and the notification link carries an
*applicationId*, not a jobId, so no client-side mapping is possible.

This is structurally the same bug as the admin interview-request one that was just fixed
by special-casing the event; the employer half of the same table was left alone.

**Fix.** Either add `jobId` to the notification link payload for employer-bound
APPLICATION/INTERVIEW events, or add an `/employer/applications/:id` redirect route that
resolves the job server-side. ~4h including the API change. CONFIRMED.

---

### M6 · MEDIUM · `domainTags` is captured, stored, serialized — and rendered nowhere

`apps/web/src/pages/candidate/profile-wizard.tsx:631-651` (new input)
`apps/api/src/serializers/candidate.serializer.ts:35,55-68` (in `commonFields`, so admin **and** employer views carry it)
`apps/web/src/features/admin/use-admin.ts:30-38` · `apps/web/src/pages/employer/applicants.tsx:40-48` (neither declares it)

The new field's own comment cites the proposal's career-history row —
*"Company · title · years · domain tags"* — and says the form hardcoding an empty array
meant "every candidate row would have had an empty list forever". The input now writes
real values, and the two screens that were meant to display them still don't:

- `candidate-queue.tsx:224-234` renders `title · company`, years, `keyAchievement`. No tags.
- `applicants.tsx:276-286` renders the identical four fields. No tags.

**What the user experiences.** A candidate is asked "What did you work on?" with the hint
"rotating equipment, HAZOP, tech transfer", types it carefully, and nobody who decides
their future ever sees it. `grep domainTags apps/web/src` shows the wizard is the only
consumer.

**Fix.** Add `domainTags: string[]` to both experience types and render them as chips
under each role. ~2h. CONFIRMED.

---

### M7 · MEDIUM · The candidate job search is the one search that wasn't debounced

`apps/web/src/pages/candidate/browse-jobs.tsx:102-107`

```tsx
<Input value={filters.search} onChange={(e) => set('search', e.target.value)} ... />
```
→ `filters` → `useBrowseJobs(filters, page)` → `queryKey: ['candidate','jobs', qs]`.
A new key and a new request on every keystroke.

`grep useDebounced apps/web/src` returns five call sites, all admin:
`recommend.tsx:45`, `job-queue.tsx:42`, `employer-queue.tsx:38`,
`candidate-queue.tsx:45`, `skills.tsx:30`.

`use-debounced.ts:4-9` justifies itself with *"On a mid-range Android on a patchy
connection that is slower than not searching at all"* — and the only screen where that
user actually is didn't get it. Typing "maintenance engineer" from `/candidate/jobs` is
still ~21 round trips.

**Fix.** Same three lines as the five admin screens. 20 min. CONFIRMED.

---

### M8 · MEDIUM · Internal enums shown to candidates, employers and admins

Five places show the raw enum where a label map already exists:

| File:line | Renders | Audience sees |
|---|---|---|
| `employer/applicants.tsx:240` | `applicant.stage.replace(/_/g,' ').toLowerCase()` | "interview scheduled", "offer made", "under review" |
| `candidate/applications.tsx:229` | `event.toStage.replace(/_/g,' ').toLowerCase()` | "not selected", "interview scheduled" in their History |
| `portal-home.tsx:88` and `:122` | `status.replace('_',' ').toLowerCase()` | "changes requested", "submitted", "pending approval" |
| `components/review-panel.tsx:129` | `currentStatus.replace('_',' ').toLowerCase()` | admin: "Reviewing a record currently marked 'submitted'" |
| `admin/pipeline.tsx:242` | `<span className="font-mono">{a.stage...}</span>` | a monospace raw stage next to the badge that already says it |

Two of these directly contradict their own file headers. `applicants.tsx:5` — *"Grouped
into the four buckets the contract showed employers … rather than the eleven internal
stages."* `applications.tsx:4-7` — *"uses the contract's exact wording … rather than the
internal eleven-value stage enum."* `packages/shared/src/stages.ts:190-193` says the same
thing a third time. `EMPLOYER_BUCKET_OF` exists in shared and is imported by no web file;
`CANDIDATE_STAGE_LABEL`, `REVIEW_STATUS_LABEL` and `JOB_STATUS_LABEL` all exist.

For a premium managed service, "changes requested" as a status pill is the sort of detail
that reads as unfinished. ~2h to fix all five. CONFIRMED.

---

### M9 · MEDIUM · Every row's button spins when one row is acted on

- `admin/recommend.tsx:134` — `isPending={recommend.isPending}`: clicking "Put them
  forward" on one candidate spins all twenty buttons.
- `admin/erasure.tsx:109` — `isPending={execute.isPending || reject.isPending}`.
- `admin/enquiries.tsx:90` — `loading={mark.isPending}`.

`pipeline.tsx:179` and `applicants.tsx:175-177` both got the correct guard in the recent
round, with a comment (`pipeline.tsx:176-178`) explaining exactly why: *"A page-level flag
spun the buttons on all twenty cards and gave no clue which one was being acted on."*
Three lists were missed.

**Fix.** `mutation.variables?.id === row.id`, as in the two that were fixed. ~1h.
CONFIRMED.

---

### M10 · MEDIUM · Row-level failures reported at the top of the page

`pipeline.tsx:128`, `applicants.tsx:136`, `erasure.tsx:78`, `skills.tsx:51`,
`enquiries.tsx:40`, `taxonomy.tsx:83` all render the mutation error above the list.

**What the user experiences.** An admin scrolls to applicant fifteen, clicks "Shortlist",
it 409s, and the explanation appears a screen and a half above them. From their point of
view the button did nothing. This is the same failure the wizard fixed with `errorRef`
and `scrollIntoView` (`profile-wizard.tsx:125-127`) — the pattern exists in the codebase
and wasn't reused. ~3h. CONFIRMED.

---

### M11 · MEDIUM · Field hints are invisible to screen readers

`apps/web/src/components/ui/index.tsx:79,114-115,129-130,158-159`

```tsx
{hint && <p className="mt-0.5 text-xs text-slate-500">{hint}</p>}   // no id
...
aria-describedby={invalid ? `${props.id}-error` : undefined}        // error only
```

The hint has no `id` and is never referenced. `aria-describedby` is set only when
`invalid` is true, and only to the error. So a screen-reader user filling the wizard
never hears "Choose a state first", "In lakhs per annum", "Comma-separated — e.g.
rotating equipment, HAZOP, tech transfer", or "At least 3. These are what we match
candidates on" — several of which are the only explanation of what the field wants.

**Fix.** Give the hint `id={`${htmlFor}-hint`}` and compose
`aria-describedby` from hint + error. ~2h across the primitives. CONFIRMED.

---

### M12 · MEDIUM · `MutationFeedback` mounts its live region and its content at the same moment

`apps/web/src/components/mutation-feedback.tsx:39-51` (same shape in `ui/index.tsx:193`)

```tsx
if (!error && !showSuccess) return null;
return (
  <div aria-live="polite" className="mt-3">
    {error ? <Alert tone="error">…</Alert> : <Alert tone="success">…</Alert>}
  </div>
);
```

Assistive technology generally announces *changes inside an existing* live region.
Inserting the region and its text in the same commit is the classic case where nothing is
announced. The component's whole stated purpose (line 11) is *"so it is announced rather
than only drawn"* — which is the one thing this shape can't guarantee.

**Fix.** Render the wrapper unconditionally and put the conditional inside it. 10 min.
PLAUSIBLE — the mechanism is well documented but I could not run a screen reader here.

---

### M13 · MEDIUM · No inline field errors in either of the two large forms

`profile-wizard.tsx` and `job-editor.tsx` pass no `error` or `invalid` to any `Field` /
`Input`, so every server validation failure is one alert at the top of a long form. The
`Field` primitive supports it (`ui/index.tsx:81-85`) and the auth forms use it correctly
(`login.tsx:39-48`, `register-candidate.tsx:41-61`).

Combined with H3 this is why an incomplete profile is so hard to fix: eighteen messages
in one box, no field markers, no step markers. ~4h. CONFIRMED.

---

### Low severity

| # | Finding | Location |
|---|---|---|
| L1 | `useCandidateDetail` and `useApplicationInterviews` are dead code — the first is the fix for H2 | `use-admin.ts:146`, `use-coordination.ts:42` |
| L2 | Employer stage transitions hand-written client-side, duplicating the D4 matrix that `stages.ts:6-7` explicitly forbids duplicating; the API already returns `availableStages`. Matches the matrix today | `applicants.tsx:211-224` vs `employer-applicants.routes.ts:132,185` |
| L3 | `Applicant.bucket` is fetched and never used | `applicants.tsx:55` |
| L4 | `void submitNew()` and `onClick={signOut}` are floating promises: a failed sign-out says nothing at all and logs an unhandled rejection | `job-list.tsx:96,103`, `portal-layout.tsx:60,103` |
| L5 | "Move it" opens a blank "Arrange an interview" dialog — no prefill of the existing time/duration/mode/location, wrong heading, and the API's `rescheduled` flag is unused. The admin retypes the meeting link from memory | `coordination.tsx:80-88,272-273`; `use-coordination.ts:63` |
| L6 | `aria-current="page"` on the "{page} of {n}" status text | `pagination.tsx:56` |
| L7 | `pb-safe` can never exceed 1rem: `index.html` has no `viewport-fit=cover`, so `env(safe-area-inset-bottom)` is always 0 | `styles.css:88`, `apps/web/index.html:5` |
| L8 | The bell panel is `role="dialog"` with no `aria-modal`, no focus move in, no focus restore — while `modal.tsx:6-8` cites it as the component that "got this right" | `notification-bell.tsx:92-101` |
| L9 | `markRead` / `markAllRead` failures are silent | `use-notifications.ts:47-65` |
| L10 | MergeDialog's own search is not debounced (the page's is) | `skills.tsx:237` |
| L11 | A failed close-impact query renders "Checking how many applicants this affects…" forever, above a live "Close the posting" button | `job-editor.tsx:209-216` |
| L12 | `body { overflow-x: hidden }` conceals overflow rather than surfacing it, and makes the body the scroll container for the sticky header | `styles.css:41` |
| L13 | No skip-to-content link in any layout | `portal-layout.tsx`, `root-layout.tsx` |
| L14 | Adding/removing a skill chip produces no announcement; `aria-controls` points at an id that doesn't exist while the listbox is closed | `skills-input.tsx:93-112,132` |
| L15 | `qualificationYear` input has `min={1960}` and no `max`, while the schema caps at `currentYear + 6` — a 400 for something the control invited | `profile-wizard.tsx:534-542` vs `schemas/candidate.ts:73` |
| L16 | An admin can pick an outcome reason for NOT_SELECTED but cannot attach a note, though the route accepts one and the timeline renders notes | `pipeline.tsx:269-302` vs `admin-pipeline.routes.ts:108` |

---

## Do the recent changes hold?

Verified a sample of each; none of the previously-reported findings recur.

| Change | Holds? | Notes |
|---|---|---|
| Four pages moved to `QueryState` | **Partly** | `profile-wizard.tsx:173`, `job-editor.tsx:144`, `company-profile.tsx:100`, `job-detail.tsx:33` are all correct, including the subtle `isPending \|\| error \|\| !data` guard and the 404-vs-500 split in `job-detail.tsx:32`. But `recommend.tsx` (H4) still has a permanent skeleton, `pipeline.tsx` (M4) still has an unhandled detail error, and `job-editor.tsx:209` (L11) still has a "Checking…" that never resolves. |
| Admin dashboard no longer claims "nothing is waiting" on failure | **Yes** | `dashboard.tsx:26-32` reads `error` and offers a retry. Clean fix. |
| Review panels keyed by record | **Yes** | `key={selected.id}` on all three queue detail wrappers (`candidate-queue.tsx:135`, `employer-queue.tsx:120`, `job-queue.tsx:129`). Verified the panel's `decision`/`note` state resets. |
| Six silent mutations get `MutationFeedback` | **5 of 6, plus one new gap** | withdraw, decline, candidate confirm-interview, close, reopen all covered. The **employer's** confirm-interview — the mirror of one of the six — is still silent (M1). |
| Notification deep links resolve; interview requests route to `/admin/coordination` | **Half** | The coordination special-case is correct and verified (`use-notifications.ts:90-94`; `EMPLOYER_INTERVIEW_REQUESTED` recipients are ADMIN). But the `?focus=` links do not reach the record (H2), and the employer's APPLICATION/INTERVIEW links dead-end (M5). |
| Searches debounced | **5 of 6** | All five admin screens. The candidate-facing one was missed (M7), plus the merge dialog (L10). |
| Two modals replaced with accessible `Modal` | **Yes** | `modal.tsx` has a real focus trap, Escape, backdrop-only close via `onMouseDown` target check, scroll lock and focus restore. Used correctly in `coordination.tsx:272` and `skills.tsx:243`. Good component. |
| Employer applicant list: pagination + Interview/Offer tabs | **Yes** | `applicants.tsx:97-111,138-157`, page resets on filter change (line 145), counts keyed by stage and confirmed to match the repo's `countByStage`. |
| Multi-select → checkboxes | **Yes** | `company-profile.tsx:186-233`. `min-h-11` rows, keyboard-navigable, limit enforced and shown. Genuinely better. |
| Skills field → ARIA combobox | **Mostly** | `skills-input.tsx:130-136` — `role="combobox"`, arrow keys, `aria-activedescendant`, `aria-selected` all correct, and the `id` prop fixes the duplicate-label problem in the job editor. Gaps at L14. |
| `OFFER_MADE`/`JOINED` explicit copy | **Yes** | `CANDIDATE_STAGE_MESSAGE` in `stages.ts:229-260` and rendered at `applications.tsx:160-175`. The offer copy is well written. |
| Account controls + salary-vs-band panel | **Yes** | `account-controls.tsx` and `pipeline.tsx:385-437`. Both surface errors, both are labelled admin-only. The temporary-password "shown once" flow is handled well. |
| `domainTags` input | **Half** | Captured and stored correctly; displayed to nobody (M6). |
| `/status` and `/system` excluded from production | **Broken by a leftover link** | Route exclusion correct; `landing.tsx:68` still links to `/status` (H1). |

---

## Journey walkthroughs

### Empty DRAFT profile → submit (stand-in for `fatima.shaikh@demo.in`)

Registered `audit.ux1@demo.in`. `/candidate` opens on "Finish your profile" with a clear
four-step explanation and the salary-privacy promise — good. `/candidate/jobs` correctly
shows the DRAFT gate ("Finish your profile to see roles"), not the generic "still being
reviewed". The wizard opens at 0%, `StatusBanner` renders nothing for DRAFT (fine).

Steps 1-4 are well built: state narrows the city list and clears a stale city
(`profile-wizard.tsx:405-411`), the salary lock note sits exactly where hesitation
happens, the character counter turns amber below the minimum, the LPA echo in rupees
kills a real ambiguity.

Two things break it. Tapping a stepper number instead of "Save and continue" silently
discards the step (**H5**). And on step 5, "Submit for review" returns the eighteen-item
list with five bare "Required" bullets and no indication of which step or field
(**H3**) — verified against the live API. A first-time candidate has no path from that
message to a complete profile except trial and error.

The CV upload is the other rough edge: `hasResume` is required, but nothing in steps 1-4
signals that step 5 will demand a file. On a phone, discovering that only at the end is
where people abandon.

### `neha.gupta@zydus.demo.in` — unverified employer

This one is solid, and it's the best-handled state in the app. Verified end to end:

- `/employer` → amber badge and "Your account is awaiting verification. Our team verifies
  every company before any job posting can be created."
- `/employer/jobs` → the "+ New posting" button is not rendered
  (`job-list.tsx:65`), a warning banner explains why, and the empty state says "You can
  post roles once your company is verified."
- `POST /api/employer/jobs` → 403 with the same sentence, so the guard is real.
- `/employer/company` → "Awaiting verification", and the "Send for verification" CTA is
  correctly hidden for SUBMITTED (it appears only for DRAFT / CHANGES_REQUESTED).

She is told why, consistently, on three screens. Two nits: the badge on `/employer` reads
"submitted" (raw enum, **M8**) where every other screen would say "Under review", and
nothing tells her how long verification takes or gives her a way to chase it.

### CHANGES_REQUESTED candidate (stand-in for `sameer.joshi@demo.in`)

Traced by code — the account no longer exists in the drifted dataset.

The path works. `/candidate` shows "A few changes needed → Open your profile to see what
they need"; `/candidate/jobs` shows the CHANGES_REQUESTED gate with "See what's needed →";
the wizard's `StatusBanner` (`profile-wizard.tsx:339-344`) prints the reviewer's note in
full at the top, `locked` is false so he can edit, and the "Submit for review" button is
present because the gate is `!locked && !approved`. `ReviewPanel` requires the reviewer
to write ≥5 characters for REQUEST_CHANGES, so the note is never empty.

The weakness is precision: the note is prose at the top of a five-step wizard with no
pointer to the step or field it refers to. "Could you add your two most recent roles and
expand the summary?" spans steps 3 and 4 and he has to find them. And if his resubmit
still fails validation he lands in **H3** with the rest.

### An admin's daily loop

**Review a candidate.** `/admin/candidates` opens on "Awaiting review". The two-pane
layout is right, the detail is complete (contact, salary in an amber admin-only box, CV
download, completion %, consent date), `expectedStatus` gives real optimistic-concurrency
with a "Someone else got there first" message. Then `submitReview`'s
`onSuccess: () => setSelectedId(null)` (`candidate-queue.tsx:58`) drops them back to
"Select a record to review it." Reviewing thirty profiles means thirty extra clicks and
thirty scroll-position losses. Auto-advancing to the next record is the single highest-value
change on this screen.

**Approve a job.** `/admin/jobs` is the strongest screen in the product. Contact flags are
surfaced twice, the salary band is boxed and labelled, and "Find candidates to put
forward" appears only once the posting is live. No complaints.

**Move someone through the pipeline.** Buttons come from the server's `availableStages`,
`SHORTLISTED` correctly redirects to Interviews, the salary-fit panel is genuinely the one
comparison only BK can make, and the reason code is required for NOT_SELECTED. But a
failed detail fetch says the application is over (**M4**), errors appear at the top of a
long list (**M10**), and there is a redundant `font-mono` raw enum on every card
(**M8**).

**Arrange an interview.** `/admin/coordination` is well shaped — "Waiting on you" then
"Coming up", both confirmation states as separate badges, the IST preview echoed before
saving. "Move it" is the flaw: it reopens a completely blank form (**L5**), so
rescheduling means retyping the meeting link.

**Handle an erasure request.** `/admin/erasure` is the right amount of blunt: type ERASE,
a required ≥10-character reason to refuse, "This cannot be undone" spelled out. Only
gripe is that all cards' buttons spin together (**M9**).

**Getting there from the bell.** This is where the loop breaks. Every "New candidate
registered", "New application", "Offer made" and "not taken forward" notification routes
to `?focus=<id>` and, at the current dataset size, lands on an unfocused list with the
default filter removed (**H2**). The bell is BK's only notification channel in Phase 1 —
`notification-bell.tsx:3-5` says so — which makes this the most consequential finding in
the report.

### The bell, per role

- **Admin.** Panel opens correctly, doesn't mark-all-read on a glance (a good decision),
  unread dot plus bold weight rather than colour alone, Escape and click-outside work.
  Interview requests → `/admin/coordination` ✓. Everything else → an unfocused list
  (**H2**).
- **Candidate.** All routes land somewhere useful: profile events → `/candidate/profile`,
  application and interview events → `/candidate/applications`. "Profile approved" going
  to the profile rather than to the newly-unlocked job list is a small missed moment.
- **Employer.** Job events → `/employer/jobs/:id` ✓. Application and interview events →
  `/employer/jobs`, a generic list (**M5**).

---

## Responsive

Checked at 360 / 768 / 1440 by reading the layout code; no horizontal-overflow source
found beyond what `body { overflow-x: hidden }` is masking (L12).

**Good.** `min-h-11` (44px) on `Button`, `Input`, the hamburger, the bell, filter pills
and stepper buttons. `text-base sm:text-sm` on every control with an explicit comment
about iOS zoom. Filter rows use `-mx-1 … overflow-x-auto` rather than wrapping into a
tall block. The queue shell collapses to a single pane with a back link below `lg`. The
bell panel goes `fixed inset-x-2` on a phone instead of a 22rem dropdown hanging off the
right edge. `Modal` is a bottom sheet under `sm`. All deliberate, all correct.

**Weaker.** The candidate timeline puts five labels into five `flex-1` columns at
`text-[11px]` — at 360px "Under Review" and "Shortlisted" wrap to two lines and the
progress bar reads cramped. The `Alert` action rows inside `<p>` copy blocks
(`applications.tsx:131-146`) push a 44px button into a paragraph of text at narrow
widths. Neither is broken, both are tight.

---

## Enhancements worth paying for

Ordered by value per hour, with the bugs above assumed fixed separately.

| # | Enhancement | Why it pays | Est. |
|---|---|---|---|
| 1 | **Auto-advance the review queues.** After a decision, select the next record in the list instead of clearing the selection, and show a small "Approved Anita Desai · undo" toast. | BK's staff live here daily. At thirty profiles a session this removes ~60 interactions and the constant loss of scroll position. Pairs with the H2 fix to make the queue a genuine work surface. | 4h |
| 2 | **Keyboard review shortcuts** — `J`/`K` to move, `A` approve, `C` request changes, `/` focus search, with a `?` overlay. | Turns the highest-frequency admin screen from a mouse task into a keyboard task. Standard in every review tool; BK's staff are non-technical but they are repetitive-task users, which is exactly who this helps. | 8h |
| 3 | **Autosave the wizard** on step change and on blur, with a quiet "Saved" marker and a restore-from-draft prompt. | Directly fixes H5 and removes the single largest abandonment risk in the candidate funnel. A candidate who loses step 3 twice does not come back. | 6h |
| 4 | **Per-step completeness in the stepper** — a green tick or an amber count on each step, computed from `PROFILE_STEPS[].fields` and the submit schema, shown from the moment the wizard opens. | Fixes the other half of H3: the candidate knows what is missing before they hit Submit, not after. Uses constants that already exist in `packages/shared`. | 5h |
| 5 | **Prefill the reschedule dialog** and retitle it "Move the interview with {name}", showing the current booking above the form. | Removes retyping a meeting link from memory on the screen where a mistake means somebody misses an interview. | 3h |
| 6 | **Filter and page state in the URL** across all list screens (currently only `status` on the three queues). | Makes every admin view shareable and survivable across a refresh — "look at this one" between BK staff currently means describing it. Also the prerequisite for a correct H2 fix. | 5h |
| 7 | **A "recently reviewed" strip** on the candidate/employer queues — the last ten decisions with a one-click reopen. | The 24-hour NOT_SELECTED reversal window already exists server-side (`stages.ts:39`) and no screen exposes it. A mis-click currently needs an SSH session. | 6h |
| 8 | **Show `domainTags` and a matched-skill count on the employer applicant card.** | Fixes M6 and gives the employer the one signal that justifies the intermediation — "8 of 10 required skills" is already computed for the recommend screen. | 4h |
| 9 | **A "what happens next / typical timeline" line on every waiting state** — candidate SUBMITTED, employer SUBMITTED, job PENDING_APPROVAL. | Three screens currently say "shortly" or "usually within a working day" inconsistently. A managed service is sold on knowing where you stand; this is the cheapest trust purchase available. | 3h |
| 10 | **Inline field errors + scroll-to-first-error** on the wizard and the job editor. | Fixes M13. The `Field` primitive already supports it; this is wiring, not design. | 4h |

Not recommended: a redesign, a Kanban board for the employer (the list works and Phase 2
already scopes it), or anything AI-shaped.

---

## Score: 6.5 / 10

**Why it is above average.** The information architecture is genuinely thought through.
The privacy boundaries are stated on the screen where the user is anxious rather than
buried in a policy. `Modal`, `QueryState`, `Pagination`, `queue-shell` and the checkbox
location picker are all good, reusable work. The copy is mostly excellent — "Employers
can shortlist. Everything after that is yours", "A deliberate speed bump, not a
formality", the offer message — and the code comments show someone reasoning about real
users on real phones. Touch targets, iOS zoom and reduced-motion are handled properly
throughout, which is rare.

**Why it is not higher.** The last round of fixes was applied screen by screen rather than
pattern by pattern, so the codebase now contains matched pairs where one half is fixed and
the other is not: candidate confirm-interview vs employer confirm-interview; five debounced
searches vs the one the comment was written for; two per-row pending guards vs three
page-level ones; two hooks that invalidate `/auth/me` vs one that doesn't. That is a
process problem as much as a code one, and it means each future audit will keep finding
the same class of bug in a new place. On top of that, the flagship fix — notification deep
links — is verifiably broken at the dataset size the client will reach within weeks, and
the public front door ships a link that 404s.

**What moves it to 8.** Fix H1-H5 and M1-M6 (roughly two days), then adopt the rule that a
fix lands on every instance of the pattern, verified by grep, before it is called done.
Add enhancements 1, 3 and 4 and the two daily-use surfaces — the review queue and the
profile wizard — become genuinely good rather than merely correct. Getting past 8 would
need the accessibility work in M11/M12/L13/L14 and a real screen-reader pass, which
nothing in the current code suggests has happened.
