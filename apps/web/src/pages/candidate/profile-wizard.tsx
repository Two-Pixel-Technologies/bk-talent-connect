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

import { useEffect, useMemo, useState } from 'react';
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
} from '../../features/candidate/use-profile.js';
import { SkillsInput } from '../../components/skills-input.js';
import { Alert, Badge, Button, Card, Field, Input, Select, Textarea } from '../../components/ui/index.js';

type Draft = UpdateProfileInput;

const EMPLOYMENT_LABELS: Record<string, string> = {
  FULL_TIME: 'Full-time',
  CONTRACT: 'Contract',
  BOTH: 'Open to both',
};

export function ProfileWizardPage() {
  const { data: profile, isPending } = useProfile();
  const { data: taxonomy } = useTaxonomy();
  const update = useUpdateProfile();
  const submit = useSubmitProfile();

  const [stepIndex, setStepIndex] = useState(0);
  const [draft, setDraft] = useState<Draft>({});
  const [confirmMaterial, setConfirmMaterial] = useState<string[] | null>(null);

  // Seed the draft once the profile arrives.
  useEffect(() => {
    if (!profile) return;
    setDraft({
      fullName: profile.fullName,
      mobile: profile.mobile,
      citySlug: profile.citySlug ?? undefined,
      state: profile.state ?? undefined,
      openToRelocation: profile.openToRelocation,
      currentJobTitle: profile.currentJobTitle ?? undefined,
      currentEmployer: profile.currentEmployer ?? undefined,
      yearsOfExperience: profile.yearsOfExperience ?? undefined,
      sectorSlug: profile.sectorSlug ?? undefined,
      functionSlug: profile.functionSlug ?? undefined,
      educationLevel: (profile.educationLevel as Draft['educationLevel']) ?? undefined,
      qualification: profile.qualification ?? undefined,
      qualificationYear: profile.qualificationYear ?? undefined,
      careerSummary: profile.careerSummary ?? undefined,
      noticePeriod: (profile.noticePeriod as Draft['noticePeriod']) ?? undefined,
      employmentPreference: (profile.employmentPreference as Draft['employmentPreference']) ?? undefined,
      currentSalaryLpa: profile.currentSalaryLpa ?? undefined,
      expectedSalaryMinLpa: profile.expectedSalaryMinLpa ?? undefined,
      expectedSalaryMaxLpa: profile.expectedSalaryMaxLpa ?? undefined,
      linkedinUrl: profile.linkedinUrl ?? undefined,
      skills: profile.skills.map((s) => s.name),
      experiences: profile.experiences.map((e) => ({
        company: e.company,
        title: e.title,
        startYear: e.startYear,
        endYear: e.endYear,
        isCurrent: e.isCurrent,
        domainTags: e.domainTags,
        keyAchievement: e.keyAchievement ?? undefined,
      })),
    });
  }, [profile?.id]);

  const locked = profile?.profileStatus === 'SUBMITTED';
  const approved = profile?.profileStatus === 'APPROVED';
  const step = PROFILE_STEPS[stepIndex]!;
  const error = update.error instanceof ApiError ? update.error : null;

  /** Fields changed relative to what is saved — drives the D2 warning. */
  const changedFields = useMemo(() => {
    if (!profile) return [];
    const changed: string[] = [];
    if (draft.fullName !== profile.fullName) changed.push('fullName');
    if (draft.mobile !== profile.mobile) changed.push('mobile');
    if (draft.citySlug !== (profile.citySlug ?? undefined)) changed.push('citySlug');
    if (draft.currentJobTitle !== (profile.currentJobTitle ?? undefined)) changed.push('currentJobTitle');
    if (draft.yearsOfExperience !== (profile.yearsOfExperience ?? undefined)) changed.push('yearsOfExperience');
    if (draft.sectorSlug !== (profile.sectorSlug ?? undefined)) changed.push('sectorSlug');
    if (draft.functionSlug !== (profile.functionSlug ?? undefined)) changed.push('functionSlug');
    if (draft.careerSummary !== (profile.careerSummary ?? undefined)) changed.push('careerSummary');
    if (draft.currentSalaryLpa !== (profile.currentSalaryLpa ?? undefined)) changed.push('currentSalaryLpa');
    if (draft.expectedSalaryMinLpa !== (profile.expectedSalaryMinLpa ?? undefined))
      changed.push('expectedSalaryMinLpa');
    if (draft.expectedSalaryMaxLpa !== (profile.expectedSalaryMaxLpa ?? undefined))
      changed.push('expectedSalaryMaxLpa');
    const draftSkills = (draft.skills ?? []).join('|');
    const savedSkills = profile.skills.map((s) => s.name).join('|');
    if (draftSkills !== savedSkills) changed.push('skills');
    if (JSON.stringify(draft.experiences ?? []) !== JSON.stringify(profile.experiences.map((e) => ({
      company: e.company, title: e.title, startYear: e.startYear, endYear: e.endYear,
      isCurrent: e.isCurrent, domainTags: e.domainTags, keyAchievement: e.keyAchievement ?? undefined,
    })))) changed.push('experiences');
    return changed;
  }, [draft, profile]);

  const materialChanges = changedFields.filter(isMaterialField);

  async function save(): Promise<boolean> {
    // Warn before, not after: going back into review costs job access.
    if (approved && materialChanges.length > 0 && confirmMaterial === null) {
      setConfirmMaterial(materialChanges);
      return false;
    }
    setConfirmMaterial(null);
    try {
      await update.mutateAsync(draft);
      return true;
    } catch {
      return false;
    }
  }

  async function next() {
    if (await save()) setStepIndex((i) => Math.min(i + 1, PROFILE_STEPS.length - 1));
  }

  if (isPending || !profile) {
    return <p className="text-slate-500">Loading your profile…</p>;
  }

  const set = <K extends keyof Draft>(key: K, value: Draft[K]) =>
    setDraft((d) => ({ ...d, [key]: value }));

  return (
    <div className="space-y-6">
      <StatusBanner profile={profile} />

      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-brand-900">Your profile</h1>
          <p className="mt-1 text-sm text-slate-600">
            This is what our team reviews, and what employers see once you apply.
          </p>
        </div>
        <div className="text-right">
          <p className="text-sm font-medium text-slate-700">{profile.completionPercent}% complete</p>
          <div className="mt-1.5 h-2 w-40 overflow-hidden rounded-full bg-slate-200">
            <div
              className="h-full rounded-full bg-brand-600 transition-all"
              style={{ width: `${profile.completionPercent}%` }}
            />
          </div>
        </div>
      </div>

      <Stepper current={stepIndex} onSelect={setStepIndex} />

      {error && (
        <Alert tone="error" title={error.message}>
          {error.fields.length > 0 && (
            <ul className="mt-1 list-inside list-disc">
              {error.fields.map((f) => (
                <li key={f.path}>{f.message}</li>
              ))}
            </ul>
          )}
        </Alert>
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

        <div className="mt-8 flex items-center justify-between border-t border-slate-100 pt-5">
          <Button
            variant="ghost"
            disabled={stepIndex === 0}
            onClick={() => setStepIndex((i) => i - 1)}
          >
            ← Back
          </Button>

          <div className="flex gap-2">
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
              <ul className="mt-1 list-inside list-disc">
                {submit.error.fields.map((f) => (
                  <li key={f.path}>{f.message}</li>
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
      <ol className="flex flex-wrap gap-2">
        {PROFILE_STEPS.map((step, index) => {
          const active = index === current;
          return (
            <li key={step.id}>
              <button
                type="button"
                onClick={() => onSelect(index)}
                aria-current={active ? 'step' : undefined}
                className={`rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
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
  taxonomy?: { sectors: { slug: string; name: string }[]; functions: { slug: string; name: string }[]; cities: { slug: string; name: string }[] } | undefined;
  locked?: boolean;
  profile?: CandidateProfile;
};

function BasicStep({ draft, set, taxonomy }: StepProps) {
  return (
    <>
      <Field label="Full name" htmlFor="fullName" required>
        <Input id="fullName" value={draft.fullName ?? ''} onChange={(e) => set('fullName', e.target.value)} />
      </Field>

      <div className="grid gap-5 sm:grid-cols-2">
        <Field label="Mobile number" htmlFor="mobile" required>
          <Input id="mobile" type="tel" value={draft.mobile ?? ''} onChange={(e) => set('mobile', e.target.value)} />
        </Field>
        <Field label="City" htmlFor="citySlug" required>
          <Select id="citySlug" value={draft.citySlug ?? ''} onChange={(e) => set('citySlug', e.target.value)}>
            <option value="">Select a city</option>
            {taxonomy?.cities.map((c) => (
              <option key={c.slug} value={c.slug}>{c.name}</option>
            ))}
          </Select>
        </Field>
      </div>

      <Field label="State" htmlFor="state" required>
        <Select id="state" value={draft.state ?? ''} onChange={(e) => set('state', e.target.value)}>
          <option value="">Select a state</option>
          {INDIAN_STATES.map((s) => (
            <option key={s} value={s}>{s}</option>
          ))}
        </Select>
      </Field>

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

      <div className="grid gap-5 sm:grid-cols-3">
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

      <div className="grid gap-5 sm:grid-cols-3">
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

          <div className="mt-4 grid gap-4 sm:grid-cols-3">
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
            <label className="flex items-center gap-2 self-end pb-2.5 text-sm text-slate-700">
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

      <div className="grid gap-5 sm:grid-cols-3">
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
