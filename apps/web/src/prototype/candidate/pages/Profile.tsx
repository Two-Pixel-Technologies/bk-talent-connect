import { useState, type ReactNode } from 'react';
import { usePrototype } from '../PrototypeContext.js';
import { ApprovalChip, PrimaryButton, ProfileProgressRing, SecondaryButton, SectionCard } from '../components/ui.js';
import { PUBLIC_ICONS } from '../../../components/icons/public-icons.js';

/** A labeled value that becomes an input when the section is being edited. */
function Field({
  label,
  value,
  editing,
  onChange,
}: {
  label: string;
  value: string;
  editing: boolean;
  onChange: (v: string) => void;
}) {
  return (
    <div>
      <p className="text-xs font-medium text-pub-muted">{label}</p>
      {editing ? (
        <input
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="mt-1 w-full min-h-9 rounded-lg border border-pub-border px-3 text-sm text-pub-navy focus:border-pub-blue focus:outline-none focus:ring-2 focus:ring-pub-blue/20"
        />
      ) : (
        <p className="mt-1 text-sm font-medium text-pub-navy">{value || '—'}</p>
      )}
    </div>
  );
}

function EditableSection({
  title,
  children,
  onSave,
}: {
  title: string;
  children: (editing: boolean) => ReactNode;
  onSave?: () => void;
}) {
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);

  function save() {
    setSaving(true);
    setTimeout(() => {
      onSave?.();
      setSaving(false);
      setEditing(false);
    }, 500);
  }

  return (
    <SectionCard
      title={title}
      action={
        editing ? (
          <div className="flex gap-2">
            <SecondaryButton onClick={() => setEditing(false)} className="min-h-8 px-3 text-xs">
              Cancel
            </SecondaryButton>
            <PrimaryButton onClick={save} loading={saving} className="min-h-8 px-3 text-xs">
              {saving ? 'Saving…' : 'Save'}
            </PrimaryButton>
          </div>
        ) : (
          <button onClick={() => setEditing(true)} className="text-xs font-semibold text-pub-blue hover:underline">
            Edit
          </button>
        )
      }
    >
      {children(editing)}
    </SectionCard>
  );
}

export function Profile() {
  const { candidate, setCandidate } = usePrototype();
  const [draft, setDraft] = useState(candidate);

  function field<K extends keyof typeof candidate>(key: K) {
    return {
      value: String(draft[key] ?? ''),
      onChange: (v: string) =>
        setDraft((d) => ({ ...d, [key]: typeof d[key] === 'number' ? (Number(v) as never) : (v as never) })),
    };
  }

  function commit() {
    setCandidate(draft);
  }

  return (
    <div className="space-y-6">
      <SectionCard>
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-4">
            <ProfileProgressRing percent={candidate.completionPercent} size={72} />
            <div>
              <h1 className="font-heading text-xl font-bold text-pub-navy">{candidate.fullName}</h1>
              <p className="text-sm text-pub-muted">{candidate.currentJobTitle} · {candidate.currentEmployer}</p>
              <ApprovalChip status={candidate.approvalStatus} className="mt-2" />
            </div>
          </div>
          {candidate.reviewNote && (
            <div className="rounded-lg bg-amber-50 p-3 text-xs text-amber-800 sm:max-w-xs">{candidate.reviewNote}</div>
          )}
        </div>
      </SectionCard>

      <EditableSection title="Personal details" onSave={commit}>
        {(editing) => (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label="Full name" editing={editing} {...field('fullName')} />
            <Field label="Mobile" editing={editing} {...field('mobile')} />
            <Field label="City" editing={editing} {...field('cityName')} />
            <Field label="State" editing={editing} {...field('state')} />
          </div>
        )}
      </EditableSection>

      <EditableSection title="Professional details" onSave={commit}>
        {(editing) => (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label="Current title" editing={editing} {...field('currentJobTitle')} />
            <Field label="Current employer" editing={editing} {...field('currentEmployer')} />
            <Field label="Sector" editing={editing} {...field('sectorName')} />
            <Field label="Function" editing={editing} {...field('functionName')} />
            <Field label="Years of experience" editing={editing} {...field('yearsOfExperience')} />
            <Field label="Notice period" editing={editing} {...field('noticePeriod')} />
          </div>
        )}
      </EditableSection>

      <SectionCard title="Career summary">
        <p className="text-sm leading-relaxed text-pub-text">{candidate.careerSummary}</p>
      </SectionCard>

      <SectionCard title="Experience">
        <ol className="space-y-4">
          {candidate.experiences.map((exp) => (
            <li key={exp.id} className="flex gap-3 border-b border-pub-border pb-4 last:border-0 last:pb-0">
              <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-pub-blue-light text-pub-blue">
                <PUBLIC_ICONS.briefcase className="size-4" />
              </span>
              <div className="min-w-0">
                <p className="text-sm font-semibold text-pub-navy">
                  {exp.title} · {exp.company}
                </p>
                <p className="text-xs text-pub-muted">
                  {exp.startYear} – {exp.isCurrent ? 'Present' : exp.endYear}
                </p>
                {exp.keyAchievement && <p className="mt-1 text-xs leading-relaxed text-pub-text">{exp.keyAchievement}</p>}
              </div>
            </li>
          ))}
        </ol>
      </SectionCard>

      <SectionCard title="Skills">
        <div className="flex flex-wrap gap-1.5">
          {candidate.skills.map((s) => (
            <span key={s.id} className="rounded-full bg-pub-blue-light px-2.5 py-1 text-xs font-medium text-pub-blue">
              {s.name}
            </span>
          ))}
        </div>
      </SectionCard>

      <SectionCard title="Education">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <div>
            <p className="text-xs font-medium text-pub-muted">Level</p>
            <p className="mt-1 text-sm font-medium text-pub-navy">{candidate.educationLevel}</p>
          </div>
          <div>
            <p className="text-xs font-medium text-pub-muted">Qualification</p>
            <p className="mt-1 text-sm font-medium text-pub-navy">{candidate.qualification}</p>
          </div>
          <div>
            <p className="text-xs font-medium text-pub-muted">Year</p>
            <p className="mt-1 text-sm font-medium text-pub-navy">{candidate.qualificationYear}</p>
          </div>
        </div>
      </SectionCard>

      <SectionCard
        title="Resume"
        action={
          <button className="text-xs font-semibold text-pub-blue hover:underline">{candidate.hasResume ? 'Replace' : 'Upload'}</button>
        }
      >
        {candidate.hasResume ? (
          <div className="flex items-center gap-3 rounded-lg border border-pub-border p-3">
            <span className="flex size-9 items-center justify-center rounded-full bg-pub-blue-light text-pub-blue">
              <PUBLIC_ICONS.fileCheck className="size-4" />
            </span>
            <div>
              <p className="text-sm font-semibold text-pub-navy">Resume on file</p>
              <p className="text-xs text-pub-muted">PDF · Uploaded during profile submission</p>
            </div>
          </div>
        ) : (
          <p className="text-sm text-pub-muted">No resume uploaded yet.</p>
        )}
      </SectionCard>

      <SectionCard title="Salary & preferences">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <div>
            <p className="text-xs font-medium text-pub-muted">Current (LPA)</p>
            <p className="mt-1 text-sm font-medium text-pub-navy">₹{candidate.currentSalaryLpa}L</p>
          </div>
          <div>
            <p className="text-xs font-medium text-pub-muted">Expected (LPA)</p>
            <p className="mt-1 text-sm font-medium text-pub-navy">
              ₹{candidate.expectedSalaryMinLpa}L – ₹{candidate.expectedSalaryMaxLpa}L
            </p>
          </div>
          <div>
            <p className="text-xs font-medium text-pub-muted">Employment type</p>
            <p className="mt-1 text-sm font-medium text-pub-navy">{candidate.employmentPreference}</p>
          </div>
        </div>
        <p className="mt-3 text-xs text-pub-muted">
          {candidate.openToRelocation ? 'Open to relocation.' : 'Not open to relocation.'}
        </p>
      </SectionCard>
    </div>
  );
}
