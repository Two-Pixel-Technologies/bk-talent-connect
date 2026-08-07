/**
 * The job posting form.
 *
 * Mirrors the candidate wizard's conventions deliberately — same diff-before-
 * save behaviour, same warn-before-consequence pattern for D3, same visible
 * privacy note where confidential figures are asked for.
 */

import { useEffect, useMemo, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import {
  WORK_TYPES,
  EDUCATION_REQUIREMENTS,
  EDUCATION_LABELS,
  LIMITS,
  countWords,
  findContactDetails,
  formatSalary,
  isMaterialJobField,
  type UpdateJobInput,
} from '@bktc/shared';
import { ApiError } from '../../lib/api-client.js';
import {
  useEmployerJob,
  useUpdateJob,
  useSubmitJob,
  useCloseJob,
  useCloseImpact,
  useReopenJob,
  JOB_STATUS_LABEL,
  JOB_STATUS_TONE,
  type EmployerJob,
} from '../../features/employer/use-employer.js';
import { useTaxonomy } from '../../features/candidate/use-profile.js';
import { SkillsInput } from '../../components/skills-input.js';
import { QueryState } from '../../components/query-state.js';
import { MutationFeedback } from '../../components/mutation-feedback.js';
import { Alert, Badge, Button, Card, Field, Input, Select, Textarea } from '../../components/ui/index.js';

type Draft = UpdateJobInput;

const WORK_TYPE_LABELS: Record<string, string> = {
  ONSITE: 'On-site',
  HYBRID: 'Hybrid',
  REMOTE: 'Remote',
};

function draftFrom(job: EmployerJob): Draft {
  return {
    title: job.title,
    department: job.department ?? undefined,
    numberOfPositions: job.numberOfPositions,
    sectorSlug: job.sectorSlug ?? undefined,
    functionSlug: job.functionSlug ?? undefined,
    citySlug: job.citySlug ?? undefined,
    state: job.state ?? undefined,
    workType: (job.workType as Draft['workType']) ?? undefined,
    minExperience: job.minExperience ?? undefined,
    maxExperience: job.maxExperience ?? undefined,
    educationRequirement: (job.educationRequirement as Draft['educationRequirement']) ?? undefined,
    description: job.description ?? undefined,
    targetJoiningDate: job.targetJoiningDate ?? undefined,
    requiredSkills: job.requiredSkills.map((s) => s.name),
    goodToHaveSkills: job.goodToHaveSkills.map((s) => s.name),
    salaryBandMinLpa: job.salaryBandMinLpa ?? undefined,
    salaryBandMaxLpa: job.salaryBandMaxLpa ?? undefined,
  };
}

function isBlank(v: unknown) {
  return v === undefined || v === null || v === '';
}

function equal(a: unknown, b: unknown) {
  if (isBlank(a) && isBlank(b)) return true;
  if (Array.isArray(a) || Array.isArray(b)) return JSON.stringify(a ?? []) === JSON.stringify(b ?? []);
  return a === b;
}

export function JobEditorPage() {
  const { id = '' } = useParams();
  const { data: job, isPending, error: loadError, refetch } = useEmployerJob(id);
  const { data: taxonomy } = useTaxonomy();

  const update = useUpdateJob(id);
  const submit = useSubmitJob(id);
  const close = useCloseJob(id);
  const reopen = useReopenJob(id);

  const [draft, setDraft] = useState<Draft>({});
  const [confirmMaterial, setConfirmMaterial] = useState<string[] | null>(null);
  const [confirmingClose, setConfirmingClose] = useState(false);
  const closeImpact = useCloseImpact(id, confirmingClose);

  useEffect(() => {
    if (job) setDraft(draftFrom(job));
  }, [job?.id]);

  /** Only changed fields are sent — presence is what triggers re-review. */
  const { patch, changedFields } = useMemo(() => {
    if (!job) return { patch: {} as Draft, changedFields: [] as string[] };
    const saved = draftFrom(job);
    const p: Record<string, unknown> = {};
    const changed: string[] = [];
    for (const key of Object.keys(saved) as (keyof Draft)[]) {
      if (draft[key] === undefined && saved[key] === undefined) continue;
      if (!equal(draft[key], saved[key])) {
        changed.push(key);
        p[key] = draft[key];
      }
    }
    return { patch: p as Draft, changedFields: changed };
  }, [draft, job]);

  const materialChanges = changedFields.filter(isMaterialJobField);
  const live = job?.status === 'APPROVED';
  const closed = job?.status === 'CLOSED' || job?.status === 'FILLED';
  const underReview = job?.status === 'PENDING_APPROVAL';
  const error = update.error instanceof ApiError ? update.error : null;
  const submitError = submit.error instanceof ApiError ? submit.error : null;

  const contactFindings = useMemo(
    () => findContactDetails(draft.description ?? ''),
    [draft.description],
  );

  async function save(): Promise<boolean> {
    if (changedFields.length === 0) return true;
    if (live && materialChanges.length > 0 && confirmMaterial === null) {
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

  // Same trap as the wizard: a 403 on a job you do not own, or an expired
  // session mid-edit, used to render a spinner that never resolved.
  if (isPending || loadError || !job) {
    return (
      <QueryState
        isPending={isPending}
        error={loadError ?? (job ? null : new Error('Posting unavailable'))}
        onRetry={() => void refetch()}
      >
        <span />
      </QueryState>
    );
  }

  const set = <K extends keyof Draft>(key: K, value: Draft[K]) =>
    setDraft((d) => ({ ...d, [key]: value }));

  const cities = (taxonomy?.cities ?? []).filter(
    (c) => c.state === (draft.state ?? '') || c.state === null,
  );

  const words = countWords(draft.description ?? '');
  const readOnly = underReview || closed;

  return (
    <div className="space-y-6">
      <Link to="/employer/jobs" className="inline-block text-sm text-brand-600 hover:underline">
        ← All postings
      </Link>

      <StatusBanner job={job} />

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="text-2xl font-bold text-brand-900">{job.title}</h1>
          <Badge tone={JOB_STATUS_TONE[job.status] ?? 'slate'}>
            {JOB_STATUS_LABEL[job.status] ?? job.status}
          </Badge>
        </div>
        <Link
          to={`/employer/jobs/${job.id}/applicants`}
          className="inline-flex min-h-11 items-center rounded-lg border border-slate-300 px-4 text-sm font-medium text-brand-700 hover:bg-slate-50"
        >
          View applicants
        </Link>
      </div>

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

      {/*
        Closing auto-rejects every applicant nobody has looked at yet, and until
        an admin intervenes there is no way back. A low-emphasis ghost button
        with no confirmation was doing that in one tap.
      */}
      {confirmingClose && (
        <Alert tone="warning" title="Close this posting?">
          <p>
            {closeImpact.data === undefined
              ? 'Checking how many applicants this affects…'
              : closeImpact.data.affectedApplicants === 0
                ? 'It will be removed from the job list. No applicants are affected.'
                : `${closeImpact.data.affectedApplicants} ${
                    closeImpact.data.affectedApplicants === 1 ? 'applicant' : 'applicants'
                  } who have not been reviewed yet will be marked not selected, and they will see that on their tracker. Anyone already shortlisted is left alone.`}
          </p>
          <p className="mt-2">Reopening the role restores them.</p>
          <div className="mt-3 flex flex-col gap-2 sm:flex-row">
            <Button
              variant="danger"
              loading={close.isPending}
              onClick={() =>
                // Dismissing the panel immediately meant close.isPending never
                // rendered and a failed close looked exactly like a successful
                // one. Close it on success only.
                close.mutate(undefined, { onSuccess: () => setConfirmingClose(false) })
              }
            >
              Close the posting
            </Button>
            <Button variant="secondary" onClick={() => setConfirmingClose(false)}>
              Keep it open
            </Button>
          </div>
          <MutationFeedback error={close.error} />
        </Alert>
      )}

      {confirmMaterial && (
        <Alert tone="warning" title="This will take the posting offline">
          <p>
            You&rsquo;ve changed {confirmMaterial.join(', ')}. Because this role is live, saving
            removes it from the job list until our team reviews it again — usually within a day.
            Applications already received are not affected.
          </p>
          <div className="mt-3 flex flex-col gap-2 sm:flex-row">
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
        <fieldset disabled={readOnly} className="space-y-5">
          {readOnly && (
            <p className="text-sm text-slate-500">
              {underReview
                ? 'This posting is locked while our team reviews it.'
                : 'This posting is closed. Reopen it to make changes.'}
            </p>
          )}

          <div className="grid gap-5 sm:grid-cols-2">
            <Field label="Job title" htmlFor="title" required>
              <Input id="title" value={draft.title ?? ''} onChange={(e) => set('title', e.target.value)} />
            </Field>
            <Field label="Department" htmlFor="department" required hint="e.g. Production, Quality, R&D">
              <Input id="department" value={draft.department ?? ''} onChange={(e) => set('department', e.target.value)} />
            </Field>
          </div>

          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            <Field label="Sector" htmlFor="sectorSlug" required hint="The industry">
              <Select id="sectorSlug" value={draft.sectorSlug ?? ''} onChange={(e) => set('sectorSlug', e.target.value)}>
                <option value="">Select</option>
                {taxonomy?.sectors.map((s) => <option key={s.slug} value={s.slug}>{s.name}</option>)}
              </Select>
            </Field>
            <Field label="Function" htmlFor="functionSlug" required hint="The department type">
              <Select id="functionSlug" value={draft.functionSlug ?? ''} onChange={(e) => set('functionSlug', e.target.value)}>
                <option value="">Select</option>
                {taxonomy?.functions.map((f) => <option key={f.slug} value={f.slug}>{f.name}</option>)}
              </Select>
            </Field>
            <Field label="Positions" htmlFor="numberOfPositions" required>
              <Input
                id="numberOfPositions"
                type="number"
                min={1}
                value={draft.numberOfPositions ?? 1}
                onChange={(e) => set('numberOfPositions', e.target.value === '' ? undefined : Number(e.target.value))}
              />
            </Field>
          </div>

          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            <Field label="State" htmlFor="state" required>
              <Select
                id="state"
                value={draft.state ?? ''}
                onChange={(e) => {
                  set('state', e.target.value);
                  const ok = (taxonomy?.cities ?? []).some(
                    (c) => c.slug === draft.citySlug && (c.state === e.target.value || c.state === null),
                  );
                  if (!ok) set('citySlug', '');
                }}
              >
                <option value="">Select</option>
                {(taxonomy?.states ?? []).map((s) => <option key={s} value={s}>{s}</option>)}
              </Select>
            </Field>
            <Field label="City" htmlFor="citySlug" required hint={draft.state ? undefined : 'Choose a state first'}>
              <Select id="citySlug" value={draft.citySlug ?? ''} disabled={!draft.state} onChange={(e) => set('citySlug', e.target.value)}>
                <option value="">{draft.state ? 'Select' : '—'}</option>
                {cities.map((c) => <option key={c.slug} value={c.slug}>{c.name}</option>)}
              </Select>
            </Field>
            <Field label="Work type" htmlFor="workType" required>
              <Select id="workType" value={draft.workType ?? ''} onChange={(e) => set('workType', e.target.value as Draft['workType'])}>
                <option value="">Select</option>
                {WORK_TYPES.map((w) => <option key={w} value={w}>{WORK_TYPE_LABELS[w]}</option>)}
              </Select>
            </Field>
          </div>

          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            <Field label="Minimum experience" htmlFor="minExperience" required hint="Years">
              <Input id="minExperience" type="number" min={0} step={0.5} value={draft.minExperience ?? ''} onChange={(e) => set('minExperience', e.target.value === '' ? undefined : Number(e.target.value))} />
            </Field>
            <Field label="Maximum experience" htmlFor="maxExperience" required hint="Years">
              <Input id="maxExperience" type="number" min={0} step={0.5} value={draft.maxExperience ?? ''} onChange={(e) => set('maxExperience', e.target.value === '' ? undefined : Number(e.target.value))} />
            </Field>
            <Field label="Education" htmlFor="educationRequirement" required>
              <Select id="educationRequirement" value={draft.educationRequirement ?? ''} onChange={(e) => set('educationRequirement', e.target.value as Draft['educationRequirement'])}>
                <option value="">Select</option>
                {EDUCATION_REQUIREMENTS.map((r) => <option key={r} value={r}>{EDUCATION_LABELS[r as keyof typeof EDUCATION_LABELS]}</option>)}
              </Select>
            </Field>
          </div>

          <Field label="Required skills" htmlFor="requiredSkills" required hint={`At least ${LIMITS.job.requiredSkills.min}. These are what we match candidates on.`}>
            <SkillsInput
              id="requiredSkills"
              value={draft.requiredSkills ?? []}
              onChange={(s) => set('requiredSkills', s)}
              disabled={readOnly}
              max={LIMITS.job.requiredSkills.max}
              min={LIMITS.job.requiredSkills.min}
            />
          </Field>

          <Field label="Good to have" htmlFor="goodToHaveSkills" hint="Optional — nice, but not a dealbreaker">
            <SkillsInput
              id="goodToHaveSkills"
              value={draft.goodToHaveSkills ?? []}
              onChange={(s) => set('goodToHaveSkills', s)}
              disabled={readOnly}
              max={LIMITS.job.goodToHaveSkills.max}
              min={0}
            />
          </Field>

          <Field
            label="Role description"
            htmlFor="description"
            required
            hint="What the person will own, the team, the plant. Candidates read this before applying."
          >
            <Textarea id="description" rows={10} value={draft.description ?? ''} onChange={(e) => set('description', e.target.value)} maxLength={LIMITS.job.descriptionChars.max} />
            <p className={`mt-1.5 text-xs ${words >= LIMITS.job.descriptionWords.min ? 'text-slate-500' : 'text-amber-600'}`}>
              {words} words · {LIMITS.job.descriptionWords.min} minimum
            </p>
          </Field>

          {/*
            Warned about here rather than silently flagged to an admin later.
            Candidate contact is routed through the BK team, and a phone number
            in the description is how that gets bypassed — usually by accident.
          */}
          {contactFindings.length > 0 && (
            <Alert tone="warning" title="Contact details in the description">
              We spotted {contactFindings.map((f) => f.value).join(', ')}. All candidate contact goes
              through the BK Talent Connect team, so our reviewer will likely ask you to remove this.
            </Alert>
          )}

          <Field label="Target joining date" htmlFor="targetJoiningDate" hint="Optional">
            <Input id="targetJoiningDate" type="date" value={draft.targetJoiningDate ?? ''} onChange={(e) => set('targetJoiningDate', e.target.value)} />
          </Field>

          <div className="border-t border-slate-100 pt-5">
            <Alert tone="info" title="🔒 Your salary band is confidential">
              It is visible to the BK Talent Connect team only, and is never shown to candidates. We
              use it to make sure the people we send you are in range.
            </Alert>
            <div className="mt-4 grid gap-5 sm:grid-cols-2">
              <SalaryField label="Band minimum" id="salaryBandMinLpa" value={draft.salaryBandMinLpa} onChange={(v) => set('salaryBandMinLpa', v)} />
              <SalaryField label="Band maximum" id="salaryBandMaxLpa" value={draft.salaryBandMaxLpa} onChange={(v) => set('salaryBandMaxLpa', v)} />
            </div>
          </div>
        </fieldset>

        {submitError && (
          <div className="mt-5">
            <Alert tone="error" title={submitError.message}>
              <ul className="mt-1 list-inside list-disc">
                {submitError.fields.map((f) => <li key={f.path}>{f.message}</li>)}
              </ul>
            </Alert>
          </div>
        )}

        <div className="mt-8 flex flex-col gap-3 border-t border-slate-100 pt-5 sm:flex-row sm:items-center sm:justify-between">
          <div>
            {closed ? (
              <div>
                <Button variant="secondary" onClick={() => reopen.mutate()} loading={reopen.isPending}>
                  Reopen posting
                </Button>
                <MutationFeedback
                  error={reopen.error}
                  isSuccess={reopen.isSuccess}
                  successMessage="Reopened. Applicants closed with it have been restored."
                />
              </div>
            ) : (
              <Button variant="ghost" onClick={() => setConfirmingClose(true)}>
                Close posting
              </Button>
            )}
          </div>

          {!readOnly && (
            <div className="flex flex-col gap-2 sm:flex-row">
              <Button variant="secondary" onClick={() => void save()} loading={update.isPending}>
                Save
              </Button>
              {!live && (
                <Button
                  onClick={async () => {
                    if (await save()) submit.mutate();
                  }}
                  loading={submit.isPending || update.isPending}
                >
                  Submit for review
                </Button>
              )}
            </div>
          )}
        </div>
      </Card>
    </div>
  );
}

function StatusBanner({ job }: { job: EmployerJob }) {
  switch (job.status) {
    case 'PENDING_APPROVAL':
      return (
        <Alert tone="warning" title="Under review">
          Our team is reviewing this posting. It goes live as soon as it is approved.
        </Alert>
      );
    case 'APPROVED':
      return (
        <Alert tone="success" title="This role is live">
          Candidates can see and apply to it. Editing the role details will take it offline until we
          review it again.
        </Alert>
      );
    case 'CHANGES_REQUESTED':
      return (
        <Alert tone="warning" title="We&rsquo;ve asked for a few changes">
          {job.reviewNote ?? 'Please review the posting and resubmit.'}
        </Alert>
      );
    case 'REJECTED':
      return (
        <Alert tone="error" title="Not approved">
          {job.reviewNote ?? 'Please contact the BK Talent Connect team.'}
        </Alert>
      );
    case 'CLOSED':
    case 'FILLED':
      return <Alert tone="info" title="Closed">This posting is no longer accepting applications.</Alert>;
    default:
      return null;
  }
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
  onChange: (v: number | undefined) => void;
}) {
  return (
    <Field label={label} htmlFor={id} required hint="In lakhs per annum">
      <Input id={id} type="number" min={0} step={0.5} value={value ?? ''} onChange={(e) => onChange(e.target.value === '' ? undefined : Number(e.target.value))} />
      {value != null && value > 0 && (
        <p className="mt-1.5 text-xs text-slate-500">{formatSalary(value * 100_000)}</p>
      )}
    </Field>
  );
}
