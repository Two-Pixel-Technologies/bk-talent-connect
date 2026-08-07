/**
 * The candidate profile builder.
 *
 * Five steps, saved on advance rather than per keystroke. Design decisions
 * worth keeping:
 *
 *   - Salary carries a visible lock and an explicit "never shown to employers"
 *     line. Candidates hesitate here, and the proposal makes this a hard
 *     privacy guarantee, so the interface should say so where they are asked.
 *   - After approval, material edits are flagged BEFORE saving, because the
 *     consequence (going back into review, losing job access) is not something
 *     to discover afterwards.
 *   - The review note from our team is shown in full at the top when changes
 *     are requested — that message is the whole point of the state.
 */

import { useEffect, useMemo, useRef, useState } from 'react';
import {
  EDUCATION_LEVELS,
  EDUCATION_LABELS,
  EMPLOYMENT_PREFERENCES,
  NOTICE_PERIODS,
  NOTICE_PERIOD_LABELS,
  INDIAN_STATES,
  LIMITS,
  PROFILE_STEPS,
  formatSalary,
  isMaterialField,
  type UpdateProfileInput,
} from '@bktc/shared';
import { ApiError } from '../../lib/api-client.js';
import {
  useProfile,
  useTaxonomy,
  useUpdateProfile,
  useSubmitProfile,
  useUploadResume,
  type CandidateProfile,
  type Taxonomy,
} from '../../features/candidate/use-profile.js';
import { diffProfile, draftFromProfile } from '../../features/candidate/profile-diff.js';
import { SkillsInput } from '../../components/skills-input.js';
import { QueryState } from '../../components/query-state.js';
import { Alert, Badge, Button, Card, Field, Input, Select, Textarea } from '../../components/ui/index.js';

type Draft = UpdateProfileInput;

const EMPLOYMENT_LABELS: Record<string, string> = {
  FULL_TIME: 'Full-time',
  CONTRACT: 'Contract',
  BOTH: 'Open to both',
};

/**
 * Turns a zod path into something a person recognises.
 *
 * Server messages arrive as bare strings — "String must contain at least 2
 * character(s)" — with the field only in `path`, which the wizard discarded.
 * Two identical developer sentences with no indication of which field is not
 * an error message, it is a puzzle.
 */
const FIELD_LABELS: Record<string, string> = {
  fullName: 'Full name',
  mobile: 'Mobile',
  citySlug: 'City',
  state: 'State',
  currentJobTitle: 'Current job title',
  currentEmployer: 'Current employer',
  yearsOfExperience: 'Years of experience',
  sectorSlug: 'Sector',
  functionSlug: 'Function',
  educationLevel: 'Education level',
  qualification: 'Qualification',
  qualificationYear: 'Year of qualification',
  careerSummary: 'Career summary',
  noticePeriod: 'Notice period',
  employmentPreference: 'Employment preference',
  currentSalaryLpa: 'Current salary',
  expectedSalaryMinLpa: 'Expected salary (minimum)',
  expectedSalaryMaxLpa: 'Expected salary (maximum)',
  linkedinUrl: 'LinkedIn',
  skills: 'Skills',
  company: 'Company',
  title: 'Job title',
  startYear: 'Start year',
  endYear: 'End year',
  keyAchievement: 'Key achievement',
  // Submit-time checks report on counts and presence rather than the field
  // itself, so these paths only ever appear on the submit error surface.
  skillCount: 'Skills',
  experienceCount: 'Career history',
  hasResume: 'CV',
  openToRelocation: 'Open to relocation',
};

function fieldLabel(path: string): string {
  // Paths look like `experiences.0.company` for repeated rows.
  const parts = path.split('.');
  const leaf = parts[parts.length - 1] ?? path;
  const label = FIELD_LABELS[leaf] ?? leaf;

  if (parts[0] === 'experiences' && parts.length === 3) {
    return `Role ${Number(parts[1]) + 1} — ${label}: `;
  }
  return `${label}: `;
}

export function ProfileWizardPage() {
  const { data: profile, isPending, error: loadError, refetch } = useProfile();
  const { data: taxonomy } = useTaxonomy();
  const update = useUpdateProfile();
  const submit = useSubmitProfile();

  const [stepIndex, setStepIndex] = useState(0);
  const errorRef = useRef<HTMLDivElement>(null);
  const [draft, setDraft] = useState<Draft>({});
  const [confirmMaterial, setConfirmMaterial] = useState<string[] | null>(null);

  // Seed the draft once the profile arrives. Keyed on id so a refetch after a
  // save does not discard edits the candidate is part-way through typing.
  useEffect(() => {
    if (profile) setDraft(draftFromProfile(profile));
  }, [profile?.id]);

  const locked = profile?.profileStatus === 'SUBMITTED';
  const approved = profile?.profileStatus === 'APPROVED';
  const step = PROFILE_STEPS[stepIndex]!;
  const error = update.error instanceof ApiError ? update.error : null;

  // Bring the message to the user rather than expecting them to find it.
  useEffect(() => {
    if (error) errorRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }, [error]);

  /**
   * Only what actually changed is sent. The server decides re-approval from
   * which fields are present in the patch, so posting the whole draft would
   * send an approved candidate back into review for correcting a phone number.
   */
  const { patch, changedFields } = useMemo(
    () => (profile ? diffProfile(draft, profile) : { patch: {}, changedFields: [] }),
    [draft, profile],
  );

  const materialChanges = changedFields.filter(isMaterialField);
  const hasChanges = changedFields.length > 0;

  async function save(): Promise<boolean> {
    // Nothing to send — treat as success so "Save and continue" still advances.
    if (!hasChanges) {
      setConfirmMaterial(null);
      return true;
    }
    // Warn before, not after: going back into review costs job access.
    if (approved && materialChanges.length > 0 && confirmMaterial === null) {
      setConfirmMaterial(materialChanges);
      return false;
    }
    setConfirmMaterial(null);
    try {
      await update.mutateAsync(patch);
      return true;
    } catch {
      return false;
    }
  }

  async function next() {
    if (await save()) setStepIndex((i) => Math.min(i + 1, PROFILE_STEPS.length - 1));
  }

  /*
   * An errored query is `isPending: false, data: undefined` in TanStack v5, so
   * `isPending || !profile` swallowed every failure into the loading branch —
   * an expired session or a dropped connection left a permanent spinner with
   * no message and no retry. This is a candidate's main screen; on a patchy
   * mobile connection it was the most likely thing they ever saw.
   */
  if (isPending || loadError || !profile) {
    return (
      <QueryState
        isPending={isPending}
        error={loadError ?? (profile ? null : new Error('Profile unavailable'))}
        onRetry={() => void refetch()}
        loadingLabel="Loading your profile…"
      >
        <span />
      </QueryState>
    );
  }

  const set = <K extends keyof Draft>(key: K, value: Draft[K]) =>
    setDraft((d) => ({ ...d, [key]: value }));

  return (
    <div className="space-y-6">
      <StatusBanner profile={profile} />

      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-brand-900">Your profile</h1>
          <p className="mt-1 text-sm text-slate-600">
            This is what our team reviews, and what employers see once you apply.
          </p>
        </div>
        <div className="sm:text-right">
          <p className="text-sm font-medium text-slate-700">{profile.completionPercent}% complete</p>
          <div className="mt-1.5 h-2 w-full overflow-hidden rounded-full bg-slate-200 sm:w-40">
            <div
              className="h-full rounded-full bg-brand-600 transition-all"
              style={{ width: `${profile.completionPercent}%` }}
            />
          </div>
        </div>
      </div>

      <Stepper current={stepIndex} onSelect={setStepIndex} />

      {/*
        * Scrolled into view and focused.
        *
        * The alert renders above the form, so on a phone at the bottom of step
        * 3 pressing "Save and continue" produced no visible change at all —
        * next() returned false and the message was a screen and a half up.
        */}
      {error && (
        <div ref={errorRef}>
        <Alert tone="error" title={error.message}>
          {error.fields.length > 0 && (
            <ul className="mt-1 list-inside list-disc">
              {error.fields.map((f) => (
                <li key={f.path}>
                  <span className="font-medium">{fieldLabel(f.path)}</span>
                  {f.message}
                </li>
              ))}
            </ul>
          )}
        </Alert>
        </div>
      )}

      {confirmMaterial && (
        <Alert tone="warning" title="These changes need a fresh review">
          <p>
            You&rsquo;ve changed {confirmMaterial.join(', ')}. Because our team already approved your
            profile, saving this puts it back into review and pauses job browsing until we approve
            it again — usually within a day.
          </p>
          <div className="mt-3 flex gap-2">
            <Button onClick={() => void save()} loading={update.isPending}>
              Save and resubmit
            </Button>
            <Button variant="secondary" onClick={() => setConfirmMaterial(null)}>
              Keep editing
            </Button>
          </div>
        </Alert>
      )}

      <Card>
        <fieldset disabled={locked} className="space-y-5">
          {locked && (
            <p className="text-sm text-slate-500">
              Your profile is locked while our team reviews it.
            </p>
          )}

          {step.id === 'basic' && (
            <BasicStep draft={draft} set={set} taxonomy={taxonomy} />
          )}
          {step.id === 'professional' && (
            <ProfessionalStep draft={draft} set={set} taxonomy={taxonomy} locked={locked} />
          )}
          {step.id === 'history' && <HistoryStep draft={draft} set={set} />}
          {step.id === 'summary' && <SummaryStep draft={draft} set={set} />}
          {step.id === 'salary' && <SalaryStep draft={draft} set={set} profile={profile} />}
        </fieldset>

        <div className="mt-8 flex flex-col gap-3 border-t border-slate-100 pt-5 sm:flex-row sm:items-center sm:justify-between">
          <Button
            variant="ghost"
            disabled={stepIndex === 0}
            onClick={() => setStepIndex((i) => i - 1)}
          >
            ← Back
          </Button>

          <div className="flex flex-col gap-2 sm:flex-row">
            {!locked && (
              <Button variant="secondary" onClick={() => void save()} loading={update.isPending}>
                Save
              </Button>
            )}
            {stepIndex < PROFILE_STEPS.length - 1 ? (
              <Button onClick={() => void next()} loading={update.isPending}>
                Save and continue →
              </Button>
            ) : (
              !locked &&
              !approved && (
                <Button
                  onClick={async () => {
                    if (await save()) submit.mutate();
                  }}
                  loading={submit.isPending || update.isPending}
                >
                  Submit for review
                </Button>
              )
            )}
          </div>
        </div>

        {submit.error instanceof ApiError && (
          <div className="mt-4">
            <Alert tone="error" title={submit.error.message}>
              {/* Same labelling as the save errors above. Without it, submitting
                  an empty profile produced a list of bare "Required" bullets
                  with no indication of which of five steps each belonged to. */}
              <ul className="mt-1 list-inside list-disc">
                {submit.error.fields.map((f) => (
                  <li key={f.path}>
                    <span className="font-medium">{fieldLabel(f.path)}</span>
                    {f.message}
                  </li>
                ))}
              </ul>
            </Alert>
          </div>
        )}
      </Card>
    </div>
  );
}

function StatusBanner({ profile }: { profile: CandidateProfile }) {
  switch (profile.profileStatus) {
    case 'SUBMITTED':
      return (
        <Alert tone="warning" title="Under review">
          Our team is reviewing your profile. We usually get to it within a working day.
        </Alert>
      );
    case 'APPROVED':
      return (
        <Alert tone="success" title="Approved">
          Your profile is live with our team. You can browse and apply to open roles.
        </Alert>
      );
    case 'CHANGES_REQUESTED':
      return (
        <Alert tone="warning" title="We&rsquo;ve asked for a few changes">
          {profile.reviewNote ?? 'Please review your profile and resubmit.'}
        </Alert>
      );
    case 'REJECTED':
      return (
        <Alert tone="error" title="Profile not approved">
          {profile.reviewNote ?? 'Please contact the BK Talent Connect team.'}
        </Alert>
      );
    default:
      return null;
  }
}

function Stepper({ current, onSelect }: { current: number; onSelect: (i: number) => void }) {
  return (
    <nav aria-label="Profile steps">
      <ol className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1 sm:flex-wrap sm:overflow-visible">
        {PROFILE_STEPS.map((step, index) => {
          const active = index === current;
          return (
            <li key={step.id}>
              <button
                type="button"
                onClick={() => onSelect(index)}
                aria-current={active ? 'step' : undefined}
                className={`min-h-11 shrink-0 rounded-lg px-3 py-2 text-sm font-medium whitespace-nowrap transition-colors ${
                  active ? 'bg-brand-600 text-white' : 'bg-white text-slate-600 hover:bg-slate-100'
                }`}
              >
                <span className="mr-1.5 opacity-60">{index + 1}</span>
                {step.label}
              </button>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}

type StepProps = {
  draft: Draft;
  set: <K extends keyof Draft>(key: K, value: Draft[K]) => void;
  taxonomy?: Taxonomy | undefined;
  locked?: boolean;
  profile?: CandidateProfile;
};

function BasicStep({ draft, set, taxonomy }: StepProps) {
  const selectedState = draft.state ?? '';

  // Cities are filtered by the chosen state. "Other" carries no state and is
  // offered everywhere, because no list covers industrial India exhaustively.
  const citiesForState = (taxonomy?.cities ?? []).filter(
    (c) => c.state === selectedState || c.state === null,
  );

  /**
   * Changing the state clears a city that no longer belongs to it. Leaving the
   * old value would let someone save "Pune, Kerala" — which is what happens
   * today and is exactly the bug this fixes.
   */
  function onStateChange(nextState: string) {
    set('state', nextState);
    const stillValid = (taxonomy?.cities ?? []).some(
      (c) => c.slug === draft.citySlug && (c.state === nextState || c.state === null),
    );
    if (!stillValid) set('citySlug', '');
  }

  return (
    <>
      <Field label="Full name" htmlFor="fullName" required>
        <Input id="fullName" value={draft.fullName ?? ''} onChange={(e) => set('fullName', e.target.value)} />
      </Field>

      <Field label="Mobile number" htmlFor="mobile" required>
        <Input
          id="mobile"
          type="tel"
          inputMode="tel"
          autoComplete="tel"
          value={draft.mobile ?? ''}
          onChange={(e) => set('mobile', e.target.value)}
        />
      </Field>

      {/* State first: it narrows the city list, so asking for it first is the
          order the form actually works in. */}
      <div className="grid gap-5 sm:grid-cols-2">
        <Field label="State" htmlFor="state" required>
          <Select id="state" value={selectedState} onChange={(e) => onStateChange(e.target.value)}>
            <option value="">Select a state</option>
            {(taxonomy?.states ?? INDIAN_STATES).map((s) => (
              <option key={s} value={s}>{s}</option>
            ))}
          </Select>
        </Field>

        <Field
          label="City"
          htmlFor="citySlug"
          required
          hint={selectedState ? undefined : 'Choose a state first'}
        >
          <Select
            id="citySlug"
            value={draft.citySlug ?? ''}
            disabled={!selectedState}
            onChange={(e) => set('citySlug', e.target.value)}
          >
            <option value="">{selectedState ? 'Select a city' : '—'}</option>
            {citiesForState.map((c) => (
              <option key={c.slug} value={c.slug}>{c.name}</option>
            ))}
          </Select>
        </Field>
      </div>

      <label className="flex items-start gap-3 rounded-lg border border-slate-200 bg-slate-50 p-4">
        <input
          type="checkbox"
          checked={draft.openToRelocation ?? false}
          onChange={(e) => set('openToRelocation', e.target.checked)}
          className="mt-0.5 size-4 rounded border-slate-300"
        />
        <span className="text-sm text-slate-700">
          I&rsquo;m open to relocating
          <span className="mt-0.5 block text-xs text-slate-500">
            This widens the roles we can put you forward for considerably.
          </span>
        </span>
      </label>
    </>
  );
}

function ProfessionalStep({ draft, set, taxonomy, locked }: StepProps) {
  return (
    <>
      <div className="grid gap-5 sm:grid-cols-2">
        <Field label="Current job title" htmlFor="currentJobTitle" required>
          <Input id="currentJobTitle" value={draft.currentJobTitle ?? ''} onChange={(e) => set('currentJobTitle', e.target.value)} />
        </Field>
        <Field label="Current employer" htmlFor="currentEmployer">
          <Input id="currentEmployer" value={draft.currentEmployer ?? ''} onChange={(e) => set('currentEmployer', e.target.value)} />
        </Field>
      </div>

      <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
        <Field label="Years of experience" htmlFor="yearsOfExperience" required>
          <Input
            id="yearsOfExperience"
            type="number"
            min={0}
            max={60}
            step={0.5}
            value={draft.yearsOfExperience ?? ''}
            onChange={(e) => set('yearsOfExperience', e.target.value === '' ? undefined : Number(e.target.value))}
          />
        </Field>
        <Field label="Sector" htmlFor="sectorSlug" required hint="The industry you work in">
          <Select id="sectorSlug" value={draft.sectorSlug ?? ''} onChange={(e) => set('sectorSlug', e.target.value)}>
            <option value="">Select a sector</option>
            {taxonomy?.sectors.map((s) => (
              <option key={s.slug} value={s.slug}>{s.name}</option>
            ))}
          </Select>
        </Field>
        <Field label="Function" htmlFor="functionSlug" required hint="What you do within it">
          <Select id="functionSlug" value={draft.functionSlug ?? ''} onChange={(e) => set('functionSlug', e.target.value)}>
            <option value="">Select a function</option>
            {taxonomy?.functions.map((f) => (
              <option key={f.slug} value={f.slug}>{f.name}</option>
            ))}
          </Select>
        </Field>
      </div>

      <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
        <Field label="Education level" htmlFor="educationLevel" required>
          <Select id="educationLevel" value={draft.educationLevel ?? ''} onChange={(e) => set('educationLevel', e.target.value as Draft['educationLevel'])}>
            <option value="">Select</option>
            {EDUCATION_LEVELS.map((level) => (
              <option key={level} value={level}>{EDUCATION_LABELS[level]}</option>
            ))}
          </Select>
        </Field>
        <Field label="Qualification" htmlFor="qualification" required hint="Degree and specialisation">
          <Input id="qualification" value={draft.qualification ?? ''} onChange={(e) => set('qualification', e.target.value)} />
        </Field>
        <Field label="Year" htmlFor="qualificationYear" required>
          <Input
            id="qualificationYear"
            type="number"
            min={1960}
            value={draft.qualificationYear ?? ''}
            onChange={(e) => set('qualificationYear', e.target.value === '' ? undefined : Number(e.target.value))}
          />
        </Field>
      </div>

      <Field label="Skills" htmlFor="skills" required hint="The tools, standards and techniques you actually use">
        <SkillsInput
          value={draft.skills ?? []}
          onChange={(skills) => set('skills', skills)}
          disabled={locked ?? false}
        />
      </Field>
    </>
  );
}

function HistoryStep({ draft, set }: StepProps) {
  const experiences = draft.experiences ?? [];

  const update = (index: number, patch: Partial<(typeof experiences)[number]>) => {
    const next = experiences.map((e, i) => (i === index ? { ...e, ...patch } : e));
    set('experiences', next);
  };

  const add = () =>
    set('experiences', [
      ...experiences,
      { company: '', title: '', startYear: new Date().getFullYear(), endYear: null, isCurrent: false, domainTags: [], keyAchievement: '' },
    ]);

  return (
    <div className="space-y-4">
      <p className="text-sm text-slate-600">
        Add the roles that show your depth. Our team reads this alongside your summary.
      </p>

      {experiences.length === 0 && (
        <p className="rounded-lg border border-dashed border-slate-300 p-6 text-center text-sm text-slate-500">
          No roles added yet.
        </p>
      )}

      {experiences.map((exp, index) => (
        <div key={index} className="rounded-lg border border-slate-200 p-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Company" htmlFor={`company-${index}`} required>
              <Input id={`company-${index}`} value={exp.company} onChange={(e) => update(index, { company: e.target.value })} />
            </Field>
            <Field label="Job title" htmlFor={`title-${index}`} required>
              <Input id={`title-${index}`} value={exp.title} onChange={(e) => update(index, { title: e.target.value })} />
            </Field>
          </div>

          <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <Field label="From (year)" htmlFor={`start-${index}`} required>
              <Input id={`start-${index}`} type="number" min={1960} value={exp.startYear} onChange={(e) => update(index, { startYear: Number(e.target.value) })} />
            </Field>
            <Field label="To (year)" htmlFor={`end-${index}`}>
              <Input
                id={`end-${index}`}
                type="number"
                min={1960}
                disabled={exp.isCurrent}
                value={exp.endYear ?? ''}
                onChange={(e) => update(index, { endYear: e.target.value === '' ? null : Number(e.target.value) })}
              />
            </Field>
            <label className="flex min-h-11 items-center gap-2.5 text-sm text-slate-700 sm:self-end sm:pb-2.5">
              <input
                type="checkbox"
                checked={exp.isCurrent}
                onChange={(e) => update(index, { isCurrent: e.target.checked, endYear: e.target.checked ? null : exp.endYear })}
                className="size-4 rounded border-slate-300"
              />
              Current role
            </label>
          </div>

          <div className="mt-4">
            <Field label="Key achievement" htmlFor={`ach-${index}`} hint="One line. Numbers help.">
              <Input id={`ach-${index}`} value={exp.keyAchievement ?? ''} onChange={(e) => update(index, { keyAchievement: e.target.value })} />
            </Field>
          </div>

          {/*
            * Domain tags — the proposal's career-history row specifies
            * "Company · title · years · domain tags". The column, the repo,
            * the serializer and the schema all carried it and the form
            * hardcoded an empty array, so every candidate row would have had
            * an empty list forever.
            */}
          <div className="mt-4">
            <Field
              label="What did you work on?"
              htmlFor={`domains-${index}`}
              hint="Comma-separated — e.g. rotating equipment, HAZOP, tech transfer"
            >
              <Input
                id={`domains-${index}`}
                value={(exp.domainTags ?? []).join(', ')}
                onChange={(e) =>
                  update(index, {
                    domainTags: e.target.value
                      .split(',')
                      .map((t) => t.trim())
                      .filter(Boolean)
                      .slice(0, 10),
                  })
                }
              />
            </Field>
          </div>

          <button
            type="button"
            onClick={() => set('experiences', experiences.filter((_, i) => i !== index))}
            className="mt-4 text-sm text-accent-600 hover:underline"
          >
            Remove this role
          </button>
        </div>
      ))}

      {experiences.length < LIMITS.candidate.experienceRows.max && (
        <Button variant="secondary" onClick={add}>+ Add a role</Button>
      )}
    </div>
  );
}

function SummaryStep({ draft, set }: StepProps) {
  const length = (draft.careerSummary ?? '').length;
  const min = LIMITS.candidate.careerSummary.min;

  return (
    <>
      <Field
        label="Career summary"
        htmlFor="careerSummary"
        required
        hint="What you do, the scale you work at, and what you're looking for next. Our team reads this first."
      >
        <Textarea
          id="careerSummary"
          rows={7}
          value={draft.careerSummary ?? ''}
          onChange={(e) => set('careerSummary', e.target.value)}
          maxLength={LIMITS.candidate.careerSummary.max}
        />
        <p className={`mt-1.5 text-xs ${length >= min ? 'text-slate-500' : 'text-amber-600'}`}>
          {length} characters · {min} minimum
        </p>
      </Field>

      <div className="grid gap-5 sm:grid-cols-2">
        <Field label="Notice period" htmlFor="noticePeriod" required>
          <Select id="noticePeriod" value={draft.noticePeriod ?? ''} onChange={(e) => set('noticePeriod', e.target.value as Draft['noticePeriod'])}>
            <option value="">Select</option>
            {NOTICE_PERIODS.map((n) => (
              <option key={n} value={n}>{NOTICE_PERIOD_LABELS[n]}</option>
            ))}
          </Select>
        </Field>
        <Field label="Employment preference" htmlFor="employmentPreference" required>
          <Select id="employmentPreference" value={draft.employmentPreference ?? ''} onChange={(e) => set('employmentPreference', e.target.value as Draft['employmentPreference'])}>
            <option value="">Select</option>
            {EMPLOYMENT_PREFERENCES.map((p) => (
              <option key={p} value={p}>{EMPLOYMENT_LABELS[p]}</option>
            ))}
          </Select>
        </Field>
      </div>

      <Field label="LinkedIn profile" htmlFor="linkedinUrl" hint="Optional">
        <Input id="linkedinUrl" type="url" placeholder="https://linkedin.com/in/…" value={draft.linkedinUrl ?? ''} onChange={(e) => set('linkedinUrl', e.target.value)} />
      </Field>
    </>
  );
}

function SalaryStep({ draft, set, profile }: StepProps) {
  const upload = useUploadResume();
  const uploadError = upload.error instanceof ApiError ? upload.error : null;

  return (
    <>
      {/*
        Stated plainly and next to the fields, because this is exactly where a
        candidate hesitates — and it is a guarantee the serializer layer enforces
        rather than a promise.
      */}
      <Alert tone="info" title="🔒 Your salary details stay private">
        These are visible to the BK Talent Connect team only. They are never shown to employers, and
        never appear on any job application.
      </Alert>

      <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
        <SalaryField label="Current CTC" id="currentSalaryLpa" value={draft.currentSalaryLpa} onChange={(v) => set('currentSalaryLpa', v)} />
        <SalaryField label="Expected minimum" id="expectedSalaryMinLpa" value={draft.expectedSalaryMinLpa} onChange={(v) => set('expectedSalaryMinLpa', v)} />
        <SalaryField label="Expected maximum" id="expectedSalaryMaxLpa" value={draft.expectedSalaryMaxLpa} onChange={(v) => set('expectedSalaryMaxLpa', v)} />
      </div>

      <div className="border-t border-slate-100 pt-5">
        <Field label="Your CV" htmlFor="resume" required hint="PDF or Word document, up to 5MB">
          <div className="flex flex-wrap items-center gap-3">
            <input
              id="resume"
              type="file"
              accept=".pdf,.doc,.docx"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) upload.mutate(file);
              }}
              className="text-sm file:mr-3 file:rounded-lg file:border-0 file:bg-brand-50 file:px-4 file:py-2 file:text-sm file:font-medium file:text-brand-700 hover:file:bg-brand-100"
            />
            {upload.isPending && <span className="text-sm text-slate-500">Uploading…</span>}
            {profile?.hasResume && !upload.isPending && <Badge tone="green">CV uploaded</Badge>}
          </div>
        </Field>
        {uploadError && (
          <div className="mt-3">
            <Alert tone="error">{uploadError.message}</Alert>
          </div>
        )}
      </div>
    </>
  );
}

function SalaryField({
  label,
  id,
  value,
  onChange,
}: {
  label: string;
  id: string;
  value: number | undefined;
  onChange: (value: number | undefined) => void;
}) {
  return (
    <Field label={label} htmlFor={id} required hint="In lakhs per annum">
      <Input
        id={id}
        type="number"
        min={0}
        step={0.5}
        value={value ?? ''}
        onChange={(e) => onChange(e.target.value === '' ? undefined : Number(e.target.value))}
      />
      {/* Echo in rupees: "12" means twelve lakh, and the ambiguity is worth killing. */}
      {value != null && value > 0 && (
        <p className="mt-1.5 text-xs text-slate-500">{formatSalary(value * 100_000)}</p>
      )}
    </Field>
  );
}
